import "server-only";

/**
 * Voltage API client for Lightning payment integration.
 *
 * API Reference: https://docs.voltageapi.com
 *
 * Key endpoints:
 *   POST /v1/payments       - Create invoice
 *   GET  /v1/payments/:hash - Check payment status
 *
 * Webhook: Voltage POSTs to your webhook URL when payment is received.
 */

const VOLTAGE_URL = process.env.VOLTAGE_URL;
const VOLTAGE_API_KEY = process.env.VOLTAGE_API_KEY;

if (!VOLTAGE_URL) {
  throw new Error("VOLTAGE_URL is not set.");
}
if (!VOLTAGE_API_KEY) {
  throw new Error("VOLTAGE_API_KEY is not set.");
}

/** Normalize base URL: strip trailing slash. */
const BASE_URL = VOLTAGE_URL.replace(/\/+$/, "");
const API_KEY = VOLTAGE_API_KEY;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateInvoiceParams {
  /** Amount in satoshis. */
  amountSats: number;
  /** Memo shown to the payer. */
  memo: string;
  /** Optional webhook URL for payment notification. */
  webhookUrl?: string;
  /** Optional expiry in seconds (default: 3600). */
  expirySeconds?: number;
}

export interface VoltageInvoice {
  payment_request: string;
  payment_hash: string;
  amount: number;
  memo: string;
  expiry: number;
  creation_date: number;
  expires_at: number;
}

export interface CreateInvoiceResponse {
  /** The payment hash (unique identifier). */
  payment_hash: string;
  /** The BOLT11 invoice string. */
  bolt11: string;
}

export interface PaymentStatus {
  paid: boolean;
  preimage?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
   * Create a Lightning invoice via Voltage.
   *
   * @returns The payment hash and BOLT11 invoice string.
   */
  export async function createInvoice(
    params: CreateInvoiceParams,
  ): Promise<CreateInvoiceResponse> {
    const body = {
      amount: params.amountSats.toString(),
      memo: params.memo,
      expiry: (params.expirySeconds ?? 3600).toString(),
    };

    const response = await fetch(`${BASE_URL}/v1/payments`, {
      method: "POST",
      headers: {
        "X-Api-Key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voltage create invoice failed: ${response.status} ${error}`);
  }

  const data: VoltageInvoice = await response.json();
  return {
    payment_hash: data.payment_hash,
    bolt11: data.payment_request,
  };
}

/**
 * Check if a payment has been settled.
 *
 * @returns Payment status including paid boolean and preimage if settled.
 */
export async function checkPaymentStatus(
  paymentHash: string,
): Promise<PaymentStatus> {
  const response = await fetch(
    `${BASE_URL}/v1/payments/${paymentHash}`,
    {
      headers: {
        "X-Api-Key": API_KEY,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voltage check payment failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    paid: data.paid === true,
    preimage: data.preimage,
    status: data.status,
  };
}

/**
 * Verify the webhook from Voltage.
 *
 * Voltage webhooks are identified by the presence of a payment_hash in the body.
 */
export function verifyWebhook(body: unknown): body is { payment_hash: string; amount: number; memo: string } {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.payment_hash === "string" &&
    typeof b.amount === "number"
  );
}
