import "server-only";
import type { ZodType } from "zod";
import { jsonError } from "@/lib/auth/http";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { isRouteError } from "@/lib/db/client";

/**
 * Shared plumbing for the marketplace routes.
 *
 * The auth routes under src/app/api/auth predate this module and keep their own
 * inline handling; new routes should use these helpers so the 401/400 shapes stay
 * consistent with jsonError() in src/lib/auth/http.ts.
 */

/**
 * Reads the signed-in user, or returns the 401 response to send instead.
 *
 * The union forces the caller to branch, so a route cannot forget the
 * unauthenticated case and dereference a null user.
 */
export async function requireUser(): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: Response }
> {
  const user = await getSession();
  if (!user) return { response: jsonError("Sign in to continue.", 401) };
  return { user };
}

/**
 * Parses and validates a JSON body, or returns the 400 response to send instead.
 *
 * The first issue is named by field so the caller learns which input was wrong
 * rather than just that something was.
 */
export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<
  { data: T; response?: undefined } | { data?: undefined; response: Response }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: jsonError("Expected a JSON body.", 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".");
    return {
      response: jsonError(
        issue ? `${field ? `${field}: ` : ""}${issue.message}` : "Invalid request body.",
        400,
      ),
    };
  }
  return { data: parsed.data };
}

/** PostgreSQL error codes this API reacts to by name. */
export const PG_UNIQUE_VIOLATION = "23505";
/** A foreign key declared NO ACTION refused the write. */
export const PG_FOREIGN_KEY_VIOLATION = "23503";
/**
 * A foreign key declared RESTRICT refused the write.
 *
 * Distinct from 23503, and easy to miss: the constraint on
 * bookings.listing_id is RESTRICT, so deleting a room that still has bookings
 * raises this one, not the code most examples check for.
 */
export const PG_RESTRICT_VIOLATION = "23001";


/**
 * Extracts a PostgreSQL error code, or null for anything else.
 *
 * Used to turn a constraint violation into the right status code rather than a 500.
 */
export function pgErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Wraps a route body so an unexpected throw becomes a 500 with a logged cause
 * instead of an unhandled rejection.
 */
export async function route(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    // An unreachable database is not a bug in the request, and telling the caller
    // "something went wrong" sends them looking for a mistake they did not make.
    if (isRouteError(error)) {
      console.error("api route could not reach the database:", error);
      return jsonError(
        "The database could not be reached. Please try again.",
        503,
      );
    }
    console.error("api route failed:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}

/** Shared cache headers: none of these responses may be cached. */
export const NO_STORE = { "cache-control": "no-store" } as const;

export function ok(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}
