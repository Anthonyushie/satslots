import { test, expect } from "@playwright/test";
import type { EventTemplate } from "nostr-tools/pure";
import {
  buildListingEvent,
  parseListingEvent,
  LISTING_KIND,
} from "./listing-event";
import { deduplicateListings } from "./discovery";
import { isNip07Available, getNostrPublicKey, signNostrEvent } from "./nip07";
import { verifiedEvent } from "./validation";
import { input, now, pubkey, otherKey, provider, signed } from "./test-helpers";
import type { ListingInput } from "./types";

test("listing roundtrip preserves fields, author and namespaced address", () => {
  const template = buildListingEvent(input, now);
  expect(template.kind).toBe(LISTING_KIND);
  expect(template.tags).toContainEqual(["d", "satslots:test-listing"]);
  const event = signed(template);
  expect(parseListingEvent(event)).toMatchObject({
    ...input,
    schemaVersion: 1,
    pubkey,
    eventId: event.id,
    address: `30078:${pubkey}:satslots:test-listing`,
    createdAt: now,
  });
});

for (const [label, change] of Object.entries({
  "empty name": { name: "  " },
  "long name": { name: "x".repeat(121) },
  "unknown category": { category: "Other" },
  "zero price": { priceSats: 0 },
  "negative price": { priceSats: -1 },
  "fractional price": { priceSats: 1.5 },
  "unsafe integer": { priceSats: Number.MAX_SAFE_INTEGER + 1 },
  "NaN price": { priceSats: NaN },
  "script URL": { websiteUrl: "javascript:alert(1)" },
  "data URL": { websiteUrl: "data:text/html,test" },
  "credential URL": { websiteUrl: "https://user:password@example.com" },
  "empty identifier": { listingId: "" },
  "colon identifier": { listingId: "a:b" },
  "empty description": { description: "" },
  "oversized description": { description: "x".repeat(4001) },
  "oversized audience": { audience: "x".repeat(501) },
  "extra field": { privateKey: "never" },
  "version override": { schemaVersion: 2 },
  "control character": { name: "bad\u0000name" },
})) {
  test(`rejects ${label} before signing`, () => {
    expect(() =>
      buildListingEvent({ ...input, ...change } as ListingInput, now),
    ).toThrow();
  });
}

test("enforces UTF-8 byte limit, not just character length", () => {
  expect(() =>
    buildListingEvent(
      {
        ...input,
        description: "漢".repeat(4000),
        websiteUrl: "https://example.com/" + "漢".repeat(1900),
      },
      now,
    ),
  ).toThrow("16 KiB");
});

test("accepts optional audience omission", () => {
  const minimal = { ...input };
  delete minimal.audience;
  expect(
    parseListingEvent(signed(buildListingEvent(minimal, now)))?.audience,
  ).toBeUndefined();
});

test("rejects bad signatures and tampered cached verification objects", () => {
  const event = signed(buildListingEvent(input, now));
  expect(verifiedEvent({ ...event, content: "tampered" })).toBeNull();
  expect(parseListingEvent({ ...event, sig: "0".repeat(128) })).toBeNull();
  expect(parseListingEvent({ ...event, id: "f".repeat(64) })).toBeNull();
});

test("rejects future events and nonintegral timestamps", () => {
  const template = buildListingEvent(input, now);
  expect(
    parseListingEvent(signed({ ...template, created_at: now + 1000 })),
  ).toBeNull();
  expect(
    parseListingEvent(signed({ ...template, created_at: now + 0.5 })),
  ).toBeNull();
  expect(() => buildListingEvent(input, now + 1000)).toThrow();
});

for (const [label, change] of Object.entries({
  "wrong kind": { kind: 1 },
  "invalid JSON": { content: "{" },
  "null content": { content: "null" },
  "array content": { content: "[]" },
  "missing tags": { tags: [] },
  "wrong namespace": {
    tags: [
      ["d", "other:test-listing"],
      ["t", "satslots"],
      ["t", "satslots-listing"],
      ["t", "Bitcoin"],
      ["client", "satslots"],
    ],
  },
})) {
  test(`discovery discards signed ${label}`, () => {
    expect(
      parseListingEvent(
        signed({ ...buildListingEvent(input, now), ...change }),
      ),
    ).toBeNull();
  });
}

test("rejects extra JSON fields, unsupported version, duplicate identifiers and mismatched category tags", () => {
  const template = buildListingEvent(input, now);
  for (const extra of [
    { schemaVersion: 2 },
    { injected: true },
    { priceSats: -1 },
  ]) {
    expect(
      parseListingEvent(
        signed({
          ...template,
          content: JSON.stringify({
            ...JSON.parse(template.content),
            ...extra,
          }),
        }),
      ),
    ).toBeNull();
  }
  expect(
    parseListingEvent(
      signed({
        ...template,
        tags: [...template.tags, ["d", "satslots:other"]],
      }),
    ),
  ).toBeNull();
  expect(
    parseListingEvent(
      signed({ ...template, tags: [...template.tags, ["t", "Design"]] }),
    ),
  ).toBeNull();
  expect(
    parseListingEvent(
      signed({
        ...template,
        tags: Array.from({ length: 65 }, () => ["t", "spam"]),
      }),
    ),
  ).toBeNull();
});

