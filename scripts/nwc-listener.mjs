#!/usr/bin/env node

/**
 * NWC payment listener.
 *
 * Subscribes to the wallet relay for kind 23195 (NWC response) events.
 * When a payment_received notification arrives, decrypts it and calls
 * the webhook endpoint to update the payment status in the database.
 *
 * Usage:
 *   node --env-file-if-exists=.env scripts/nwc-listener.mjs
 *
 * Env vars:
 *   NWC_CONNECTION_STRING — your wallet's NWC connection string
 *   NEXT_PUBLIC_APP_URL   — base URL of the app (default: http://localhost:3000)
 */

import { hexToBytes } from "@noble/hashes/utils";
import { encrypt, decrypt } from "nostr-tools/nip04";
import { finalizeEvent } from "nostr-tools/pure";

const NWC_REQUEST_KIND = 23194;
const NWC_RESPONSE_KIND = 23195;

const NWC_URI = process.env.NWC_CONNECTION_STRING;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!NWC_URI) {
  console.error("NWC_CONNECTION_STRING is not set.");
  process.exit(1);
}

function parseNwcUri(uri) {
  const url = new URL(uri.replace("nostr+walletconnect://", "https://"));
  const walletPubkey = url.hostname || url.pathname.replace("//", "");
  const relays = url.searchParams.getAll("relay");
  const secret = url.searchParams.get("secret");

  if (!walletPubkey || walletPubkey.length !== 64)
    throw new Error("Invalid wallet pubkey");
  if (relays.length === 0) throw new Error("No relays provided");
  if (!secret || secret.length !== 64) throw new Error("Invalid secret");

  return { walletPubkey, relays, secret };
}

const conn = parseNwcUri(NWC_URI);

console.log(`NWC listener starting...`);
console.log(`Wallet: ${conn.walletPubkey}`);
console.log(`Relays: ${conn.relays.join(", ")}`);
console.log(`App URL: ${APP_URL}`);

for (const relayUrl of conn.relays) {
  connectRelay(relayUrl);
}

function connectRelay(relayUrl) {
  console.log(`Connecting to ${relayUrl}...`);

  const ws = new WebSocket(relayUrl);

  ws.onopen = () => {
    console.log(`Connected to ${relayUrl}`);
    ws.send(
      JSON.stringify([
        "REQ",
        "nwc-payment-listener",
        {
          kinds: [NWC_RESPONSE_KIND],
          authors: [conn.walletPubkey],
          since: Math.floor(Date.now() / 1000) - 86400, // last 24h
        },
      ]),
    );
  };

  ws.onmessage = async (msg) => {
    try {
      const data = JSON.parse(msg.data);
      if (data[0] !== "EVENT" || !data[2]) return;

      const event = data[2];
      if (event.kind !== NWC_RESPONSE_KIND) return;
      if (event.pubkey !== conn.walletPubkey) return;

      const plain = await decrypt(conn.secret, event.pubkey, event.content);
      const res = JSON.parse(plain);

      if (res.result?.payment_received) {
        const payment = res.result.payment_received;
        console.log(`Payment received: ${payment.payment_request}`);

        // Extract payment hash from invoice
        const paymentHash = bolt11PaymentHash(payment.payment_request);
        if (!paymentHash) {
          console.error("Could not extract payment hash from invoice");
          return;
        }

        // Call webhook to update DB
        try {
          const resp = await fetch(`${APP_URL}/api/payments/webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payment_hash: paymentHash }),
          });
          const result = await resp.json();
          console.log(`Webhook response:`, result);
        } catch (err) {
          console.error("Webhook call failed:", err.message);
        }
      }
    } catch (err) {
      // ignore parse/decrypt errors
    }
  };

  ws.onerror = (err) => {
    console.error(`WebSocket error on ${relayUrl}:`, err.message);
  };

  ws.onclose = () => {
    console.log(`Disconnected from ${relayUrl}, reconnecting in 5s...`);
    setTimeout(() => connectRelay(relayUrl), 5000);
  };
}

// ---------------------------------------------------------------------------
// BOLT11 payment hash extraction
// ---------------------------------------------------------------------------

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bolt11PaymentHash(invoice) {
  const pos = invoice.lastIndexOf("1");
  if (pos < 1) return "";
  const dataStr = invoice.slice(pos + 1);
  const data = [];
  for (const c of dataStr) {
    const idx = BECH32_CHARSET.indexOf(c);
    if (idx === -1) return "";
    data.push(idx);
  }
  const payload = data.slice(0, -6); // drop checksum
  if (payload.length < 39) return "";
  return bytesToHex(payload.slice(7, 39));
}

function bytesToHex(bytes) {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}
