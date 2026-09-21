import {
  ok,
  readJson,
  requireUser,
  route,
} from "@/lib/api/handler";
import { listingEventSchema } from "@/lib/api/schemas";
import { isSameOrigin, jsonError } from "@/lib/auth/http";
import { getMongo } from "@/lib/mongodb/client";
import { getListingById, updateListing } from "@/lib/mongodb/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/listings/:id/event — record the relay id of the published listing.
 */
export async function POST(
  request: Request,
  { params }: Context,
): Promise<Response> {
  return route(async () => {
    if (!isSameOrigin(request)) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    const auth = await requireUser();
    if (!auth.user) return auth.response;

    const { id } = await params;
    if (!UUID.test(id)) return jsonError("Unknown room.", 404);

    const body = await readJson(request, listingEventSchema);
    if (!body.data) return body.response;

    await getMongo();

    const existing = await getListingById(id);
    if (!existing) return jsonError("Unknown room.", 404);
    if (existing.pubkey !== auth.user.pubkey) return jsonError("Unknown room.", 404);

    const updated = await updateListing(id, { event_id: body.data.eventId });
    if (!updated) return jsonError("Unknown room.", 404);

    return ok({ eventId: body.data.eventId });
  });
}
