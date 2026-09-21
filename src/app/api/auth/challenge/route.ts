import { issueChallenge } from "@/lib/auth/challenge";
import { isSameOrigin, jsonError, requestOrigin } from "@/lib/auth/http";
import { AUTH_EVENT_KIND, CHALLENGE_TTL_MS } from "@/lib/auth/nip42";

// `pg` needs a TCP socket and `node:crypto` is used for hashing, so this route
// cannot run on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/challenge
 *
 * Issues a single-use nonce. The caller signs it into a kind-22242 event and
 * posts that to /api/auth/verify. The nonce is stored only as a hash and is
 * redeemable once, within CHALLENGE_TTL_MS.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonError("Cross-origin request rejected.", 403);
  }

  const audience = requestOrigin(request);
  if (!audience) {
    return jsonError("Missing Host header.", 400);
  }

  const { nonce, expiresAt } = await issueChallenge();

  return Response.json(
    {
      nonce,
      expiresAt,
      // Echoed back so the caller can place it in the event's `relay` tag; the
      // verify route recomputes it and rejects a mismatch.
      audience,
      kind: AUTH_EVENT_KIND,
      expiresInMs: CHALLENGE_TTL_MS,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
