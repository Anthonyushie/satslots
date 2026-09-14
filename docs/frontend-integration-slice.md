# Frontend integration: first read-only slice

Base: `d0b78c1` (main). This is a partial implementation of issue #4, not completion of the marketplace.

## Implemented

- Removed sample/local inventory and all simulated booking/payment success paths.
- Connected the existing Nostr services to user-initiated NIP-07 identity connection, profile status/retry, account disclosure, and disconnect. A Nostr signer connection is **not an authenticated backend session**. No user record or token is fabricated or persisted. Disconnect invalidates pending work but cannot revoke extension permissions.
- Read real listings from configured public relays. Loading, empty/category-empty, errors, retry, partial failure, and truncated-result notices are distinct. Refresh errors preserve prior results with a stale-data warning. Request generations ignore obsolete completions and unmounts.
- Use `NostrListing` directly, with `listing.address` as React key and modal selection identity. Event revisions cannot create a new UI identity. Content is rendered as text; service-validated external URLs use safe link attributes.
- Extracted native dialog lifecycle, publisher form, and placement details from the former 595-line dialog module. Native `showModal`, Escape, backdrop handling, scroll locking, StrictMode cleanup, and trigger focus restoration are retained.
- Publishing and booking controls are explicitly unavailable. Form submit is prevented even when programmatically requested. No API client, invoice, success state, signature request, or publication is added.

## Backend contracts required before writes (Josh / issue #2)

Issue #2 names future `/api/listings` CRUD, `/api/bookings`, `/api/campaigns`, LNbits, and analytics. These names alone are not usable contracts. No backend implementation or complete payload/authentication contract exists in this checkout.

Before implementing writes, agree on:

1. Authentication: challenge/nonce issuance and expiry, signed proof format and verification, replay protection, session cookie/token rules, CSRF and CORS, current-user response, logout and account switching.
2. Listings: request/response/error schemas, required fields and validation, database ID ↔ Nostr address/author mapping, ownership checks, create/update/delete permissions, idempotency, and source-of-truth rules. Specify whether DB persistence precedes Nostr publication and how partial failures/retries reconcile revisions without duplicates.
3. Bookings: listing reference, dates/timezone, availability and concurrency, server-authoritative quote/currency, creative payload, publisher approval states, cancellation and idempotency, and error/status responses.
4. Payments and campaigns: invoice creation/expiry, settlement verification and status transport, rejection/retry rules, LNbits wallet ownership and secret handling, campaign activation/delivery and analytics schemas. No browser-supplied price or relay listing is trusted for payment.

Until these exist, the frontend is intentionally Nostr **read-only**. Enabling public publication without durable DB association would create orphaned listings and misleading success. Identity does not bypass this blocker.

## Verification and privacy

Browser tests intercept every relay WebSocket and use a publicly known test-only signing key to construct fixture events. The extension is mocked; a signature request or EVENT publication fails the fixture. Tests cover unavailable/rejected extension, missing/unavailable/found profile, cancellation with late completion, discovery state transitions, revision identity, escaped text, blocked forms/checkout, focus restoration, responsive layouts (including long profile names and open account panels), theme and existing navigation.

Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:nostr`, `npm run build`, then `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --workers=2`. Format touched files with Prettier; the unrelated baseline README has a pre-existing format-check failure.

Opening the marketplace queries public relays and reveals the visitor's IP to their operators. No remote avatar is automatically loaded, avoiding an additional profile-supplied tracking request. No profile persistence or private key storage is introduced. Live extension permissions and live relay availability still require separately authorized manual testing; automated tests do not contact public relays or a real user identity.

## Follow-up planning surfaces

See [Frontend planning scaffolds](./frontend-planning-scaffolds.md) for the local listing review, requested booking dates, campaign creative workspace, unavailable ad delivery, and analytics surface added on top of this slice. All write/payment actions remain unavailable. The browser suite now contains 28 tests (the original 21 plus 7 planning tests); the 70 Nostr tests are unchanged.
