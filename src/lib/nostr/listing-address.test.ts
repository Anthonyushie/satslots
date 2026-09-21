import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  LISTING_KIND,
  LISTING_NAMESPACE,
  buildListingAddress,
  parseListingAddress,
} from "./listing-event";

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

/**
 * The generated-column expression, with the constants substituted in.
 *
 * Building the expected string from LISTING_KIND and LISTING_NAMESPACE is the
 * whole point: it is what makes this a cross-check rather than a tautology. If
 * either constant moves, this fails until the SQL moves with it.
 */
const EXPECTED_EXPRESSION = `('${LISTING_KIND}:' || pubkey || ':${LISTING_NAMESPACE}' || listing_id)`;

/**
 * The most recent migration that (re)defines listings.address.
 *
 * Filename order is the order migrate.mjs applies, so the last definition wins —
 * the same resolution the database performs. 0001 defined this column *without*
 * the namespace and 0011 corrected it, so asserting against 0001 is precisely
 * what let the mismatch through: the old test substring-matched the migration
 * text and never composed a value, so it stayed green while the stored address
 * and the wire address differed by nine characters.
 */
function latestAddressDefinition(): { file: string; sql: string } {
  // Whitespace-tolerant: 0001 aligns the column name with padding, so a literal
  // single-space needle would silently skip it and find only 0011.
  const definesAddress = /address\s+text\s+generated always as/;
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const defining = files.filter((name) =>
    definesAddress.test(readFileSync(join(MIGRATIONS_DIR, name), "utf8")),
  );
  expect(defining.length).toBeGreaterThan(0);
  const file = defining[defining.length - 1];
  return { file, sql: readFileSync(join(MIGRATIONS_DIR, file), "utf8") };
}

test("the newest address definition composes the wire address exactly", () => {
  const { sql } = latestAddressDefinition();
  expect(sql).toContain(EXPECTED_EXPRESSION);
});

test("listing kind is the value the schema was written against", () => {
  expect(LISTING_KIND).toBe(30078);
});

test("an address round-trips through build and parse", () => {
  const pubkey = "a".repeat(64);
  const listingId = "xK9mQ2-test_id";
  const address = buildListingAddress(pubkey, listingId);

  // Spelled out rather than composed, so this fails if buildListingAddress
  // silently changes shape.
  expect(address).toBe(`30078:${pubkey}:satslots:${listingId}`);
  expect(parseListingAddress(address)).toEqual({ pubkey, listingId });
});

test("parse rejects anything that is not a listing address", () => {
  const pubkey = "a".repeat(64);
  const rejected: unknown[] = [
    undefined,
    null,
    42,
    "",
    `30078:${pubkey}`, // too few parts
    `${LISTING_KIND}:${pubkey}:${LISTING_NAMESPACE}`, // no listingId
    `1:${pubkey}:${LISTING_NAMESPACE}abc`, // wrong kind
    `30078:${"A".repeat(64)}:${LISTING_NAMESPACE}abc`, // uppercase pubkey
    `30078:${pubkey}:abc`, // namespace missing
    `30078:${pubkey}:${LISTING_NAMESPACE}bad id`, // invalid listingId
  ];
  for (const value of rejected) {
    expect(parseListingAddress(value), String(value)).toBeNull();
  }
});
