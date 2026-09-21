#!/usr/bin/env node
/**
 * End-to-end checks for the room and booking APIs against a running server.
 *
 * Not part of `npm run test:e2e`: like test-auth, this needs a live Neon
 * database, so it is opt-in.
 *
 *   npm run build && npm run start     # in one terminal
 *   npm run test:api                   # in another
 *
 * Every identity is a freshly generated key that signs in for real through
 * NIP-42, so these are the same requests a browser would make, subject to the
 * same RLS policies. Rows written here are deleted again on the way out.
 */
import { generateSecretKey, getPublicKey, finalizeEvent } from "nostr-tools/pure";
import pg from "pg";

const BASE = process.env.API_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const ORIGIN = BASE;

let passed = 0;
let failed = 0;
function check(condition, label, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}  ${detail}`);
  }
}

/**
 * A 500 from these routes means the database was unreachable, never a verdict on
 * the request. Retrying keeps a flaky connectivity window from being reported as
 * a failed security assertion.
 */
async function withDbRetry(send, attempts = 6) {
  for (let i = 0; ; i += 1) {
    const response = await send();
    if (response.status !== 500 || i >= attempts - 1) return response;
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
}

/** Signs in a fresh key and returns the identity plus its session cookie. */
async function signIn(hint) {
  const secretKey = generateSecretKey();
  const pubkey = getPublicKey(secretKey);

  const challengeResponse = await withDbRetry(() =>
    fetch(`${BASE}/api/auth/challenge`, {
      method: "POST",
      headers: { origin: ORIGIN },
    }),
  );
  const challenge = await challengeResponse.json();
  if (!challenge.nonce) {
    throw new Error(`no challenge issued (HTTP ${challengeResponse.status})`);
  }

  const event = finalizeEvent(
    {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["relay", challenge.audience],
        ["challenge", challenge.nonce],
      ],
      content: "",
    },
    secretKey,
  );

  const verified = await withDbRetry(() =>
    fetch(`${BASE}/api/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ event, username: hint }),
    }),
  );
  if (verified.status !== 200) {
    throw new Error(`sign-in failed (HTTP ${verified.status})`);
  }
  const cookie = (verified.headers.getSetCookie?.() ?? [])
    .find((entry) => entry.startsWith("satslots_session="))
    ?.split(";")[0];
  if (!cookie) throw new Error("sign-in returned no session cookie");

  return { secretKey, pubkey, cookie };
}

