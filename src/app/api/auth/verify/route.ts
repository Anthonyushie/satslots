import { consumeChallenge } from "@/lib/auth/challenge";
import {
  hostOf,
  isSameOrigin,
  jsonError,
  requestOrigin,
} from "@/lib/auth/http";
import {
  AUTH_EVENT_KIND,
  MAX_AUTH_CLOCK_SKEW_SECONDS,
  readAuthTags,
} from "@/lib/auth/nip42";
import { createSession, ensureProfile } from "@/lib/auth/session";
import { verifiedEvent } from "@/lib/nostr/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify
 *
 * Body: { event: <signed kind-22242 event>, username?: string }
 *
 * Checks are ordered cheapest-and-most-fundamental first, and the nonce is
 * redeemed only after the signature verifies — otherwise an unauthenticated
 * caller could burn nonces at will and lock out legitimate sign-ins.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonError("Cross-origin request rejected.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON body.", 400);
  }
  if (typeof body !== "object" || body === null) {
    return jsonError("Expected a JSON object.", 400);
  }
  const { event: rawEvent, username } = body as {
    event?: unknown;
    username?: unknown;
  };

  // Structural validation plus signature verification. `verifiedEvent` copies
  // the wire fields before calling verifyEvent, so a tampered event cannot ride
  // a cached verification result.
  const event = verifiedEvent(rawEvent);
  if (!event) {
    return jsonError(
      "The signed event is malformed or has an invalid signature.",
      401,
    );
  }

  if (event.kind !== AUTH_EVENT_KIND) {
    return jsonError("Unexpected event kind for authentication.", 401);
  }

  const tags = readAuthTags(event);
  if (!tags) {
    return jsonError(
      "The auth event is missing its challenge or relay tag.",
      401,
    );
  }

  // Domain separation: the signature must be bound to this origin, so a
  // signature harvested by another site cannot be presented here.
  const expectedOrigin = requestOrigin(request);
  if (!expectedOrigin || hostOf(tags.audience) !== hostOf(expectedOrigin)) {
    return jsonError("The auth event was signed for a different origin.", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - event.created_at) > MAX_AUTH_CLOCK_SKEW_SECONDS) {
    return jsonError(
      "The auth event timestamp is outside the accepted window.",
      401,
    );
  }

  // Single-use. Returns false for unknown, already-redeemed, or expired nonces,
  // and cannot be raced: the guard lives in the UPDATE's WHERE clause.
  if (!(await consumeChallenge(tags.nonce))) {
    return jsonError("The challenge has expired or was already used.", 401);
  }

  // `username` is a client-supplied hint from the kind-0 profile. ensureProfile
  // validates it and never lets it overwrite an existing profile's name.
  const user = await ensureProfile(event.pubkey, username);
  await createSession(event.pubkey);

  return Response.json({ user }, { headers: { "cache-control": "no-store" } });
}
