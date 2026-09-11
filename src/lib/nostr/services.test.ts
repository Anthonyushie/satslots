import { test, expect } from "@playwright/test";
import { buildListingEvent } from "./listing-event";
import { discoverListings, publishListing } from "./discovery";
import { connectNostr, getNostrProfile, mapNostrProfile } from "./identity";
import { getRelayConfig } from "./relays";
import { RelayOperationError } from "./types";
import { NostrClient } from "./client";
import {
  A,
  B,
  C,
  MockRelay,
  input,
  mockClient,
  now,
  otherKey,
  pubkey,
  provider,
  signed,
} from "./test-helpers";

const listing = () => signed(buildListingEvent(input, now));
const profile = (metadata: unknown, created_at = now) =>
  signed({ kind: 0, tags: [], created_at, content: JSON.stringify(metadata) });

test("successful primaries do not contact fallback relays", async () => {
  const a = new MockRelay("ok", [listing()]);
  const b = new MockRelay("ok", [listing()]);
  const { client, calls } = mockClient({ [A]: a, [B]: b });
  const result = await discoverListings({}, client);
  expect(result.listings).toHaveLength(1);
  expect(calls.sort()).toEqual([A, B].sort());
  expect(result.relays.every((relay) => relay.ok)).toBe(true);
  for (const relay of [a, b]) {
    expect(relay.closed).toBe(true);
    expect(relay.subscriptionClosed).toBe(true);
    expect(relay.signal?.aborted).toBe(true);
  }
});

test("partial primary failure tries fallbacks and preserves diagnostics", async () => {
  const a = new MockRelay("connect-fail");
  const b = new MockRelay("ok", [listing()]);
  const c = new MockRelay("ok", [listing()]);
  const { client, calls } = mockClient({ [A]: a, [B]: b, [C]: c });
  const result = await discoverListings({}, client);
  expect(result.listings).toHaveLength(1);
  expect(calls).toContain(C);
  expect(result.relays).toContainEqual({
    url: A,
    ok: false,
    reason: "unavailable",
  });
  expect(a.closed).toBe(true);
  expect(c.closed).toBe(true);
});

test("all relay failures throw instead of returning an empty marketplace", async () => {
  const { client } = mockClient({
    [A]: new MockRelay("connect-fail"),
    [B]: new MockRelay("query-close"),
    [C]: new MockRelay("socket-close"),
  });
  await expect(discoverListings({}, client)).rejects.toBeInstanceOf(
    RelayOperationError,
  );
});

test("completed empty query differs from failed discovery", async () => {
  const { client } = mockClient({});
  expect((await discoverListings({}, client)).listings).toEqual([]);
});

for (const mode of ["connect-stall", "query-stall"] as const) {
  test(`${mode} times out, aborts and closes resources`, async () => {
    const a = new MockRelay(mode, [listing()]);
    const { client } = mockClient({ [A]: a });
    const result = await client.query({ kinds: [30078] });
    expect(result.relays).toContainEqual({
      url: A,
      ok: false,
      reason: "timeout",
    });
    expect(result.events).toEqual([]);
    expect(a.closed).toBe(true);
    expect(a.signal?.aborted).toBe(true);
    if (mode === "query-stall") expect(a.subscriptionClosed).toBe(true);
  });
}

test("caps event collection and signals truncated results", async () => {
  const events = [
    listing(),
    signed(buildListingEvent({ ...input, listingId: "two" }, now)),
  ];
  const { client } = mockClient({ [A]: new MockRelay("ok", events) }, 1);
  const result = await client.query({ kinds: [30078] });
  expect(result.events).toHaveLength(1);
  expect(result.relays).toContainEqual({ url: A, ok: true, truncated: true });
});

