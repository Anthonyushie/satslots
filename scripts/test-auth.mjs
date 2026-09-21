#!/usr/bin/env node
/**
 * End-to-end checks for the NIP-42 sign-in flow against a running server.
 *
 * Not part of `npm run test:e2e`: unlike the browser suite, this needs a live
 * Neon database, so it is opt-in.
 *
 *   npm run build && npm run start     # in one terminal
 *   npm run test:auth                  # in another
 *
 * It writes real rows (a profile, sessions, challenges) and deletes them again
 * on the way out. Test keys are generated per run and never reused.
 */
import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
} from "nostr-tools/pure";
import pg from "pg";

const BASE = process.env.AUTH_TEST_BASE_URL ?? "http://127.0.0.1:3000";
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

const body = (response) => response.json().catch(() => ({}));

/**
 * A 500 from these routes means the database was unreachable, never a verdict on
 * the request. Retrying keeps a flaky connectivity window from being reported as
 * a failed security assertion — the exact confusion that hid the missing
 * auth_challenges grant.
 */
async function withDbRetry(send, attempts = 6) {
  for (let i = 0; ; i += 1) {
    const response = await send();
    if (response.status !== 500 || i >= attempts - 1) return response;
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
}

async function issueChallenge(origin = ORIGIN) {
  const response = await withDbRetry(() =>
    fetch(`${BASE}/api/auth/challenge`, {
      method: "POST",
      headers: { origin },
    }),
  );
  return { status: response.status, body: await body(response) };
}

function signChallenge(nonce, audience, secretKey, overrides = {}) {
  return finalizeEvent(
    {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["relay", audience],
        ["challenge", nonce],
      ],
      content: "",
      ...overrides,
    },
    secretKey,
  );
}

