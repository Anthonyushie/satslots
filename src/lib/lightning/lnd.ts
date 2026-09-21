import https from "node:https";
import type { CreateInvoiceParams, LightningInvoice } from "./client";

/**
 * LND REST API backend for local Polar / regtest testing.
 *
 * Env vars:
 *   LND_REST_URL     — e.g. https://localhost:8087 (Polar maps 8080→8087)
 *   LND_MACAROON     — hex-encoded macaroon
 *
 * Uses node:https directly to skip TLS verification for LND's self-signed cert.
 */

const LND_URL = (process.env.LND_REST_URL ?? "https://localhost:8080").replace(
  /\/$/,
  "",
);
const MACAROON = process.env.LND_MACAROON ?? "";

function lndPost(path: string, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${LND_URL}${path}`);
    const postData = JSON.stringify(body);

    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        rejectUnauthorized: false,
        headers: {
          "Grpc-Metadata-macaroon": MACAROON,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`LND ${res.statusCode}: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        });
      },
    );

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

export async function createInvoiceLnd(
  params: CreateInvoiceParams,
): Promise<LightningInvoice> {
  const data = (await lndPost("/v1/invoices", {
    value_msat: params.amountSats * 1000,
    memo: params.memo,
    expiry: String(params.expirySeconds ?? 3600),
  })) as { payment_request: string; r_hash: string };

  return {
    bolt11: data.payment_request,
    paymentHash: Buffer.from(data.r_hash, "base64").toString("hex"),
  };
}