test("transport filters invalid signatures, duplicates and off-filter events", async () => {
  const event = listing();
  const { client } = mockClient({
    [A]: new MockRelay("ok", [
      event,
      event,
      { ...event, content: "bad" },
      profile({ name: "Wrong kind" }),
    ]),
  });
  const result = await client.query({ kinds: [30078] });
  expect(result.events).toHaveLength(1);
  expect(result.events[0].id).toBe(event.id);
});

test("publisher returns eventId only after an acknowledgement, plus relay failures", async () => {
  const a = new MockRelay();
  const b = new MockRelay("publish-fail");
  const c = new MockRelay();
  const { client } = mockClient({ [A]: a, [B]: b, [C]: c });
  const result = await publishListing(input, {
    provider,
    expectedPubkey: pubkey,
    client,
  });
  expect(result.eventId).toBe(a.published[0].id);
  expect(result.acceptedRelays).toEqual([A, C]);
  expect(result.failedRelays).toContainEqual({
    url: B,
    ok: false,
    reason: "rejected",
  });
  expect(a.published[0].pubkey).toBe(pubkey);
  expect(a.closed && b.closed && c.closed).toBe(true);
});

test("total publishing failure cannot be reported as success", async () => {
  const { client } = mockClient({
    [A]: new MockRelay("publish-fail"),
    [B]: new MockRelay("publish-fail"),
    [C]: new MockRelay("publish-fail"),
  });
  await expect(
    publishListing(input, { provider, client }),
  ).rejects.toBeInstanceOf(RelayOperationError);
});

test("stalled publication has a bounded deadline", async () => {
  const a = new MockRelay("publish-stall");
  const { client } = mockClient({ [A]: a });
  const result = await client.publish(listing());
  expect(result.failedRelays).toContainEqual({
    url: A,
    ok: false,
    reason: "timeout",
  });
  expect(a.closed).toBe(true);
});

