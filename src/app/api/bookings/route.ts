import {
  ok,
  readJson,
  requireUser,
  route,
} from "@/lib/api/handler";
import { bookingCreateSchema } from "@/lib/api/schemas";
import { isSameOrigin, jsonError } from "@/lib/auth/http";
import { getMongo } from "@/lib/mongodb/client";
import { 
  getBookingByAdId,
  getListingById,
  listingOverlappingAds,
  createBooking,
  getBookingById,
  updateBookingStatus,
  getListingsByPubkey
} from "@/lib/mongodb/queries";
import { Listing as ListingModel } from "@/lib/mongodb/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Adds whole days to a YYYY-MM-DD string in UTC, so no timezone can shift it. */
function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Booking {
  id: string;
  listing_id: string;
  advertiser_pubkey: string;
  ad_id: string;
  status: string;
  starts_on: Date;
  ends_on: Date;
  created_at: Date;
  updated_at: Date;
  image_url?: string;
  website_url?: string;
}

interface Room {
  id: string;
  pubkey: string;
  ad_duration_days: number;
  max_ads: number;
  title: string;
  price_sats: number;
}

/** Outcome of the create, mapped to a status code once the transaction has closed. */
type CreateOutcome =
  | { kind: "created"; booking: Booking }
  | { kind: "exists"; booking: Booking }
  | { kind: "unknown-room" }
  | { kind: "own-room" }
  | { kind: "full" };

/**
 * GET /api/bookings — both sides of the caller's deals.
 *
 * `booked` are bookings the caller made; `incoming` are bookings on rooms the
 * caller owns.
 */
export async function GET(): Promise<Response> {
  return route(async () => {
    await getMongo();
    
    const auth = await requireUser();
    if (!auth.user) return auth.response;
    const pubkey = auth.user.pubkey;

    const { Booking } = await import("@/lib/mongodb/schemas");

    // Get bookings made by the caller
    const booked = await Booking.find({ advertiser_pubkey: pubkey })
      .sort({ created_at: -1 });

    // Get bookings on rooms owned by the caller
    const myListings = await getListingsByPubkey(pubkey);
    const myListingIds = myListings.map(l => l.id);
    const incoming = await Booking.find({ listing_id: { $in: myListingIds } })
      .sort({ created_at: -1 });

    return ok({
      booked: booked.map(b => ({
        id: b.id,
        listingId: b.listing_id,
        advertiserPubkey: b.advertiser_pubkey,
        adId: b.ad_id,
        status: b.status,
        startsOn: b.starts_on.toISOString().slice(0, 10),
        endsOn: b.ends_on.toISOString().slice(0, 10),
        imageUrl: b.image_url,
        websiteUrl: b.website_url,
        createdAt: b.created_at,
        updatedAt: b.updated_at
      })),
      incoming: incoming.map(b => ({
        id: b.id,
        listingId: b.listing_id,
        advertiserPubkey: b.advertiser_pubkey,
        adId: b.ad_id,
        status: b.status,
        startsOn: b.starts_on.toISOString().slice(0, 10),
        endsOn: b.ends_on.toISOString().slice(0, 10),
        imageUrl: b.image_url,
        websiteUrl: b.website_url,
        createdAt: b.created_at,
        updatedAt: b.updated_at
      })),
    });
  });
}

/**
 * POST /api/bookings — take a room's slot for a date range.
 *
 * First come, first serve, at the room's capacity. The room's ad length decides the
 * end date and its stored price decides the cost; neither is read from the request.
 */
export async function POST(request: Request): Promise<Response> {
  return route(async () => {
    await getMongo();
    
    if (!isSameOrigin(request)) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    const auth = await requireUser();
    if (!auth.user) return auth.response;
    const pubkey = auth.user.pubkey;

    const body = await readJson(request, bookingCreateSchema);
    if (!body.data) return body.response;
    const { adId, listingId, startsOn } = body.data;

    if (startsOn < today()) {
      return jsonError("The start date cannot be in the past.", 400);
    }

    // Check for existing booking with same ad_id (idempotent)
    const existing = await getBookingByAdId(adId);
    if (existing && existing.advertiser_pubkey === pubkey) {
      return ok({
        booking: {
          id: existing.id,
          listingId: existing.listing_id,
          advertiserPubkey: existing.advertiser_pubkey,
          adId: existing.ad_id,
          status: existing.status,
          startsOn: existing.starts_on.toISOString().slice(0, 10),
          endsOn: existing.ends_on.toISOString().slice(0, 10),
          imageUrl: existing.image_url,
          websiteUrl: existing.website_url,
          createdAt: existing.created_at,
          updatedAt: existing.updated_at
        }
      });
    }

    // Load the room details
    const room = await getListingById(listingId);
    if (!room) return jsonError("Unknown room.", 404);

    // Booking your own room is almost always a mistake, and it would let an
    // owner fill their own capacity.
    if (room.pubkey === pubkey) return jsonError("You cannot book your own room.", 409);

    const endsOn = addDays(startsOn, room.ad_duration_days - 1);

    // Check capacity
    const startDate = new Date(`${startsOn}T00:00:00Z`);
    const endDate = new Date(`${endsOn}T00:00:00Z`);
    const taken = await listingOverlappingAds(listingId, startDate, endDate);

    if (taken >= room.max_ads) {
      return jsonError("That slot is already taken.", 409);
    }

    // Create the booking
    try {
      const booking = await createBooking({
        id: require("crypto").randomUUID(),
        listing_id: listingId,
        advertiser_pubkey: pubkey,
        ad_id: adId,
        status: 'pending',
        starts_on: startDate,
        ends_on: endDate,
      });

      return ok({
        booking: {
          id: booking.id,
          listingId: booking.listing_id,
          advertiserPubkey: booking.advertiser_pubkey,
          adId: booking.ad_id,
          status: booking.status,
          startsOn: booking.starts_on.toISOString().slice(0, 10),
          endsOn: booking.ends_on.toISOString().slice(0, 10),
          imageUrl: booking.image_url,
          websiteUrl: booking.website_url,
          createdAt: booking.created_at,
          updatedAt: booking.updated_at
        }
      }, 201);
    } catch (error: any) {
      if (error.code === 11000) {
        // Duplicate key error - likely a race condition
        const existing = await getBookingByAdId(adId);
        if (existing && existing.advertiser_pubkey === pubkey) {
          return ok({
            booking: {
              id: existing.id,
              listingId: existing.listing_id,
              advertiserPubkey: existing.advertiser_pubkey,
              adId: existing.ad_id,
              status: existing.status,
              startsOn: existing.starts_on.toISOString().slice(0, 10),
              endsOn: existing.ends_on.toISOString().slice(0, 10),
              imageUrl: existing.image_url,
              websiteUrl: existing.website_url,
              createdAt: existing.created_at,
              updatedAt: existing.updated_at
            }
          });
        }
        return jsonError("You already have a booking with that ad ID.", 409);
      }
      throw error;
    }
  });
}
