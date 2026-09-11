import { test, expect } from "@playwright/test";
import { useWebSocketImplementation } from "nostr-tools/relay";
import { createNostrClient } from "./client";
import { buildListingEvent } from "./listing-event";
import { input, now, signed, A } from "./test-helpers";

/** Mock only the wire, not the nostr-tools adapter or its subscription lifecycle. */
class WireSocket {
  static CLOSING = 2;
  static CLOSED = 3;
  static mode:
    "query" | "query-stall" | "publish" | "reject" | "closed" | "oversized" =
    "query";
  static instances: WireSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: ((event: { reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  readyState = 0;
  sent: unknown[][] = [];
  constructor() {
    WireSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.();
    });
  }
  send(data: string) {
    if (this.readyState !== 1) throw new Error("send after WebSocket close");
    const message = JSON.parse(data) as unknown[];
    this.sent.push(message);
    queueMicrotask(() => {
      if (message[0] === "REQ") {
        if (WireSocket.mode === "closed") {
          this.emit(["CLOSED", message[1], "auth-required"]);
          return;
        }
        if (WireSocket.mode === "oversized") {
          this.onmessage?.({ data: "[" + " ".repeat(140_000) });
        } else
          this.emit([
            "EVENT",
            message[1],
            signed(buildListingEvent(input, now)),
          ]);
        if (WireSocket.mode !== "query-stall") this.emit(["EOSE", message[1]]);
      } else if (message[0] === "EVENT") {
        const event = message[1] as { id: string };
        this.emit(["OK", event.id, WireSocket.mode !== "reject", ""]);
      }
    });
  }
  emit(frame: unknown[]) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
  close() {
    this.readyState = WireSocket.CLOSED;
    this.onclose?.({ reason: "closed" });
  }
}

test.describe("native nostr-tools adapter", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(() => {
    WireSocket.instances = [];
    useWebSocketImplementation(WireSocket);
  });
  test.afterEach(() => {
    useWebSocketImplementation(globalThis.WebSocket);
  });
  const client = () =>
    createNostrClient({ primary: [A], fallback: [], timeoutMs: 100 });

  test("REQ/EVENT/EOSE produces a query result and closes the socket", async () => {
    WireSocket.mode = "query";
    const result = await client().query({ kinds: [30078] });
    expect(result.events).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(WireSocket.instances[0].readyState).toBe(WireSocket.CLOSED);
    expect(
      WireSocket.instances[0].sent.some(([kind]) => kind === "CLOSE"),
    ).toBe(true);
  });

  test("missing wire EOSE is a timeout, not successful empty discovery", async () => {
    WireSocket.mode = "query-stall";
    await expect(client().query({ kinds: [30078] })).rejects.toMatchObject({
      relays: [{ url: A, ok: false, reason: "timeout" }],
    });
    expect(WireSocket.instances[0].readyState).toBe(WireSocket.CLOSED);
  });

  test("CLOSED wire response propagates failure", async () => {
    WireSocket.mode = "closed";
    await expect(client().query({ kinds: [30078] })).rejects.toMatchObject({
      relays: [{ url: A, ok: false, reason: "closed" }],
    });
  });

  test("positive OK acknowledges publication", async () => {
    WireSocket.mode = "publish";
    expect(
      (await client().publish(signed(buildListingEvent(input, now))))
        .acceptedRelays,
    ).toEqual([A]);
    expect(WireSocket.instances[0].readyState).toBe(WireSocket.CLOSED);
  });

  test("oversized frames are ignored before native parsing", async () => {
    WireSocket.mode = "oversized";
    const result = await client().query({ kinds: [30078] });
    expect(result.events).toEqual([]);
    expect(result.relays[0].ok).toBe(true);
    expect(WireSocket.instances[0].readyState).toBe(WireSocket.CLOSED);
  });

  test("negative OK rejects publication", async () => {
    WireSocket.mode = "reject";
    await expect(
      client().publish(signed(buildListingEvent(input, now))),
    ).rejects.toMatchObject({
      relays: [{ url: A, ok: false, reason: "rejected" }],
    });
  });
});