test("deduplication is author-scoped, newest-first, and deterministic on ties", () => {
  const old = signed(buildListingEvent(input, now - 100));
  const current = signed(buildListingEvent({ ...input, name: "Updated" }, now));
  const tie = signed(buildListingEvent({ ...input, name: "Another" }, now));
  const other = signed(buildListingEvent(input, now), otherKey);
  for (const events of [
    [old, current, tie, other, old],
    [other, tie, current, old],
  ]) {
    const listings = deduplicateListings(events);
    expect(listings).toHaveLength(2);
    expect(listings.find((listing) => listing.pubkey === pubkey)?.eventId).toBe(
      [current.id, tie.id].sort()[0],
    );
  }
});

test("imports and extension detection are safe without window", async () => {
  expect(typeof window).toBe("undefined");
  expect(isNip07Available()).toBe(false);
  await expect(getNostrPublicKey()).rejects.toMatchObject({
    code: "EXTENSION_UNAVAILABLE",
  });
});

test("NIP-07 returns canonical key and verifies successful signing", async () => {
  expect(await getNostrPublicKey(provider)).toBe(pubkey);
  const event = await signNostrEvent(buildListingEvent(input, now), {
    provider,
    expectedPubkey: pubkey,
  });
  expect(parseListingEvent(event)).not.toBeNull();
});

test("extension rejection and invalid public keys are actionable errors", async () => {
  await expect(
    getNostrPublicKey({
      ...provider,
      getPublicKey: async () => {
        throw new Error("denied");
      },
    }),
  ).rejects.toMatchObject({ code: "EXTENSION_REJECTED" });
  await expect(
    getNostrPublicKey({
      ...provider,
      getPublicKey: async () => "npub-invalid",
    }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  await expect(
    signNostrEvent(buildListingEvent(input, now), {
      provider: {
        ...provider,
        signEvent: async () => {
          throw new Error("denied");
        },
      },
    }),
  ).rejects.toMatchObject({ code: "EXTENSION_REJECTED" });
});

test("rejects account changes before prompting for a signature", async () => {
  let prompted = false;
  await expect(
    signNostrEvent(buildListingEvent(input, now), {
      expectedPubkey: "f".repeat(64),
      provider: {
        ...provider,
        signEvent: async (template) => {
          prompted = true;
          return signed(template);
        },
      },
    }),
  ).rejects.toMatchObject({ code: "SIGNER_MISMATCH" });
  expect(prompted).toBe(false);
});

test("rejects a different signing key and validly signed content mutation", async () => {
  const template = buildListingEvent(input, now);
  await expect(
    signNostrEvent(template, {
      provider: {
        ...provider,
        signEvent: async (event) => signed(event, otherKey),
      },
    }),
  ).rejects.toMatchObject({ code: "SIGNER_MISMATCH" });
  await expect(
    signNostrEvent(template, {
      provider: {
        ...provider,
        signEvent: async (event) => {
          event.content = "changed";
          event.tags[0][1] = "changed";
          return signed(event);
        },
      },
    }),
  ).rejects.toMatchObject({ code: "SIGNER_MISMATCH" });
  expect(template.tags[0][1]).toBe("satslots:test-listing");
});

test("rejects invalid signature from extension", async () => {
  await expect(
    signNostrEvent(buildListingEvent(input, now), {
      provider: {
        ...provider,
        signEvent: async (event) => ({
          ...signed(event),
          sig: "0".repeat(128),
        }),
      },
    }),
  ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
});

test("invalid templates never reach extension signing", async () => {
  let signedCount = 0;
  await expect(
    signNostrEvent(
      { kind: -1, created_at: now, tags: [], content: "x" } as EventTemplate,
      {
        provider: {
          ...provider,
          signEvent: async (event) => {
            signedCount++;
            return signed(event);
          },
        },
      },
    ),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(signedCount).toBe(0);
});

test("rejects oversized tag envelopes before prompting the signer", async () => {
  let prompted = false;
  await expect(
    signNostrEvent(
      {
        kind: 1,
        created_at: now,
        content: "",
        tags: Array.from({ length: 64 }, () => ["t", "x".repeat(2048)]),
      },
      {
        provider: {
          ...provider,
          signEvent: async (event) => {
            prompted = true;
            return signed(event);
          },
        },
      },
    ),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(prompted).toBe(false);
  const oversized = signed({
    kind: 1,
    created_at: now,
    content: "",
    tags: Array.from({ length: 64 }, () => ["t", "x".repeat(2048)]),
  });
  expect(verifiedEvent(oversized)).toBeNull();
});

test("detects the browser extension and requests its public key", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    Object.defineProperty(globalThis, "window", {
      value: { nostr: provider },
      configurable: true,
    });
    expect(isNip07Available()).toBe(true);
    expect(await getNostrPublicKey()).toBe(pubkey);
    Object.defineProperty(globalThis, "window", {
      value: { nostr: {} },
      configurable: true,
    });
    expect(isNip07Available()).toBe(false);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
