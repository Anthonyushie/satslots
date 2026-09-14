import type { Page } from "@playwright/test";
import { finalizeEvent, getPublicKey, type Event } from "nostr-tools/pure";
import { buildListingEvent } from "../src/lib/nostr/listing-event";

// Public, test-only identity. Never request a real extension or publish events.
const testSecret = new Uint8Array(32).fill(7);
export const testPubkey = getPublicKey(testSecret);
export function listingEvent(name = "Relay publication", createdAt = 100) {
  return finalizeEvent(
    {
      ...buildListingEvent({
        listingId: "test-space",
        name,
        category: "Design",
        description: "Independent relay publication.",
        priceSats: 3000,
        websiteUrl: "https://example.com",
      }),
      created_at: createdAt,
    },
    testSecret,
  );
}
export const profileEvent = finalizeEvent(
  {
    kind: 0,
    created_at: 100,
    tags: [],
    content: JSON.stringify({
      name: "Test publisher",
      about: "Public test profile",
    }),
  },
  testSecret,
);

type RelayOptions = {
  events?: Event[];
  profile?: Event | null;
  offline?: boolean;
  partial?: boolean;
  profileOffline?: boolean;
  delayMs?: number;
};

export async function mockRelays(page: Page, options: RelayOptions = {}) {
  const publications: unknown[] = [];
  await page.routeWebSocket(/wss:\/\//, (socket) => {
    socket.onMessage((message) => {
      const frame = JSON.parse(String(message));
      if (frame[0] === "EVENT") {
        publications.push(frame);
        throw new Error("Browser tests must never publish Nostr events");
      }
      if (frame[0] !== "REQ") return;
      const profileQuery = frame[2].kinds.includes(0);
      if (
        options.offline ||
        (options.partial && socket.url().includes("nos.lol")) ||
        (options.profileOffline && profileQuery)
      ) {
        socket.close({ code: 1011, reason: "Controlled offline relay" });
        return;
      }
      const events = profileQuery
        ? options.profile
          ? [options.profile]
          : []
        : (options.events ?? []);
      const respond = () => {
        for (const event of events)
          socket.send(JSON.stringify(["EVENT", frame[1], event]));
        socket.send(JSON.stringify(["EOSE", frame[1]]));
      };
      if (options.delayMs) setTimeout(respond, options.delayMs);
      else respond();
    });
  });
  return { options, publications };
}

export async function mockExtension(
  page: Page,
  behavior: "approve" | "deny" | "defer" = "approve",
) {
  await page.addInitScript(
    ({ pubkey, behavior }) => {
      Object.defineProperty(window, "nostr", {
        configurable: true,
        value: {
          getPublicKey: () => {
            if (behavior === "deny")
              return Promise.reject(new Error("Permission denied"));
            if (behavior === "defer")
              return new Promise<string>((resolve) => {
                Object.defineProperty(window, "resolveNostrConnection", {
                  value: () => resolve(pubkey),
                });
              });
            return Promise.resolve(pubkey);
          },
          signEvent: () => {
            throw new Error("Signing forbidden in read-only browser tests");
          },
        },
      });
    },
    { pubkey: testPubkey, behavior },
  );
}
