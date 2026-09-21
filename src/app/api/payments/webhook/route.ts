import { jsonError } from "@/lib/auth/http";
import { getMongo } from "@/lib/mongodb/client";
import { getPaymentByHash, updatePaymentStatus } from "@/lib/mongodb/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook — payment confirmation endpoint.
 *
 * This endpoint can be called by:
 *   - A payment confirmation script
 *   - Manual confirmation for testing
 *   - Future webhook integrations
 *
 * Idempotent: Multiple calls for the same payment are safe.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).payment_hash !== "string"
  ) {
    return jsonError("Missing payment_hash.", 400);
  }

  const { payment_hash } = body as { payment_hash: string };

  try {
    await getMongo();

    const payment = await getPaymentByHash(payment_hash);
    if (!payment) {
      return Response.json({ ok: true, updated: false, reason: "unknown_payment" });
    }

    if (payment.status === "settled") {
      return Response.json({ ok: true, updated: false, reason: "already_settled" });
    }

    await updatePaymentStatus(payment.id, "settled");

    const { Booking } = await import("@/lib/mongodb/schemas");
    await Booking.findOneAndUpdate(
      { id: payment.booking_id, status: "pending" },
      { status: "approved", updated_at: new Date() },
    );

    return Response.json({ ok: true, updated: true, paymentId: payment.id });
  } catch (error) {
    console.error("webhook processing failed:", error);
    return Response.json({ ok: false, error: "internal_error" });
  }
}
