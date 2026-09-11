import { NostrError, type RelayConfig } from "./types";

const defaults: RelayConfig = {
  primary: ["wss://relay.damus.io", "wss://nos.lol"],
  fallback: ["wss://relay.nostr.band", "wss://nostr.wine"],
  timeoutMs: 5000,
  maxEventsPerRelay: 200,
};

/** Public relays are best-effort; operators may change access policies. */
export function getRelayConfig(
  overrides: Partial<RelayConfig> = {},
): RelayConfig {
  const config = { ...defaults, ...overrides };
  if (
    !Number.isSafeInteger(config.timeoutMs) ||
    config.timeoutMs < 100 ||
    config.timeoutMs > 30_000 ||
    !Number.isSafeInteger(config.maxEventsPerRelay) ||
    config.maxEventsPerRelay < 1 ||
    config.maxEventsPerRelay > 1000 ||
    !Array.isArray(config.primary) ||
    !Array.isArray(config.fallback) ||
    config.primary.length + config.fallback.length > 8
  )
    throw new NostrError("INVALID_INPUT", "Invalid relay configuration.");

  const seen = new Set<string>();
  function normalize(urls: readonly string[]): readonly string[] {
    return Object.freeze(
      urls.flatMap((value) => {
        try {
          const url = new URL(value);
          if (
            typeof value !== "string" ||
            value.length > 2048 ||
            url.protocol !== "wss:" ||
            !url.hostname ||
            url.username ||
            url.password ||
            url.hash
          )
            throw new Error("Invalid relay URL");
          const normalized = url.href.replace(/\/$/, "");
          if (seen.has(normalized)) return [];
          seen.add(normalized);
          return [normalized];
        } catch {
          throw new NostrError(
            "INVALID_INPUT",
            "Relays must be credential-free wss URLs without fragments.",
          );
        }
      }),
    );
  }
  const primary = normalize(config.primary);
  const fallback = normalize(config.fallback);
  if (!primary.length)
    throw new NostrError(
      "INVALID_INPUT",
      "At least one primary relay is required.",
    );
  return Object.freeze({ ...config, primary, fallback });
}