async function postVerify(event, origin = ORIGIN) {
  const response = await withDbRetry(() =>
    fetch(`${BASE}/api/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ event, username: "testuser" }),
    }),
  );
  return {
    status: response.status,
    setCookie: response.headers.getSetCookie?.() ?? [],
    body: await body(response),
  };
}

async function preflight() {
  // Neon reachability here is genuinely intermittent — a run can time out for
  // minutes and then connect in ~2s. Wait out the bad windows rather than
  // reporting a failure that says nothing about the code under test.
  const waitMs = Number(process.env.AUTH_TEST_WAIT_SECONDS ?? 180) * 1000;
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
      if (response.status !== 500) break; // not a connectivity problem
    } catch (error) {
      last = `cannot reach ${BASE} (${error.cause?.code ?? error.name})`;
      console.error(
        `test-auth: ${last}. Start the server first: npm run build && npm run start`,
      );
      break;
    }
    if (Date.now() >= deadline) break;
    if (attempt === 1) {
      console.log(
        `test-auth: waiting for the database (up to ${waitMs / 1000}s)…`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  console.error(
    `test-auth: ${BASE}/api/auth/challenge never returned 200 (last: ${last}).\n` +
      `  The server log holds the actual error. If it is ETIMEDOUT, the machine\n` +
      `  cannot reach Neon right now — that is connectivity, not application code.`,
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

  const secretKey = generateSecretKey();
  const pubkey = getPublicKey(secretKey);

  console.log("== happy path ==");
  const challenge = await issueChallenge();
  check(
    challenge.status === 200 && /^[0-9a-f]{64}$/.test(challenge.body.nonce),
    "challenge issued",
    `${challenge.body.nonce?.slice(0, 12)}…`,
  );

  const verified = await postVerify(
    signChallenge(challenge.body.nonce, challenge.body.audience, secretKey),
  );
  const cookieHeader = verified.setCookie.find((entry) =>
    entry.startsWith("satslots_session="),
  );
  const cookie = (cookieHeader ?? "").split(";")[0];
  const allCookies = verified.setCookie.join("; ");

  check(
    verified.status === 200,
    "valid signature accepted",
    `status=${verified.status}`,
  );
  check(cookie.length > 20, "session cookie issued");
  check(/HttpOnly/i.test(allCookies), "cookie is HttpOnly");
  check(/SameSite=lax/i.test(allCookies), "cookie is SameSite=Lax");
  check(verified.body.user?.pubkey === pubkey, "returns the signed-in user");

  const session = await (
    await withDbRetry(() =>
      fetch(`${BASE}/api/auth/session`, { headers: { cookie } }),
    )
  ).json();
  check(
    session.user?.pubkey === pubkey,
    "GET /api/auth/session returns the user",
  );

  console.log("\n== replay and forgery ==");
  const replay = await postVerify(
    signChallenge(challenge.body.nonce, challenge.body.audience, secretKey),
  );
  check(
    replay.status === 401,
    "replaying the same signed event is rejected",
    `status=${replay.status}`,
  );

  const c2 = await issueChallenge();
  const stale = finalizeEvent(
    {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000) - 600,
      tags: [
        ["relay", c2.body.audience],
        ["challenge", c2.body.nonce],
      ],
      content: "",
    },
    secretKey,
  );
  check(
    (await postVerify(stale)).status === 401,
    "stale created_at is rejected",
  );

  const c3 = await issueChallenge();
  const good = signChallenge(c3.body.nonce, c3.body.audience, secretKey);
  check(
    (await postVerify({ ...good, sig: "0".repeat(128) })).status === 401,
    "tampered signature is rejected",
  );

  const c4 = await issueChallenge();
  check(
    (
      await postVerify(
        signChallenge(c4.body.nonce, c4.body.audience, secretKey, { kind: 1 }),
      )
    ).status === 401,
    "wrong event kind is rejected",
  );

  const c5 = await issueChallenge();
  check(
    (
      await postVerify(
        signChallenge(c5.body.nonce, "https://evil.example", secretKey),
      )
    ).status === 401,
    "signature bound to another origin is rejected",
  );

  const noTags = finalizeEvent(
    {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: "",
    },
    secretKey,
  );
  check(
    (await postVerify(noTags)).status === 401,
    "event with no challenge tag is rejected",
  );

  check(
    (await postVerify(signChallenge("9".repeat(64), ORIGIN, secretKey)))
      .status === 401,
    "unknown nonce is rejected",
  );

  console.log("\n== CSRF ==");
  const crossChallenge = await fetch(`${BASE}/api/auth/challenge`, {
    method: "POST",
    headers: { origin: "https://evil.example" },
  });
  check(
    crossChallenge.status === 403,
    "cross-origin challenge is rejected",
    `status=${crossChallenge.status}`,
  );

  const c7 = await issueChallenge();
  check(
    (
      await postVerify(
        signChallenge(c7.body.nonce, c7.body.audience, secretKey),
        "https://evil.example",
      )
    ).status === 403,
    "cross-origin verify is rejected",
  );

  console.log("\n== logout ==");
  const logout = await withDbRetry(() =>
    fetch(`${BASE}/api/auth/logout`, {
      method: "POST",
      headers: { cookie, origin: ORIGIN },
    }),
  );
  check(logout.status === 200, "logout succeeds");
  const afterLogout = await (
    await withDbRetry(() =>
      fetch(`${BASE}/api/auth/session`, { headers: { cookie } }),
    )
  ).json();
  check(afterLogout.user === null, "session is dead after logout");

  console.log("\n== persisted state ==");
  const app = await connect(process.env.DATABASE_URL);
  const profiles = await app.query(
    "select username from profiles where pubkey = $1",
    [pubkey],
  );
  check(
    profiles.rowCount === 1,
    "profile persisted",
    profiles.rows[0]?.username,
  );

  const sessions = await app.query(
    "select token_hash, revoked_at from sessions where pubkey = $1",
    [pubkey],
  );
  const rawToken = cookie.slice("satslots_session=".length);
  check(
    !sessions.rows.some((row) => row.token_hash === rawToken),
    "raw session token is never stored — only its hash",
  );
  check(
    sessions.rows.length > 0 &&
      sessions.rows.every((row) => row.revoked_at !== null),
    "session rows are marked revoked",
  );
  await app.end();

  const owner = await connect(process.env.MIGRATION_DATABASE_URL);
  await owner.query("delete from sessions where pubkey = $1", [pubkey]);
  await owner.query("delete from profiles where pubkey = $1", [pubkey]);
  await owner.query("delete from auth_challenges");
  await owner.end();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(`test-auth: ${error.message}`);
  process.exit(1);
});
