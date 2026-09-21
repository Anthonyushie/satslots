import { isSameOrigin, jsonError } from "@/lib/auth/http";
import { revokeSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 *
 * Revokes the session row and clears the cookie. Idempotent: signing out twice
 * is not an error.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonError("Cross-origin request rejected.", 403);
  }
  await revokeSession();
  return Response.json(
    { user: null },
    { headers: { "cache-control": "no-store" } },
  );
}
