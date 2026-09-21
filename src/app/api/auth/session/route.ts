import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session
 *
 * Returns the signed-in user, or `{ user: null }` with 200. A 401 here would
 * make the ordinary signed-out case look like an error in the client.
 */
export async function GET(): Promise<Response> {
  const user = await getSession();
  return Response.json({ user }, { headers: { "cache-control": "no-store" } });
}
