import "server-only";
import pg from "pg";

/**
 * Postgres connection pool for the application.
 *
 * The `server-only` import above is load-bearing: it makes the build fail if
 * anything reachable from the browser imports this module, which would ship
 * DATABASE_URL to clients. There is deliberately no NEXT_PUBLIC_ variant.
 *
 * Connects as the least-privilege `satslots_app` role created by
 * `npm run db:migrate`. Never use the owner role here — `neondb_owner` has
 * BYPASSRLS, which would silently disable every policy in db/migrations.
 *
 * The pool is cached on globalThis so Next.js dev-mode hot reloads do not
 * accumulate pools and exhaust the Neon connection limit.
 */

declare global {
  var __satslotsPool: pg.Pool | undefined;
}

export function getPool(): pg.Pool {
  if (!globalThis.__satslotsPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and run `npm run db:migrate`.",
      );
    }
    globalThis.__satslotsPool = new pg.Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      // Increased from 4s to 15s: Neon's host resolves to several addresses and
      // reachability comes and goes. A longer timeout allows slow connections
      // to succeed rather than failing fast and relying on retries.
      connectionTimeoutMillis: 15_000,
    });
  }
  return globalThis.__satslotsPool;
}

/**
 * Failures that mean the server was never reached.
 *
 * Deliberately excludes ECONNRESET and EPIPE from the retry check in
 * `withConnectionRetry`: those mean a connection was established and then
 * died, where a retry cannot be shown to be safe — the statement may already
 * have run.
 *
 * `isRouteError` below includes them because its only job is user-facing
 * error classification: tell the caller the database is away rather than
 * that their request was broken.
 */
const RETRY_UNREACHABLE_CODES = new Set([
  "ETIMEDOUT",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "ECONNREFUSED",
  "EAI_AGAIN",
]);

const ROUTE_UNREACHABLE_CODES = new Set([
  ...RETRY_UNREACHABLE_CODES,
  "ECONNRESET",
  "EPIPE",
  "ENOTFOUND",
  "EADDRNOTAVAIL",
]);

/**
 * True when the error is a TypeError thrown by the AggregateError constructor
 * because Node's net module passed null as the errors iterable. This happens
 * when Neon's DNS resolves to several addresses and all of them fail — the
 * collection-of-errors argument is null, so the built-in constructor throws
 * before the AggregateError is even created.
 */
function isBrokenAggregateError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const msg = error.message;
  return typeof msg === "string" && msg.includes("is not iterable");
}

/**
 * True for a connection-level failure, including one nested in the
 * AggregateError that Node raises when every resolved address fails.
 *
 * Used by `withConnectionRetry` to decide whether a failed attempt is safe
 * to replay: connection failures before the statement is sent can be
 * retried, but a connection that dies mid-statement cannot.
 */
export function isUnreachable(error: unknown): boolean {
  if (isAnyError(error, RETRY_UNREACHABLE_CODES)) return true;
  // Node's net module creates an AggregateError when all resolved addresses
  // fail. In some edge cases the errors list is null, so the AggregateError
  // constructor itself throws a TypeError instead of a proper error. Detect
  // that and treat it as a connection failure.
  if (isBrokenAggregateError(error)) return true;
  return false;
}

/**
 * True for any connection-level failure, used for user-facing error
 * classification in route handlers. Includes errors where a connection was
 * established and then died, since those still mean "the database is away"
 * rather than "your request was wrong."
 *
 * Some Node.js/pg errors don't carry a code but have tell-tale messages
 * ("Connection terminated...", "connection timeout"). These are checked
 * as a fallback after code matching.
 */
export function isRouteError(error: unknown): boolean {
  if (isAnyError(error, ROUTE_UNREACHABLE_CODES)) return true;
  if (isBrokenAggregateError(error)) return true;
  return isConnectionMessage(error);
}

const CONNECTION_MESSAGES = [
  "connection timeout",
  "connection terminated",
  "network is unreachable",
  "connect econnrefused",
];

function isConnectionMessage(error: unknown): boolean {
  const message = (error as { message?: unknown })?.message;
  if (typeof message !== "string") return false;
  const lower = message.toLowerCase();
  return CONNECTION_MESSAGES.some((m) => lower.includes(m));
}

function isAnyError(error: unknown, codes: Set<string>): boolean {
  const seen = new Set<unknown>();
  const walk = (candidate: unknown): boolean => {
    if (typeof candidate !== "object" || candidate === null) return false;
    if (seen.has(candidate)) return false;
    seen.add(candidate);

    const code = (candidate as { code?: unknown }).code;
    if (typeof code === "string" && codes.has(code)) return true;

    const { errors, cause } = candidate as {
      errors?: unknown;
      cause?: unknown;
    };
    if (Array.isArray(errors) && errors.some(walk)) return true;
    return walk(cause);
  };
  return walk(error);
}

const CONNECT_ATTEMPTS = 8;
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Runs `fn`, retrying while the database is unreachable.
 *
 * Only safe for work that has not started when the failure occurs: acquiring a
 * connection, or a statement that runs on a connection the pool still owns
 * (where a connect failure means nothing was sent). Never wrap a transaction.
 */
export async function withConnectionRetry<T>(
  fn: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= CONNECT_ATTEMPTS || !isUnreachable(error)) throw error;
      const delay = BASE_RETRY_DELAY_MS * Math.pow(1.5, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * A pooled client, with the connect retried.
 *
 * Reachability to Neon from this machine comes and goes: a request can fail to
 * connect several times and then succeed immediately. Without this, a blip
 * surfaces to the user as a 500 on an action that would otherwise have worked.
 */
export async function acquire(): Promise<pg.PoolClient> {
  return withConnectionRetry(() => getPool().connect());
}
