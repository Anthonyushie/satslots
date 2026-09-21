import { ok, readJson, requireUser, route } from "@/lib/api/handler";
import { bookingUpdateSchema } from "@/lib/api/schemas";
import { isSameOrigin, jsonError } from "@/lib/auth/http";
import { getMongo } from "@/lib/mongodb/client";
import {
  getBookingById,
  getListingById,
  updateBookingStatus,
} from "@/lib/mongodb/queries";
import { Booking, Listing, Profile } from "@/lib/mongodb/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Role = "advertiser" | "publisher";

const ALLOWED: Record<string, readonly Role[]> = {
  "pending->approved": ["publisher"],
  "pending->rejected": ["publisher"],
  "pending->cancelled": ["advertiser", "publisher"],
  "approved->completed": ["advertiser", "publisher"],
  "approved->cancelled": ["advertiser", "publisher"],
};

/** GET /api/bookings/:id — a single booking, for the receipt view. */
export async function GET(
  _request: Request,
  { params }: Context,
): Promise<Response> {
  return route(async () => {
    const auth = await requireUser();
    if (!auth.user) return auth.response;

    const { id } = await params;
    if (!UUID.test(id)) return jsonError("Unknown booking.", 404);

    await getMongo();

    const booking = await getBookingById(id);
    if (!booking) return jsonError("Unknown booking.", 404);

    const listing = await getListingById(booking.listing_id);
    const publisherProfile = listing
      ? await Profile.findOne({ pubkey: listing.pubkey })
      : null;

    const bookingData = {
      id: booking.id,
      adId: booking.ad_id,
      status: booking.status,
      advertiserPubkey: booking.advertiser_pubkey,
      listingId: booking.listing_id,
      startsOn: booking.starts_on.toISOString().slice(0, 10),
      endsOn: booking.ends_on.toISOString().slice(0, 10),
      imageUrl: booking.image_url,
      websiteUrl: booking.website_url,
      createdAt: booking.created_at.toISOString(),
      updatedAt: booking.updated_at.toISOString(),
      room: {
        id: booking.listing_id,
        title: listing?.title ?? "Unknown",
        category: listing?.category ?? "",
        publisherPubkey: listing?.pubkey ?? "",
        publisherUsername: publisherProfile?.username ?? "",
        priceSats: listing?.price_sats ?? 0,
        adDurationDays: listing?.ad_duration_days ?? 1,
        imageUrl: listing?.image_url ?? null,
      },
    };

    const start = Date.parse(bookingData.startsOn + "T00:00:00Z");
    const end = Date.parse(bookingData.endsOn + "T00:00:00Z");
    const days = Math.round((end - start) / 86_400_000) + 1;
    const receipt = {
      reference: bookingData.id,
      days,
      dailyPriceSats: bookingData.room.priceSats,
      totalSats: days * bookingData.room.priceSats,
    };

    return ok({ booking: bookingData, receipt });
  });
}

/**
 * PATCH /api/bookings/:id — advance a booking's status.
 */
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
    const pubkey = auth.user.pubkey;

    const { id } = await params;
    if (!UUID.test(id)) return jsonError("Unknown booking.", 404);

    const body = await readJson(request, bookingUpdateSchema);
    if (!body.data) return body.response;
    const next = body.data.status;

    await getMongo();

    const booking = await getBookingById(id);
    if (!booking) return jsonError("Unknown booking.", 404);

    const role: Role =
      booking.advertiser_pubkey === pubkey ? "advertiser" : "publisher";

    const permitted = ALLOWED[`${booking.status}->${next}`];
    if (!permitted) {
      return jsonError(
        `A booking that is ${booking.status} cannot become ${next}.`,
        409,
      );
    }
    if (!permitted.includes(role)) {
      return jsonError(
        role === "advertiser"
          ? "Only the room's owner can do that."
          : "Only the advertiser can do that.",
        403,
      );
    }

    const updated = await updateBookingStatus(id, next);
    if (!updated) return jsonError("Unknown booking.", 404);

    const listing = await getListingById(updated.listing_id);
    const publisherProfile = listing
      ? await Profile.findOne({ pubkey: listing.pubkey })
      : null;

    const bookingData = {
      id: updated.id,
      adId: updated.ad_id,
      status: updated.status,
      advertiserPubkey: updated.advertiser_pubkey,
      listingId: updated.listing_id,
      startsOn: updated.starts_on.toISOString().slice(0, 10),
      endsOn: updated.ends_on.toISOString().slice(0, 10),
      imageUrl: updated.image_url,
      websiteUrl: updated.website_url,
      createdAt: updated.created_at.toISOString(),
      updatedAt: updated.updated_at.toISOString(),
      room: {
        id: updated.listing_id,
        title: listing?.title ?? "Unknown",
        category: listing?.category ?? "",
        publisherPubkey: listing?.pubkey ?? "",
        publisherUsername: publisherProfile?.username ?? "",
        priceSats: listing?.price_sats ?? 0,
        adDurationDays: listing?.ad_duration_days ?? 1,
        imageUrl: listing?.image_url ?? null,
      },
    };

    const start = Date.parse(bookingData.startsOn + "T00:00:00Z");
    const end = Date.parse(bookingData.endsOn + "T00:00:00Z");
    const days = Math.round((end - start) / 86_400_000) + 1;
    const receipt = {
      reference: bookingData.id,
      days,
      dailyPriceSats: bookingData.room.priceSats,
      totalSats: days * bookingData.room.priceSats,
    };

    return ok({ booking: bookingData, receipt });
  });
}
