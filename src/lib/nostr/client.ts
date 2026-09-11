import { Relay } from "nostr-tools/relay";
import { matchFilter, type Filter } from "nostr-tools/filter";
import type { Event } from "nostr-tools/pure";
import { getRelayConfig } from "./relays";
import { verifiedEvent, isPubkey } from "./validation";
import {
  NostrError,
  RelayOperationError,
  type RelayConfig,
  type RelayResult,
  type RelayQueryResult,
  type RelayPublishResult,
} from "./types";

/** Small injectable boundary for deterministic, network-free tests. */
export interface RelayConnection {
  onclose: (() => void) | null;
  publishTimeout: number;
  connect(options: { timeout: number; abort: AbortSignal }): Promise<void>;
  publish(event: Event): Promise<string>;
  subscribe(
    filters: Filter[],
    params: {
      onevent: (event: Event) => void;
      oneose: () => void;
      onclose: (reason: string) => void;
      eoseTimeout: number;
    },
  ): { close(): void; readonly closed?: boolean; receivedEose?(): void };
  close(): void;
}

type FailureReason = Extract<RelayResult, { ok: false }>["reason"];
class RelayFailure extends Error {
  constructor(readonly reason: FailureReason) {
    super(reason);
  }
}

type Attempt = { result: RelayResult; events: Event[] };

// Limit untrusted wire input before nostr-tools parses JSON or verifies crypto.
class BoundedRelay extends Relay {
  override _onmessage(event: MessageEvent<unknown>): void {
    if (typeof event.data !== "string" || event.data.length > 131_072) return;
    super._onmessage(event);
  }
}

export class NostrClient {
  readonly config: RelayConfig;
  private readonly relayFactory: (url: string) => RelayConnection;

  constructor(
    options: {
      config?: Partial<RelayConfig>;
      relayFactory?: (url: string) => RelayConnection;
    } = {},
  ) {
    this.config = getRelayConfig(options.config);
    this.relayFactory =
      options.relayFactory ??
      ((url) =>
        new BoundedRelay(url, { enableReconnect: false, enablePing: false }));
  }

