import "server-only";
import type pg from "pg";
import { acquire, getPool, withConnectionRetry } from "./client";

/**
 * Database access helpers.
 *
 * Two rules this module exists to enforce:
 *
 * 1. Anything that reads or writes user-owned rows must run inside `withUser`,
 *    which sets `app.pubkey` for the transaction. Without it, `current_pubkey()`
 *    is NULL and the RLS policies deny by default.
 *
 * 2. Row-level security filters UPDATE and DELETE silently. A cross-tenant
 *    update does not raise — it simply matches zero rows. Treating "no error"
 *    as "it worked" is therefore a real vulnerability, so use `expectOneRow`
 *    for any write that is supposed to change exactly one row.
 */

export type Tx = pg.PoolClient;

/** Raised when a write that must touch exactly one row touches a different number. */
export class RowCountError extends Error {
  constructor(
    message: string,
    public readonly actual: number,
  ) {
    super(message);
    this.name = "RowCountError";
  }
}

/**
 * Runs `fn` inside a transaction with `app.pubkey` set to `pubkey`, so RLS
 * policies apply as that identity.
 *
 * Pass `null` for operations that legitimately run before there is an identity
 * (profile creation during first sign-in, session lookup). Public reads should
 * prefer `query`, which skips the transaction overhead.
 */
export async function withUser<T>(
  pubkey: string | null,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  // Retried here only: once the transaction is open, a failure part-way through
  // must reach the caller rather than be silently replayed.
  const client = await acquire();
  try {
    await client.query("begin");
    if (pubkey) {
      // set_config, not `SET LOCAL app.pubkey = ...`: SET does not accept bind
      // parameters, and the value must never be string-interpolated.
      await client.query("select set_config('app.pubkey', $1, true)", [pubkey]);
    }
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** A read with no user identity. Subject to whatever RLS policies allow the public. */
export async function query<T extends object>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  // Retried on an unreachable database: a connect failure happens before the
  // statement is sent, so replaying it cannot duplicate work.
  const { rows } = await withConnectionRetry(() =>
    getPool().query(text, params as unknown[]),
  );  return rows as T[];
}

/**
 * Runs a write and returns the affected row count.
 *
 * Callers must inspect the result: zero means either "no such row" or "RLS
 * refused", and both are indistinguishable by design.
 */
export async function exec(
  tx: Tx,
  text: string,
  params: readonly unknown[] = [],
): Promise<number> {
  const result = await tx.query(text, params as unknown[]);
  return result.rowCount ?? 0;
}

/**
 * Runs a write that must affect exactly one row, throwing otherwise.
 *
 * Use this instead of `exec` wherever a silent zero-row result would otherwise
 * be reported to the user as success. The thrown error is deliberately
 * indistinguishable between "not found" and "not permitted" so that route
 * handlers cannot leak the existence of another user's rows.
 */
export async function expectOneRow(
  tx: Tx,
  text: string,
  params: readonly unknown[] = [],
): Promise<void> {
  const count = await exec(tx, text, params);
  if (count !== 1) {
    throw new RowCountError(`expected 1 affected row, got ${count}`, count);
  }
}
