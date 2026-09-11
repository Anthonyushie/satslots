import {
  finalizeEvent,
  getPublicKey,
  type Event,
  type EventTemplate,
} from "nostr-tools/pure";
import type { Filter } from "nostr-tools/filter";
import { NostrClient, type RelayConnection } from "./client";
import type { ListingInput } from "./types";

// Public, deterministic TEST-ONLY keys. Never import fixtures into production.
export const testKey = new Uint8Array(32).fill(1);
export const otherKey = new Uint8Array(32).fill(2);
export const pubkey = getPublicKey(testKey);
export const otherPubkey = getPublicKey(otherKey);
export const now = Math.floor(Date.now() / 1000) - 10;
export const input: ListingInput = {
  listingId: "test-listing",
  name: "Test publication",
  category: "Bitcoin",
  description: "A test sponsorship listing.",
  priceSats: 5000,
  websiteUrl: "https://example.com",
  audience: "Developers",
};
export function signed(template: EventTemplate, key = testKey): Event {
  return finalizeEvent(template, key);
}
export const provider = {
  async getPublicKey() {
    return pubkey;
  },
  async signEvent(template: EventTemplate) {
    return signed(template);
  },
};
export const A = "wss://relay.damus.io";
export const B = "wss://nos.lol";
export const C = "wss://relay.nostr.band";

type Mode =
  | "ok"
  | "connect-fail"
  | "connect-stall"
  | "query-stall"
  | "query-close"
  | "socket-close"
  | "publish-fail"
  | "publish-stall";
export class MockRelay implements RelayConnection {
  onclose: (() => void) | null = null;
  publishTimeout = 0;
  closed = false;
  subscriptionClosed = false;
  signal?: AbortSignal;
  filters: Filter[] = [];
  published: Event[] = [];
  constructor(
    readonly mode: Mode = "ok",
    readonly events: Event[] = [],
  ) {}
  async connect({ abort }: { timeout: number; abort: AbortSignal }) {
    this.signal = abort;
    if (this.mode === "connect-fail") throw new Error("No connection");
    if (this.mode === "connect-stall")
      await new Promise<void>((_, reject) => {
        abort.addEventListener("abort", () => reject(new Error("Aborted")), {
          once: true,
        });
      });
  }
  async publish(event: Event) {
    this.published.push(event);
    if (this.mode === "publish-fail") throw new Error("auth-required");
    if (this.mode === "publish-stall")
      await new Promise<void>((_, reject) => {
        this.signal?.addEventListener(
          "abort",
          () => reject(new Error("Aborted")),
          { once: true },
        );
      });
    return "accepted";
  }
  subscribe(
    filters: Filter[],
    params: Parameters<RelayConnection["subscribe"]>[1],
  ) {
    this.filters = filters;
    queueMicrotask(() => {
      if (this.closed) return;
      if (this.mode === "socket-close") {
        this.onclose?.();
        return;
      }
      if (this.mode === "query-close") {
        params.onclose("auth-required");
        return;
      }
      for (const event of this.events) params.onevent(event);
      if (this.mode !== "query-stall") params.oneose();
    });
    return {
      close: () => {
        this.subscriptionClosed = true;
        params.onclose("closed by client");
      },
    };
  }
  close() {
    this.closed = true;
  }
}

export function mockClient(
  relays: Record<string, MockRelay>,
  maxEventsPerRelay = 200,
) {
  const calls: string[] = [];
  const client = new NostrClient({
    config: {
      primary: [A, B],
      fallback: [C],
      timeoutMs: 100,
      maxEventsPerRelay,
    },
    relayFactory: (url) => {
      calls.push(url);
      return relays[url] ?? new MockRelay();
    },
  });
  return { client, calls };
}
