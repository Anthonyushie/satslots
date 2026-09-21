import "server-only";

/**
 * Lightning invoice creation.
 *
 * Backend selected by LIGHTNING_BACKEND env var:
 *   "lnd"  — LND REST API  (local Polar / regtest)
 *   "nwc"  — Nostr Wallet Connect (production)
 */

export interface LightningInvoice {
  bolt11: string;
  paymentHash: string;
}

export interface CreateInvoiceParams {
  amountSats: number;
  memo: string;
  expirySeconds?: number;
}

export async function createInvoice(
  params: CreateInvoiceParams,
): Promise<LightningInvoice> {
  const backend = process.env.LIGHTNING_BACKEND ?? "nwc";

  if (backend === "lnd") {
    const { createInvoiceLnd } = await import("./lnd");
    return createInvoiceLnd(params);
  }

  const { createInvoiceNwc } = await import("./nwc");
  return createInvoiceNwc(params);
}
