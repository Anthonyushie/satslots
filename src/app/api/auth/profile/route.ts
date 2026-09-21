import "server-only";
import { isSameOrigin, jsonError } from "@/lib/auth/http";
import { ok, requireUser, route } from "@/lib/api/handler";
import { getMongo } from "@/lib/mongodb/client";
import { upsertProfile, getProfileByPubkey } from "@/lib/mongodb/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return route(async () => {
    if (!isSameOrigin(request)) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    const auth = await requireUser();
    if (!auth.user) return auth.response;
    const pubkey = auth.user.pubkey;

    await getMongo();

    const profile = await getProfileByPubkey(pubkey);
    
    return ok({
      pubkey: profile?.pubkey || pubkey,
      username: profile?.username || null,
      bio: profile?.bio || null,
      lightning_address: profile?.lightning_address || null,
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  return route(async () => {
    if (!isSameOrigin(request)) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    const auth = await requireUser();
    if (!auth.user) return auth.response;
    const pubkey = auth.user.pubkey;

    const body = await request.json();
    const { lightningAddress, username, bio } = body as {
      lightningAddress?: string;
      username?: string;
      bio?: string;
    };

    // Validate lightning address format if provided
    if (lightningAddress && !lightningAddress.includes('@')) {
      return jsonError("Invalid lightning address format. Expected: user@domain.com", 400);
    }

    await getMongo();

    // Update or create profile with Lightning Address
    await upsertProfile(pubkey, {
      username: username || undefined,
      bio: bio || undefined,
      lightning_address: lightningAddress || undefined,
    });

    return ok({ success: true });
  });
}