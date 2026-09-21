import { finalizeEvent, type VerifiedEvent } from "nostr-tools/pure";
import {
  encrypt as nip04Encrypt,
  decrypt as nip04Decrypt,
} from "nostr-tools/nip04";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import type { CreateInvoiceParams, LightningInvoice } from "./client";

/**
 * Nostr Wallet Connect (NIP-47) backend.
 *
 * Creates invoices by publishing kind 23194 request events to the
 * wallet relay and subscribing for kind 23195 responses.
 *
 * Env: NWC_CONNECTION_STRING — nostr+walletconnect://<pubkey>?relay=<url>&secret=<hex>
 */

const NWC_REQUEST_KIND = 23194;
const NWC_RESPONSE_KIND = 23195;

export interface NwcConnection {
  walletPubkey: string;
  relays: string[];
  secret: string;
}

function parseConnectionString(uri: string): NwcConnection {
  const url = new URL(uri.replace("nostr+walletconnect://", "https://"));
  const walletPubkey = url.hostname || url.pathname.replace("//", "");
  const relays = url.searchParams.getAll("relay");
  const secret = url.searchParams.get("secret");

  if (!walletPubkey || walletPubkey.length !== 64)
    throw new Error("NWC: invalid wallet pubkey");
  if (relays.length === 0) throw new Error("NWC: no relays provided");
  if (!secret || secret.length !== 64) throw new Error("NWC: invalid secret");

  return { walletPubkey, relays, secret };
}

function getConnection(): NwcConnection {
  const uri = process.env.NWC_CONNECTION_STRING;
  if (!uri)
    throw new Error(
      "NWC_CONNECTION_STRING is not set. Add it to .env.",
    );
  return parseConnectionString(uri);
}

export async function createInvoiceNwc(
  params: CreateInvoiceParams,
): Promise<LightningInvoice> {
  const conn = getConnection();

  const secretKey = hexToBytes(conn.secret);
  const content = JSON.stringify({
    method: "make_invoice",
    params: {
      amount: params.amountSats,
      description: params.memo,
      expiry: params.expirySeconds ?? 3600,
    },
  });
  const encrypted = await nip04Encrypt(conn.secret, conn.walletPubkey, content);

  const event = finalizeEvent(
    {
      kind: NWC_REQUEST_KIND,
      created_at: Math.floor(Date.now() / 1000),
      content: encrypted,
      tags: [["p", conn.walletPubkey]],
    },
    secretKey,
  );

  const published = await Promise.allSettled(
    conn.relays.map((url) => publishEvent(url, event)),
  );
  if (published.every((r) => r.status === "fulfilled" && !r.value)) {
    throw new Error("NWC: failed to publish request to any relay");
  }

  return waitForResponse(conn, event.id, 30_000);
}

async function publishEvent(relay: string, event: VerifiedEvent): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(relay);
    const timer = setTimeout(() => { ws.close(); resolve(false); }, 5_000);

    ws.onopen = () => ws.send(JSON.stringify(["EVENT", event]));
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data[0] === "OK" && data[1] === event.id) {
          clearTimeout(timer);
          ws.close();
          resolve(true);
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => { clearTimeout(timer); resolve(false); };
    ws.onclose = () => { clearTimeout(timer); resolve(false); };
  });
}

function waitForResponse(
  conn: NwcConnection,
  requestId: string,
  timeoutMs: number,
): Promise<LightningInvoice> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("NWC: wallet did not respond in time")),
      timeoutMs,
    );
    const cleanups: (() => void)[] = [];

    for (const relay of conn.relays) {
      cleanups.push(
        subscribeRelay(relay, conn, requestId, (inv, hash) => {
          clearTimeout(timer);
          cleanups.forEach((fn) => fn());
          resolve({ bolt11: inv, paymentHash: hash });
        }),
      );
    }
  });
}

function subscribeRelay(
  relay: string,
  conn: NwcConnection,
  requestId: string,
  onResult: (invoice: string, paymentHash: string) => void,
): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  const close = () => { if (!closed) { closed = true; ws?.close(); } };

  try {
    ws = new WebSocket(relay);

    ws.onopen = () => {
      if (closed || !ws) return;
      ws.send(
        JSON.stringify([
          "REQ",
          `nwc-${requestId.slice(0, 8)}`,
          {
            kinds: [NWC_RESPONSE_KIND],
            authors: [conn.walletPubkey],
            since: Math.floor(Date.now() / 1000) - 120,
          },
        ]),
      );
    };

    ws.onmessage = async (msg) => {
      if (closed) return;
      try {
        const data = JSON.parse(msg.data);
        if (data[0] !== "EVENT" || !data[2]) return;
        const ev = data[2];
        if (ev.kind !== NWC_RESPONSE_KIND || ev.pubkey !== conn.walletPubkey) return;

        const plain = await nip04Decrypt(conn.secret, ev.pubkey, ev.content);
        const res = JSON.parse(plain);

        if (res.request?.id !== requestId) return;
        if (res.error) { close(); return; }

        if (res.result?.invoice) {
          const invoice: string = res.result.invoice;
          const paymentHash = bolt11PaymentHash(invoice);
          onResult(invoice, paymentHash);
          close();
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => close();
  } catch { /* ignore */ }

  return close;
}

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bolt11PaymentHash(invoice: string): string {
  const pos = invoice.lastIndexOf("1");
  if (pos < 1) return "";
  const dataStr = invoice.slice(pos + 1);
  const data: number[] = [];
  for (const c of dataStr) {
    const idx = BECH32_CHARSET.indexOf(c);
    if (idx === -1) return "";
    data.push(idx);
  }
  const payload = data.slice(0, -6);
  if (payload.length < 39) return "";
  return bytesToHex(new Uint8Array(payload.slice(7, 39)));
}