  private async attempt(
    url: string,
    operation: { filter: Filter } | { event: Event },
  ): Promise<Attempt> {
    const abort = new AbortController();
    let relay: RelayConnection | undefined;
    let subscription:
      | { close(): void; readonly closed?: boolean; receivedEose?(): void }
      | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const events: Event[] = [];
    const seen = new Set<string>();
    let truncated = false;
    try {
      relay = this.relayFactory(url);
      const connection = relay;
      connection.publishTimeout = this.config.timeoutMs;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new RelayFailure("timeout")),
          this.config.timeoutMs,
        );
      });
      const disconnected = new Promise<never>((_, reject) => {
        connection.onclose = () => reject(new RelayFailure("closed"));
      });
      const work = (async () => {
        await connection.connect({
          timeout: this.config.timeoutMs,
          abort: abort.signal,
        });
        if (abort.signal.aborted) throw new RelayFailure("timeout");
        if ("event" in operation) {
          try {
            await connection.publish(operation.event);
          } catch {
            throw new RelayFailure("rejected");
          }
          return;
        }
        await new Promise<void>((resolve, reject) => {
          subscription = connection.subscribe([operation.filter], {
            // nostr-tools' own EOSE timer calls oneose on expiry. Our outer
            // deadline must win, or an unreachable relay looks like no results.
            eoseTimeout: this.config.timeoutMs + 1000,
            onevent: (raw) => {
              if (
                abort.signal.aborted ||
                events.length >= this.config.maxEventsPerRelay
              )
                return;
              const event = verifiedEvent(raw);
              if (
                !event ||
                !matchFilter(operation.filter, event) ||
                seen.has(event.id)
              )
                return;
              seen.add(event.id);
              events.push(event);
              if (events.length >= this.config.maxEventsPerRelay) {
                truncated = true;
                resolve();
              }
            },
            oneose: resolve,
            onclose: () => reject(new RelayFailure("closed")),
          });
        });
      })();
      await Promise.race([work, deadline, disconnected]);
      return {
        result: { url, ok: true, ...(truncated ? { truncated: true } : {}) },
        events,
      };
    } catch (error) {
      return {
        result: {
          url,
          ok: false,
          reason: error instanceof RelayFailure ? error.reason : "unavailable",
        },
        // Incomplete queries must not silently masquerade as complete results.
        events: [],
      };
    } finally {
      clearTimeout(timer);
      abort.abort();
      if (relay) relay.onclose = null;
      try {
        // nostr-tools 2.25.2 does not clear its EOSE timer in close().
        // The operation is already settled; this only clears the library timer.
        subscription?.receivedEose?.();
        if (!subscription?.closed) subscription?.close();
      } catch {
        /* cleanup is best effort */
      }
      // nostr-tools queues CLOSE through connectionPromise.then(). Let that
      // write flush before closing the socket, avoiding an unhandled rejection.
      await Promise.resolve();
      try {
        relay?.close();
      } catch {
        /* cleanup is best effort */
      }
    }
  }

  private async execute(
    operation: { filter: Filter } | { event: Event },
  ): Promise<Attempt[]> {
    const results = await Promise.all(
      this.config.primary.map((url) => this.attempt(url, operation)),
    );
    // Attempt fallbacks on any primary failure, even if another primary works.
    if (results.some(({ result }) => !result.ok)) {
      results.push(
        ...(await Promise.all(
          this.config.fallback.map((url) => this.attempt(url, operation)),
        )),
      );
    }
    if (!results.some(({ result }) => result.ok)) {
      throw new RelayOperationError(results.map(({ result }) => result));
    }
    return results;
  }

  async query(filter: Filter): Promise<RelayQueryResult> {
    const copy = this.validateFilter(filter);
    const results = await this.execute({ filter: copy });
    const events = new Map<string, Event>();
    for (const result of results)
      for (const event of result.events) events.set(event.id, event);
    return {
      events: [...events.values()],
      relays: results.map(({ result }) => result),
    };
  }

  async publish(raw: Event): Promise<RelayPublishResult> {
    const event = verifiedEvent(raw);
    if (!event)
      throw new NostrError(
        "INVALID_SIGNATURE",
        "Cannot publish an invalid or oversized event.",
      );
    const results = await this.execute({ event });
    const relays = results.map(({ result }) => result);
    return {
      eventId: event.id,
      acceptedRelays: relays
        .filter((result) => result.ok)
        .map(({ url }) => url),
      failedRelays: relays.filter(
        (result): result is Extract<RelayResult, { ok: false }> => !result.ok,
      ),
    };
  }

  private validateFilter(filter: Filter): Filter {
    const invalid = () => {
      throw new NostrError(
        "INVALID_INPUT",
        "Invalid or unbounded relay filter.",
      );
    };
    if (!filter || typeof filter !== "object" || Array.isArray(filter))
      return invalid();
    const copy: Filter = { limit: this.config.maxEventsPerRelay };
    for (const [key, value] of Object.entries(filter)) {
      if (["limit", "since", "until"].includes(key)) {
        if (
          typeof value !== "number" ||
          !Number.isSafeInteger(value) ||
          value < 0 ||
          (key === "limit" && (value < 1 || value > 1000))
        )
          return invalid();
      } else if (key === "kinds") {
        if (
          !Array.isArray(value) ||
          !value.length ||
          value.length > 20 ||
          !value.every(
            (v) =>
              typeof v === "number" &&
              Number.isInteger(v) &&
              v >= 0 &&
              v <= 65535,
          )
        )
          return invalid();
      } else if (key === "authors" || key === "ids") {
        if (
          !Array.isArray(value) ||
          !value.length ||
          value.length > 100 ||
          !value.every(isPubkey)
        )
          return invalid();
      } else if (/^#[a-zA-Z]$/.test(key)) {
        if (
          !Array.isArray(value) ||
          !value.length ||
          value.length > 100 ||
          !value.every((v) => typeof v === "string" && v.length <= 256)
        )
          return invalid();
      } else return invalid();
      Object.assign(copy, { [key]: Array.isArray(value) ? [...value] : value });
    }
    copy.limit = Math.min(copy.limit!, this.config.maxEventsPerRelay);
    return copy;
  }
}

/** No extension access or relay connection until an operation is called. */
export function createNostrClient(config?: Partial<RelayConfig>): NostrClient {
  return new NostrClient({ config });
}
