import {
  ok,
  readJson,
  requireUser,
  route,
} from "@/lib/api/handler";
import { paymentCreateSchema } from "@/lib/api/schemas";
import { isSameOrigin, jsonError } from "@/lib/auth/http";
import { getMongo } from "@/lib/mongodb/client";
import { 
  getBookingById,
  getPaymentByHash,
  createPayment,
  updatePaymentStatus,
  getListingById
} from "@/lib/mongodb/queries";
import { createInvoice } from "@/lib/lightning/client";
import { createInvoiceLightningAddress } from "@/lib/lightning/lightning-address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Booking {
  id: string;
  listing_id: string;
  advertiser_pubkey: string;
  status: string;
  starts_on: Date;
  ends_on: Date;
}

interface Listing {
  id: string;
  title: string;
  price_sats: number;
  ad_duration_days: number;
  lightning_address?: string;
}

interface Payment {
  id: string;
  booking_id: string;
  amount_sats: number;
  status: string;
  ln_invoice: string;
  payment_hash: string;
  settled_at?: Date;
  created_at: Date;
}

/**
 * POST /api/payments — create a Lightning invoice for a booking.
 *
 * The advertiser pays to confirm their booking. The invoice amount is derived
 * from the room's stored price and booking duration, never from the request.
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

    const body = await readJson(request, paymentCreateSchema);
    if (!body.data) return body.response;
    const { bookingId } = body.data;

    // Load the booking and verify the caller is the advertiser.
    const booking = await getBookingById(bookingId);
    if (!booking) return jsonError("Unknown booking.", 404);

    if (booking.advertiser_pubkey !== pubkey) {
      return jsonError("Only the advertiser can pay for a booking.", 403);
    }

    // Only pending bookings can be paid for.
    if (booking.status !== "pending") {
      return jsonError(
        `A booking that is ${booking.status} cannot be paid.`,
        409,
      );
    }

    // Load the listing to get room details
    const listing = await getListingById(booking.listing_id);
    if (!listing) return jsonError("Unknown listing.", 404);

    // Calculate the amount from the room's stored price.
    const start = booking.starts_on.getTime();
    const end = booking.ends_on.getTime();
    const days = Math.round((end - start) / 86_400_000) + 1;
    const amountSats = days * listing.price_sats;

    if (amountSats <= 0) {
      return jsonError("Invalid booking amount.", 500);
    }

    // Check for an existing unpaid payment (idempotent).
    const { Payment } = await import("@/lib/mongodb/schemas");
    const existingPayment = await Payment.findOne({
      booking_id: bookingId,
      status: { $in: ['pending', 'invoiced'] }
    }).sort({ created_at: -1 });

    if (existingPayment && existingPayment.ln_invoice && existingPayment.payment_hash) {
      return ok({
        paymentId: existingPayment.id,
        invoice: existingPayment.ln_invoice,
        paymentHash: existingPayment.payment_hash,
        amountSats: existingPayment.amount_sats,
        status: existingPayment.status,
      });
    }

    // Create the invoice - use Lightning Address if available, otherwise use NWC
    let invoice;
    try {
      if (listing.lightning_address) {
        // Use publisher's Lightning Address
        invoice = await createInvoiceLightningAddress({
          lightningAddress: listing.lightning_address,
          amountSats,
          description: `SatSlots: ${listing.title} (${booking.starts_on.toISOString().slice(0, 10)} to ${booking.ends_on.toISOString().slice(0, 10)})`,
        });
      } else {
        // Fall back to central NWC wallet
        invoice = await createInvoice({
          amountSats,
          memo: `SatSlots: ${listing.title} (${booking.starts_on.toISOString().slice(0, 10)} to ${booking.ends_on.toISOString().slice(0, 10)})`,
          expirySeconds: 3600,
        });
      }
    } catch (invoiceError) {
      console.error('Failed to create invoice:', invoiceError);
      return jsonError('Failed to create invoice. Please try again.', 500);
    }

    // Store the payment record.
    const payment = await createPayment({
      id: require("crypto").randomUUID(),
      booking_id: bookingId,
      amount_sats: amountSats,
      status: 'invoiced',
      ln_invoice: invoice.bolt11,
      payment_hash: invoice.paymentHash,
    });

    if (!payment) {
      return jsonError("Failed to create payment record.", 500);
    }

    return ok({
      paymentId: payment.id,
      invoice: invoice.bolt11,
      paymentHash: invoice.paymentHash,
      amountSats,
      status: "invoiced",
    }, 201);
  });
}
