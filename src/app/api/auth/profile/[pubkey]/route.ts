import "server-only";
import { isSameOrigin, jsonError } from "@/lib/auth/http";
import { getMongo } from "@/lib/mongodb/client";
import { getProfileByPubkey } from "@/lib/mongodb/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ pubkey: string }> },
): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonError("Cross-origin request rejected.", 403);
  }

  const { pubkey } = await params;

  if (!/^[0-9a-f]{64}$/.test(pubkey)) {
    return new Response(null, { status: 404 });
  }

  await getMongo();

  const profile = await getProfileByPubkey(pubkey);
  if (!profile) {
    return new Response(null, { status: 404 });
  }

  return new Response(null, { status: 200 });
}
