import { ok, readJson, route } from "@/lib/api/handler";
import { anonymousBookingSchema } from "@/lib/api/schemas";
import { jsonError } from "@/lib/auth/http";
import { createInvoice } from "@/lib/lightning/client";
import { createInvoiceLightningAddress } from "@/lib/lightning/lightning-address";
import crypto from "crypto";
import { getMongo } from "@/lib/mongodb/client";
import { 
  getListingById, 
  listingOverlappingAds, 
  getBookingByAdId,
  createBooking,
  createPayment
} from "@/lib/mongodb/queries";
import { Listing as ListingModel } from "@/lib/mongodb/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * System pubkey for anonymous bookings.
 * Must exist in the profiles table (created by 0015_anonymous_profile.sql).
 */
const ANON_PUBKEY = "0000000000000000000000000000000000000000000000000000000000000000";

interface RoomRow {
  id: string;
  pubkey: string;
  ad_duration_days: number;
  max_ads: number;
  title: string;
  price_sats: number;
  lightning_address: string | null;
}

interface BookingRow {
  id: string;
  listing_id: string;
  advertiser_pubkey: string;
  ad_id: string;
  status: string;
  starts_on: Date;
  ends_on: Date;
  created_at: Date;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /api/bookings/anonymous — create a booking without auth.
 *
 * The advertiser provides an email and pays via Lightning. The booking is
 * identified by the payment hash and confirmed when payment is received.
 */
export async function POST(request: Request): Promise<Response> {
  return route(async () => {
    const body = await readJson(request, anonymousBookingSchema);
    if (!body.data) return body.response;
    const { listingId, startsOn, contactEmail, adName, imageUrl, websiteUrl } = body.data;

    if (startsOn < today()) {
      return jsonError("The start date cannot be in the past.", 400);
    }

    // Ensure MongoDB connection
    await getMongo();

    // Load the room details with lightning address.
    const room = await getListingById(listingId);
    if (!room) return jsonError("Unknown room.", 404);

    const endsOn = addDays(startsOn, room.ad_duration_days - 1);

    // Check capacity.
    const startDate = new Date(`${startsOn}T00:00:00Z`);
    const endDate = new Date(`${endsOn}T00:00:00Z`);
    const taken = await listingOverlappingAds(listingId, startDate, endDate);

    if (taken >= room.max_ads) {
      return jsonError("That slot is already taken.", 409);
    }

    // Generate a unique ad_id for this anonymous booking.
    const adId = adName || `anon-${crypto.randomBytes(8).toString("base64url")}`;

    // Use the system anonymous pubkey (must exist in profiles table).
    const anonPubkey = ANON_PUBKEY;

    // Check for existing booking with same ad_id (idempotent).
    const existing = await getBookingByAdId(adId);
    if (existing) {
      return ok({
        bookingId: existing.id,
        invoice: "",
        paymentHash: "",
        amountSats: 0,
        days: 0,
        roomTitle: room.title,
        startsOn: existing.starts_on.toISOString().slice(0, 10),
        endsOn: existing.ends_on.toISOString().slice(0, 10),
      }, 200);
    }

    // Insert the booking.
    const booking = await createBooking({
      id: crypto.randomUUID(),
      listing_id: listingId,
      advertiser_pubkey: anonPubkey,
      ad_id: adId,
      status: 'pending',
      starts_on: startDate,
      ends_on: endDate,
      image_url: imageUrl ?? null,
      website_url: websiteUrl ?? null,
    });

    if (!booking) {
      return jsonError("Failed to create booking.", 500);
    }

    // Calculate payment amount.
    const start = Date.parse(booking.starts_on.toISOString());
    const end = Date.parse(booking.ends_on.toISOString());
    const days = Math.round((end - start) / 86_400_000) + 1;
    const amountSats = days * room.price_sats;

    // Create invoice - use Lightning Address if available, otherwise use NWC
    let invoice;
    try {
      if (room.lightning_address) {
        // Use publisher's Lightning Address
        invoice = await createInvoiceLightningAddress({
          lightningAddress: room.lightning_address,
          amountSats,
          description: `SatSlots: ${room.title} (${booking.starts_on.toISOString().slice(0, 10)} to ${booking.ends_on.toISOString().slice(0, 10)})`,
        });
      } else {
        // Fall back to central NWC wallet
        invoice = await createInvoice({
          amountSats,
          memo: `SatSlots: ${room.title} (${booking.starts_on.toISOString().slice(0, 10)} to ${booking.ends_on.toISOString().slice(0, 10)})`,
          expirySeconds: 3600,
        });
      }
    } catch (invoiceError) {
      console.error('Failed to create invoice:', invoiceError);
      return jsonError('Failed to create invoice. Please try again.', 500);
    }

    // Store the payment record.
    await createPayment({
      id: crypto.randomUUID(),
      booking_id: booking.id,
      amount_sats: amountSats,
      status: 'invoiced',
      ln_invoice: invoice.bolt11,
      payment_hash: invoice.paymentHash,
    });

    return ok({
      bookingId: booking.id,
      invoice: invoice.bolt11,
      paymentHash: invoice.paymentHash || '',
      amountSats,
      days,
      roomTitle: room.title,
      startsOn: booking.starts_on.toISOString().slice(0, 10),
      endsOn: booking.ends_on.toISOString().slice(0, 10),
    }, 201);
  });
}
