import { ok, requireUser, route } from "@/lib/api/handler";
import { jsonError } from "@/lib/auth/http";
import { getMongo } from "@/lib/mongodb/client";
import { getPaymentByHash } from "@/lib/mongodb/queries";
import { Payment } from "@/lib/mongodb/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/payments/:id — get payment status.
 *
 * Returns the current payment status including whether it has been settled.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return route(async () => {
    const auth = await requireUser();
    if (!auth.user) return auth.response;

    const { id } = await params;
    if (!UUID.test(id)) return jsonError("Unknown payment.", 404);

    await getMongo();

    const payment = await Payment.findOne({ id });
    if (!payment) return jsonError("Unknown payment.", 404);

    return ok({
      id: payment.id,
      bookingId: payment.booking_id,
      amountSats: payment.amount_sats,
      status: payment.status,
      invoice: payment.ln_invoice,
      paymentHash: payment.payment_hash,
      settledAt: payment.settled_at?.toISOString() ?? null,
      createdAt: payment.created_at.toISOString(),
    });
  });
}
