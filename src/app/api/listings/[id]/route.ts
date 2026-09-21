import {
  ok,
  readJson,
  requireUser,
  route,
} from "@/lib/api/handler";
import { listingUpdateSchema } from "@/lib/api/schemas";
import { isSameOrigin, jsonError } from "@/lib/auth/http";
import { getMongo } from "@/lib/mongodb/client";
import { getListingById, updateListing, deleteListing } from "@/lib/mongodb/queries";
import { Booking } from "@/lib/mongodb/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/listings/:id — public single room. */
export async function GET(
  _request: Request,
  { params }: Context,
): Promise<Response> {
  return route(async () => {
    const { id } = await params;
    if (!UUID.test(id)) return jsonError("Unknown room.", 404);

    await getMongo();
    const listing = await getListingById(id);
    if (!listing) return jsonError("Unknown room.", 404);

    return ok({
      listing: {
        id: listing.id,
        pubkey: listing.pubkey,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        priceSats: listing.price_sats,
        websiteUrl: listing.website_url,
        audience: listing.audience,
        adDurationDays: listing.ad_duration_days,
        maxAds: listing.max_ads,
        imageUrl: listing.image_url,
        lightningAddress: listing.lightning_address,
        createdAt: listing.created_at.toISOString(),
        updatedAt: listing.updated_at.toISOString(),
      },
    });
  });
}

/** PATCH /api/listings/:id — owner-only edit. */
export async function PATCH(
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

    const body = await readJson(request, listingUpdateSchema);
    if (!body.data) return body.response;

    await getMongo();

    const existing = await getListingById(id);
    if (!existing) return jsonError("Unknown room.", 404);
    if (existing.pubkey !== auth.user.pubkey) return jsonError("Unknown room.", 404);

    const patch = body.data;
    const updateData: Record<string, any> = {};
    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.description !== undefined) updateData.description = patch.description;
    if (patch.category !== undefined) updateData.category = patch.category;
    if (patch.priceSats !== undefined) updateData.price_sats = patch.priceSats;
    if (patch.websiteUrl !== undefined) updateData.website_url = patch.websiteUrl;
    if (patch.audience !== undefined) updateData.audience = patch.audience;
    if (patch.adDurationDays !== undefined) updateData.ad_duration_days = patch.adDurationDays;
    if (patch.maxAds !== undefined) updateData.max_ads = patch.maxAds;

    const updated = await updateListing(id, updateData);
    if (!updated) return jsonError("Unknown room.", 404);

    return ok({
      listing: {
        id: updated.id,
        pubkey: updated.pubkey,
        title: updated.title,
        description: updated.description,
        category: updated.category,
        priceSats: updated.price_sats,
        websiteUrl: updated.website_url,
        audience: updated.audience,
        adDurationDays: updated.ad_duration_days,
        maxAds: updated.max_ads,
        imageUrl: updated.image_url,
        lightningAddress: updated.lightning_address,
        createdAt: updated.created_at.toISOString(),
        updatedAt: updated.updated_at.toISOString(),
      },
    });
  });
}

/** DELETE /api/listings/:id — owner-only removal. */
export async function DELETE(
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

    await getMongo();

    const existing = await getListingById(id);
    if (!existing) return jsonError("Unknown room.", 404);
    if (existing.pubkey !== auth.user.pubkey) return jsonError("Unknown room.", 404);

    // Check for existing bookings
    const bookingCount = await Booking.countDocuments({ listing_id: id });
    if (bookingCount > 0) {
      return jsonError(
        "This room has bookings and cannot be deleted. Cancel them first.",
        409,
      );
    }

    await deleteListing(id);
    return ok({ deleted: id });
  });
}
