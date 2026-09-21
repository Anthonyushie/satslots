import { ok, route } from "@/lib/api/handler";
import { jsonError } from "@/lib/auth/http";
import { getMongo } from "@/lib/mongodb/client";
import { getPaymentByHash } from "@/lib/mongodb/queries";

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

    return ok({
      id: payment.id,
      bookingId: payment.booking_id,
      amountSats: payment.amount_sats,
      status: payment.status,
      paymentHash: payment.payment_hash,
      settledAt: payment.settled_at?.toISOString() ?? null,
    });
  });
}
