import { ok, route } from "@/lib/api/handler";
import { jsonError } from "@/lib/auth/http";
import { getMongo } from "@/lib/mongodb/client";
import { getPaymentByHash, updatePaymentStatus } from "@/lib/mongodb/queries";
import { checkInvoiceSettled } from "@/lib/lightning/client";
import { Booking } from "@/lib/mongodb/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/by-hash/:hash — get payment status by payment hash.
 *
 * Used by the anonymous booking flow to poll for payment confirmation.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<Response> {
  return route(async () => {
    const { hash } = await params;
    if (!hash || hash.length < 10) {
      return jsonError("Invalid payment hash.", 400);
    }

    await getMongo();

    const payment = await getPaymentByHash(hash);
    if (!payment) return jsonError("Unknown payment.", 404);

    if (payment.status === "invoiced") {
      try {
        if (await checkInvoiceSettled(payment.payment_hash)) {
          const settledAt = new Date();
          await updatePaymentStatus(payment.id, "settled", settledAt);
          await Booking.findOneAndUpdate(
            { id: payment.booking_id, status: "pending" },
            { status: "approved", updated_at: settledAt },
          );
          payment.status = "settled";
          payment.settled_at = settledAt;
        }
      } catch (error) {
        // A temporary Polar/LND outage should not turn a status poll into a false
        // payment failure; the next poll will retry the lookup.
        console.error("LND invoice lookup failed:", error);
      }
    }

    const expiresAt =
      payment.expires_at ?? new Date(payment.created_at.getTime() + 3_600_000);
    if (
      payment.status !== "settled" &&
      payment.status !== "failed" &&
      expiresAt.getTime() <= Date.now()
    ) {
      payment.status = "failed";
      payment.updated_at = new Date();
      await payment.save();
    }

    return ok({
      id: payment.id,
      bookingId: payment.booking_id,
      amountSats: payment.amount_sats,
      status: payment.status,
      paymentHash: payment.payment_hash,
      settledAt: payment.settled_at?.toISOString() ?? null,
      expiresAt: expiresAt.toISOString(),
    });
  });
}