test("invalid event cannot reach a relay", async () => {
  const { client, calls } = mockClient({});
  await expect(
    client.publish({ ...listing(), content: "tampered" }),
  ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  expect(calls).toEqual([]);
});

test("category filtering happens after selecting latest revision", async () => {
  const events = [
    signed(buildListingEvent(input, now - 50)),
    signed(buildListingEvent({ ...input, category: "Design" }, now)),
  ];
  const { client } = mockClient({ [A]: new MockRelay("ok", events) });
  expect(
    (await discoverListings({ category: "Bitcoin" }, client)).listings,
  ).toEqual([]);
  expect(
    (
      await discoverListings(
        { category: "Design" },
        mockClient({ [A]: new MockRelay("ok", events) }).client,
      )
    ).listings,
  ).toHaveLength(1);
});

test("author and result limits are enforced after safe deduplication", async () => {
  const events = [
    listing(),
    signed(buildListingEvent(input, now), otherKey),
    signed(buildListingEvent({ ...input, listingId: "newer" }, now + 1)),
  ];
  const { client } = mockClient({ [A]: new MockRelay("ok", events) });
  const result = await discoverListings(
    { authors: [pubkey], limit: 1 },
    client,
  );
  expect(result.listings).toHaveLength(1);
  expect(result.listings[0].listingId).toBe("newer");
  expect(result.listings[0].pubkey).toBe(pubkey);
});

test("latest matching profile maps display name, avatar and bio", async () => {
  const { client } = mockClient({
    [A]: new MockRelay("ok", [
      profile({ name: "Old" }, now - 1),
      profile({
        name: "Name",
        display_name: "Display",
        picture: "https://example.com/avatar.png",
        about: "Bio",
      }),
    ]),
  });
  const result = await getNostrProfile(pubkey, client);
  expect(result.status).toBe("found");
  expect(result.profile).toEqual({
    pubkey,
    name: "Display",
    avatar: "https://example.com/avatar.png",
    bio: "Bio",
  });
});

test("profile ties use lowest event ID, independent of relay ordering", async () => {
  const events = [profile({ name: "A" }), profile({ name: "B" })];
  const expected = JSON.parse(
    [...events].sort((a, b) => (a.id < b.id ? -1 : 1))[0].content,
  ).name;
  const { client } = mockClient({ [A]: new MockRelay("ok", events.reverse()) });
  expect((await getNostrProfile(pubkey, client)).profile.name).toBe(expected);
});

test("malformed, forged and wrong-author profiles cannot override valid metadata", async () => {
  const valid = profile({ name: "Valid" });
  const malformed = signed({
    kind: 0,
    tags: [],
    created_at: now + 1,
    content: "{",
  });
  const wrongAuthor = signed(
    {
      kind: 0,
      tags: [],
      created_at: now + 1,
      content: JSON.stringify({ name: "Wrong" }),
    },
    otherKey,
  );
  const { client } = mockClient({
    [A]: new MockRelay("ok", [
      { ...valid, content: "bad" },
      wrongAuthor,
      malformed,
      valid,
    ]),
  });
  expect((await getNostrProfile(pubkey, client)).profile.name).toBe("Valid");
});

test("profile mapping drops unsafe URLs, excessive metadata and arbitrary fields", () => {
  const result = mapNostrProfile(pubkey, {
    name: "x".repeat(121),
    picture: "javascript:alert(1)",
    about: "x".repeat(4001),
    admin: true,
  });
  expect(result).toEqual({
    pubkey,
    name: `${pubkey.slice(0, 8)}…`,
    avatar: null,
    bio: "",
  });
});

test("missing profile and relay outage retain connected identity with distinct states", async () => {
  const missing = await connectNostr({
    provider,
    client: mockClient({}).client,
  });
  expect(missing.pubkey).toBe(pubkey);
  expect(missing.profileStatus).toBe("missing");
  const failed = mockClient({
    [A]: new MockRelay("connect-fail"),
    [B]: new MockRelay("connect-fail"),
    [C]: new MockRelay("connect-fail"),
  });
  const result = await connectNostr({ provider, client: failed.client });
  expect(result.pubkey).toBe(pubkey);
  expect(result.profileStatus).toBe("unavailable");
  expect(result.relays).toHaveLength(3);
});

test("invalid public key, filter and discovery options fail before network calls", async () => {
  const { client, calls } = mockClient({});
  await expect(getNostrProfile("invalid", client)).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(client.query({ limit: -1 })).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(client.query({ authors: ["invalid"] })).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(discoverListings({ limit: 1000 }, client)).rejects.toMatchObject(
    { code: "INVALID_INPUT" },
  );
  await expect(discoverListings({ authors: [] }, client)).rejects.toMatchObject(
    { code: "INVALID_INPUT" },
  );
  expect(calls).toHaveLength(0);
});

test("relay configuration normalizes duplicates and prevents mutable defaults", () => {
  const config = getRelayConfig({ primary: [A, A + "/"], fallback: [A, B] });
  expect(config.primary).toEqual([A]);
  expect(config.fallback).toEqual([B]);
  expect(Object.isFrozen(config.primary)).toBe(true);
  expect(Object.isFrozen(config)).toBe(true);
});

test("rejects insecure relays, empty primary sets and unbounded settings", () => {
  expect(() => getRelayConfig({ primary: ["ws://localhost"] })).toThrow();
  expect(() => getRelayConfig({ primary: [] })).toThrow();
  expect(() => getRelayConfig({ timeoutMs: 0 })).toThrow();
  expect(() => getRelayConfig({ maxEventsPerRelay: 1001 })).toThrow();
});

test("factory failure still produces fallback diagnostics", async () => {
  const client = new NostrClient({
    config: { primary: [A], fallback: [] },
    relayFactory: () => {
      throw new Error("WebSocket unavailable");
    },
  });
  await expect(client.query({ kinds: [0] })).rejects.toMatchObject({
    relays: [{ url: A, ok: false, reason: "unavailable" }],
  });
});
