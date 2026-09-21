import type { Event, EventTemplate } from "nostr-tools/pure";

/**
 * NIP-42 client authentication, used here as a login challenge rather than for
 * relay access.
 *
 * The signed event is never published to a relay. It exists only to prove that
 * the caller holds the private key for a pubkey, and the `relay` tag doubles as
 * domain separation: a signature harvested by another site carries that site's
 * audience, so the server here rejects it.
 *
 * Replay is prevented server-side by single-use nonces (db/migrations/0001_init.sql),
 * not by anything in this file.
 */

export const AUTH_EVENT_KIND = 22242;

/** How long an issued nonce stays redeemable. */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Tolerance for client clock drift when checking `created_at`. Deliberately
 * tight: the nonce, not the timestamp, is what makes replay impossible.
 */
export const MAX_AUTH_CLOCK_SKEW_SECONDS = 60;

/** Nonce length in hex characters (32 random bytes). */
export const NONCE_HEX_LENGTH = 64;

export interface AuthChallenge {
  readonly nonce: string;
  readonly audience: string;
  readonly expiresAt: string;
}

export function buildAuthEventTemplate(input: {
  nonce: string;
  audience: string;
  createdAt: number;
}): EventTemplate {
  return {
    kind: AUTH_EVENT_KIND,
    created_at: input.createdAt,
    tags: [
      ["relay", input.audience],
      ["challenge", input.nonce],
    ],
    content: "",
  };
}

/** Extracts the challenge and audience from a signed auth event. */
export function readAuthTags(
  event: Event,
): { nonce: string; audience: string } | null {
  const audience = event.tags.find((tag) => tag[0] === "relay")?.[1];
  const nonce = event.tags.find((tag) => tag[0] === "challenge")?.[1];
  if (typeof audience !== "string" || typeof nonce !== "string") return null;
  return { nonce, audience };
}