/** A JSON request as `identity`, or anonymous when it is null. */
async function api(method, path, { identity, body, origin = ORIGIN } = {}) {
  const headers = { origin };
  if (identity) headers.cookie = identity.cookie;
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await withDbRetry(() =>
    fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

/** Adds whole days to a YYYY-MM-DD string in UTC, matching the server's rule. */
function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Dates well clear of anything a person would book by hand, so a run cannot
 * collide with real data or with a previous run's leftovers.
 */
const BASE_DATE = "2031-03-01";

/** Neon reachability here is genuinely intermittent; wait out the bad windows. */
async function preflight() {
  const waitMs = Number(process.env.API_TEST_WAIT_SECONDS ?? 180) * 1000;
  const deadline = Date.now() + waitMs;
  let last;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/auth/challenge`, {
        method: "POST",
        headers: { origin: ORIGIN },
      });
      if (response.status === 200) return;
      last = `HTTP ${response.status}`;
      if (response.status !== 500) break;
    } catch (error) {
      last = `cannot reach ${BASE} (${error.cause?.code ?? error.name})`;
      console.error(
        `test-api: ${last}. Start the server first: npm run build && npm run start`,
      );
      break;
    }
    if (Date.now() >= deadline) break;
    if (attempt === 1) {
      console.log(`test-api: waiting for the database (up to ${waitMs / 1000}s)…`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  console.error(
    `test-api: ${BASE}/api/auth/challenge never returned 200 (last: ${last}).`,
  );
  process.exit(2);
}

/** Neon connections time out intermittently; retry rather than failing the run. */
async function connect(url, attempts = 8) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    const client = new pg.Client({ connectionString: url });
    try {
      await client.connect();
      return client;
    } catch (error) {
      last = error;
      await client.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  throw new Error(
    `could not connect: ${last?.code ?? last?.name} ${last?.message ?? ""}`,
  );
}

async function main() {
  await preflight();

  const owner = await signIn("apitest-owner");
  const advertiser = await signIn("apitest-advertiser");
  const other = await signIn("apitest-other");
  console.log(`test-api: owner ${owner.pubkey.slice(0, 12)}…`);

  // -------------------------------------------------------------------------
  console.log("\n== creating a room ==");

  const anonymous = await api("POST", "/api/listings", {
    body: {
      title: "Anonymous room",
      category: "Bitcoin",
      priceSats: 5000,
    },
  });
  check(
    anonymous.status === 401,
    "signed-out room creation is refused",
    `status=${anonymous.status}`,
  );

  const crossOrigin = await api("POST", "/api/listings", {
    identity: owner,
    origin: "https://evil.example",
    body: { title: "Cross origin", category: "Bitcoin", priceSats: 5000 },
  });
  check(
    crossOrigin.status === 403,
    "cross-origin room creation is refused",
    `status=${crossOrigin.status}`,
  );

  const invalid = await api("POST", "/api/listings", {
    identity: owner,
    body: { title: "", category: "NotACategory", priceSats: -5 },
  });
  check(
    invalid.status === 400,
    "an invalid room body is refused with 400, not a crash",
    `status=${invalid.status}`,
  );

  const created = await api("POST", "/api/listings", {
    identity: owner,
    body: {
      title: "API test room",
      description: "A room created by the API test suite.",
      category: "Bitcoin",
      priceSats: 5000,
      websiteUrl: "https://example.com",
      audience: "Independent readers",
      adDurationDays: 7,
      maxAds: 1,
    },
  });
  check(
    created.status === 201,
    "signed-in room creation succeeds",
    `status=${created.status}`,
  );
  const roomId = created.body.listing?.id;
  const room = created.body.listing;
  check(typeof roomId === "string", "the room comes back with an id");
  check(room?.pubkey === owner.pubkey, "the owner is the signed-in caller");
  check(room?.adDurationDays === 7, "ad length is stored", `${room?.adDurationDays}`);
  check(room?.maxAds === 1, "ad capacity is stored", `${room?.maxAds}`);
  check(
    room?.priceSats === 5000,
    "price is stored as a number, not the bigint string",
    `${typeof room?.priceSats} ${room?.priceSats}`,
  );

  const readBack = await api("GET", `/api/listings/${roomId}`);
  check(
    readBack.status === 200 && readBack.body.listing?.title === "API test room",
    "the room reads back anonymously",
    `status=${readBack.status}`,
  );

  const list = await api("GET", "/api/listings?category=Bitcoin");
  check(
    list.status === 200 &&
      list.body.listings?.some((entry) => entry.id === roomId),
    "the room appears in the public list",
  );

  // -------------------------------------------------------------------------
  console.log("\n== ownership ==");

  const foreignEdit = await api("PATCH", `/api/listings/${roomId}`, {
    identity: other,
    body: { title: "Stolen" },
  });
  check(
    foreignEdit.status === 404,
    "another user cannot edit your room",
    `status=${foreignEdit.status}`,
  );

  const foreignDelete = await api("DELETE", `/api/listings/${roomId}`, {
    identity: other,
  });
  check(
    foreignDelete.status === 404,
    "another user cannot delete your room",
    `status=${foreignDelete.status}`,
  );

  const afterAttack = await api("GET", `/api/listings/${roomId}`);
  check(
    afterAttack.body.listing?.title === "API test room",
    "the room survived both attempts unchanged",
  );

  // -------------------------------------------------------------------------
  console.log("\n== booking a slot ==");

  const anonymousBooking = await api("POST", "/api/bookings", {
    body: { adId: "ad-anon", listingId: roomId, startsOn: BASE_DATE },
  });
  check(
    anonymousBooking.status === 401,
    "signed-out booking is refused",
    `status=${anonymousBooking.status}`,
  );

  const ownRoom = await api("POST", "/api/bookings", {
    identity: owner,
    body: { adId: "ad-owner", listingId: roomId, startsOn: BASE_DATE },
  });
  check(
    ownRoom.status === 409,
    "booking your own room is refused",
    `status=${ownRoom.status}`,
  );

  const past = await api("POST", "/api/bookings", {
    identity: advertiser,
    body: { adId: "ad-past", listingId: roomId, startsOn: "2020-01-01" },
  });
  check(past.status === 400, "a past start date is refused", `status=${past.status}`);

  const booking = await api("POST", "/api/bookings", {
    identity: advertiser,
    // priceSats and endsOn are deliberately included: neither may be honoured.
    body: {
      adId: "ad-first",
      listingId: roomId,
      startsOn: BASE_DATE,
      endsOn: "2031-12-31",
      priceSats: 1,
    },
  });
  check(
    booking.status === 201,
    "booking a slot succeeds",
    `status=${booking.status}`,
  );
  const first = booking.body.booking;
  check(
    first?.endsOn === addDays(BASE_DATE, 6),
    "the end date comes from the room's ad length, not the request",
    `${first?.startsOn} → ${first?.endsOn}`,
  );
  check(
    first?.room?.priceSats === 5000,
    "the price comes from the room, never from the browser",
    `${first?.room?.priceSats}`,
  );
  check(
    booking.body.receipt?.totalSats === 35000,
    "the receipt is 7 days at 5000 sats",
    `${booking.body.receipt?.totalSats}`,
  );
  check(first?.status === "pending", "a new booking starts pending");

  // -------------------------------------------------------------------------
  console.log("\n== first come, first serve ==");

  const second = await api("POST", "/api/bookings", {
    identity: other,
    body: { adId: "ad-second", listingId: roomId, startsOn: BASE_DATE },
  });
  check(
    second.status === 409,
    "a full room refuses the next booking",
    `status=${second.status}`,
  );

  const overlap = await api("POST", "/api/bookings", {
    identity: other,
    body: { adId: "ad-overlap", listingId: roomId, startsOn: addDays(BASE_DATE, 3) },
  });
  check(
    overlap.status === 409,
    "a booking that only overlaps the taken days is also refused",
    `status=${overlap.status}`,
  );

  const after = await api("POST", "/api/bookings", {
    identity: other,
    body: { adId: "ad-after", listingId: roomId, startsOn: addDays(BASE_DATE, 7) },
  });
  check(
    after.status === 201,
    "a room that is free again after the ad run accepts the next booking",
    `status=${after.status}`,
  );

  // -------------------------------------------------------------------------
  console.log("\n== the same ad twice ==");

  const retry = await api("POST", "/api/bookings", {
    identity: advertiser,
    body: { adId: "ad-first", listingId: roomId, startsOn: BASE_DATE },
  });
  check(
    retry.status === 200 && retry.body.booking?.id === first?.id,
    "resubmitting the same ad returns the same booking, not a second one",
    `status=${retry.status}`,
  );

  const mine = await api("GET", "/api/bookings", { identity: advertiser });
  const firstAdCount =
    mine.body.booked?.filter((entry) => entry.adId === "ad-first").length ?? 0;
  check(firstAdCount === 1, "exactly one booking exists for that ad id", `${firstAdCount}`);

  // -------------------------------------------------------------------------
  console.log("\n== status transitions ==");

  const illegal = await api("PATCH", `/api/bookings/${first?.id}`, {
    identity: owner,
    body: { status: "completed" },
  });
  check(
    illegal.status === 409,
    "pending cannot jump straight to completed",
    `status=${illegal.status}`,
  );

  const wrongRole = await api("PATCH", `/api/bookings/${first?.id}`, {
    identity: advertiser,
    body: { status: "approved" },
  });
  check(
    wrongRole.status === 403,
    "the advertiser cannot approve their own booking",
    `status=${wrongRole.status}`,
  );

  const unknown = await api("PATCH", `/api/bookings/${first?.id}`, {
    identity: other,
    body: { status: "approved" },
  });
  check(
    unknown.status === 404,
    "a stranger cannot touch the booking at all",
    `status=${unknown.status}`,
  );

  const approved = await api("PATCH", `/api/bookings/${first?.id}`, {
    identity: owner,
    body: { status: "approved" },
  });
  check(
    approved.status === 200 && approved.body.booking?.status === "approved",
    "the room owner approves",
    `status=${approved.body.booking?.status}`,
  );

  const completed = await api("PATCH", `/api/bookings/${first?.id}`, {
    identity: advertiser,
    body: { status: "completed" },
  });
  check(
    completed.status === 200 && completed.body.booking?.status === "completed",
    "the advertiser marks it completed",
    `status=${completed.body.booking?.status}`,
  );

  // -------------------------------------------------------------------------
  console.log("\n== capacity above one ==");

  const shared = await api("POST", "/api/listings", {
    identity: owner,
    body: {
      title: "API test room, three ads wide",
      category: "Bitcoin",
      priceSats: 1000,
      adDurationDays: 3,
      maxAds: 3,
    },
  });
  const sharedId = shared.body.listing?.id;
  check(shared.status === 201, "a room with capacity 3 is created");

  const sharedBookings = [];
  for (const [index, identity] of [advertiser, other].entries()) {
    sharedBookings.push(
      await api("POST", "/api/bookings", {
        identity,
        body: {
          adId: `ad-shared-${index}`,
          listingId: sharedId,
          startsOn: BASE_DATE,
        },
      }),
    );
  }
  check(
    sharedBookings.every((entry) => entry.status === 201),
    "two advertisers take two of the three places",
    sharedBookings.map((entry) => entry.status).join(", "),
  );
  check(
    sharedBookings[0].body.booking?.endsOn === addDays(BASE_DATE, 2),
    "the shared room's shorter ad length is honoured",
    `${sharedBookings[0].body.booking?.endsOn}`,
  );

  // The owner fills the third and last place using a second identity, because the
  // owner may not book their own room.
  const third = await api("POST", "/api/bookings", {
    identity: await signIn("apitest-third"),
    body: { adId: "ad-shared-2", listingId: sharedId, startsOn: BASE_DATE },
  });
  check(third.status === 201, "the third place is taken", `status=${third.status}`);

  const fourth = await api("POST", "/api/bookings", {
    identity: await signIn("apitest-fourth"),
    body: { adId: "ad-shared-3", listingId: sharedId, startsOn: BASE_DATE },
  });
  check(
    fourth.status === 409,
    "the fourth is refused — the room is full",
    `status=${fourth.status}`,
  );

  const fourthElsewhere = await api("POST", "/api/bookings", {
    identity: await signIn("apitest-fifth"),
    body: {
      adId: "ad-shared-3",
      listingId: sharedId,
      startsOn: addDays(BASE_DATE, 3),
    },
  });
  check(
    fourthElsewhere.status === 201,
    "the same ad is free to book a room that has space",
    `status=${fourthElsewhere.status}`,
  );

  // -------------------------------------------------------------------------
  console.log("\n== the dashboard's two sides ==");

  const ownerView = await api("GET", "/api/bookings", { identity: owner });
  const incomingIds = new Set((ownerView.body.incoming ?? []).map((b) => b.id));
  check(
    incomingIds.has(sharedBookings[0].body.booking?.id),
    "the owner sees bookings made on their rooms",
  );
  check(
    (ownerView.body.booked ?? []).length === 0,
    "the owner sees no bookings they made themselves",
  );

  const advertiserView = await api("GET", "/api/bookings", { identity: advertiser });
  check(
    (advertiserView.body.booked ?? []).length === 2,
    "the advertiser sees both of their bookings",
    `${advertiserView.body.booked?.length}`,
  );

  const receipt = await api("GET", `/api/bookings/${first?.id}`, {
    identity: advertiser,
  });
  check(
    receipt.status === 200 && receipt.body.receipt?.reference === first?.id,
    "the receipt is readable by the advertiser",
  );
  const strangerReceipt = await api("GET", `/api/bookings/${first?.id}`, {
    identity: await signIn("apitest-nosy"),
  });
  check(
    strangerReceipt.status === 404,
    "a stranger cannot read someone else's receipt",
    `status=${strangerReceipt.status}`,
  );

  // -------------------------------------------------------------------------
  console.log("\n== cancelling frees the dates ==");

  const cancelling = await api("POST", "/api/bookings", {
    identity: advertiser,
    body: { adId: "ad-cancel-me", listingId: roomId, startsOn: addDays(BASE_DATE, 14) },
  });
  check(cancelling.status === 201, "a booking is made to be cancelled");

  const blocked = await api("POST", "/api/bookings", {
    identity: other,
    body: { adId: "ad-blocked", listingId: roomId, startsOn: addDays(BASE_DATE, 14) },
  });
  check(blocked.status === 409, "the dates are taken while it stands");

  const cancelled = await api("PATCH", `/api/bookings/${cancelling.body.booking?.id}`, {
    identity: advertiser,
    body: { status: "cancelled" },
  });
  check(
    cancelled.status === 200 && cancelled.body.booking?.status === "cancelled",
    "the advertiser cancels",
    `${cancelled.body.booking?.status}`,
  );

  const released = await api("POST", "/api/bookings", {
    identity: other,
    body: { adId: "ad-freed", listingId: roomId, startsOn: addDays(BASE_DATE, 14) },
  });
  check(
    released.status === 201,
    "the freed dates are bookable again",
    `status=${released.status}`,
  );

  // -------------------------------------------------------------------------
  console.log("\n== deleting a room ==");

  const inUse = await api("DELETE", `/api/listings/${roomId}`, { identity: owner });
  check(
    inUse.status === 409,
    "a room with bookings cannot be deleted",
    `status=${inUse.status}`,
  );

  const disposable = await api("POST", "/api/listings", {
    identity: owner,
    body: { title: "Disposable room", category: "Bitcoin", priceSats: 100 },
  });
  const disposableId = disposable.body.listing?.id;
  const removed = await api("DELETE", `/api/listings/${disposableId}`, {
    identity: owner,
  });
  check(removed.status === 200, "an unbooked room is deleted", `status=${removed.status}`);
  const gone = await api("GET", `/api/listings/${disposableId}`);
  check(gone.status === 404, "the deleted room is gone", `status=${gone.status}`);

  // -------------------------------------------------------------------------
  // Clean up. Rows are matched by the test identities, so nothing a real user
  // created is touched.
  console.log("\n== cleanup ==");
  const ownerDb = await connect(process.env.MIGRATION_DATABASE_URL);
  const pubkeys = [owner.pubkey, advertiser.pubkey, other.pubkey];
  // Bookings first: they reference listings, and that foreign key is RESTRICT, so
  // deleting a room that still has bookings is refused.
  await ownerDb.query(
    "delete from bookings where advertiser_pubkey = any($1::text[]) or listing_id in (select id from listings where pubkey = any($1::text[]))",
    [pubkeys],
  );
  // Rooms owned by test identities, plus any room left behind by a signed-in
  // throwaway account, which owns nothing.
  await ownerDb.query(
    `delete from listings
      where pubkey = any($1::text[])
         or pubkey in (select pubkey from profiles where username like 'apitest-%')`,
    [pubkeys],
  );
  await ownerDb.query("delete from sessions where pubkey = any($1::text[])", [pubkeys]);
  await ownerDb.query(
    "delete from profiles where pubkey = any($1::text[]) or username like 'apitest-%'",
    [pubkeys],
  );
  await ownerDb.query("delete from auth_challenges");
  await ownerDb.end();
  console.log("  removed the rooms, bookings, sessions and profiles this run made");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(`test-api: ${error.message}`);
  process.exit(1);
});
