# SatSlots listing event — schema version 1

This is the P0 protocol contract for issue #3. Implemented in `src/lib/nostr/`.
The marketplace UI, database, backend sessions, and Lightning booking system are
not changed by this service. Kind-0 profiles and listing content remain untrusted.

## Event envelope

- NIP-01 signed event; kind **30078** (NIP-78 addressable application data).
- The NIP-07 extension supplies `pubkey`, `id`, and `sig`. No application private keys.
- `created_at`: nonnegative integer Unix seconds, at most 300 seconds ahead of the
  local clock. The publisher normally uses the current time.
- `d`: `satslots:<listingId>`. The prefix avoids collisions with other kind-30078
  applications belonging to the same author. `listingId` is 1–128 ASCII letters,
  digits, underscores, or hyphens. Generate it once (e.g. `crypto.randomUUID()`) and
  persist/reuse it for revisions; it is not the event ID.
- Stable address: `30078:<pubkey>:satslots:<listingId>`.

Required tags, exactly as emitted by `buildListingEvent`:

```json
[
  ["d", "satslots:example-listing"],
  ["t", "satslots"],
  ["t", "satslots-listing"],
  ["t", "Bitcoin"],
  ["client", "satslots"]
]
```

Exactly one two-element `d` tag and one two-element `client` tag are required.
The category tag must match content; conflicting supported categories are
rejected. The two application-topic tags are mandatory. Additional bounded tags
are ignored. Tags have a maximum of 64 entries, eight strings per entry, and
2,048 JavaScript UTF-16 code units per string.

## Content

`content` is a JSON **string** containing this object, not nested event fields:

```json
{
  "schemaVersion": 1,
  "name": "Example publication",
  "category": "Bitcoin",
  "description": "A sponsorship placement on an independent publication.",
  "priceSats": 5000,
  "websiteUrl": "https://example.com",
  "audience": "Independent developers"
}
```

| Field           | Rule                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | Exactly integer `1`; assigned by the builder, not a `ListingInput` field                                              |
| `name`          | Nonblank string, maximum 120 UTF-16 code units                                                                        |
| `category`      | Exactly `Bitcoin`, `Design`, or `Development`                                                                         |
| `description`   | Nonblank string, maximum 4,000 UTF-16 code units                                                                      |
| `priceSats`     | **Daily** price in sats; integer from 1 through 9,007,199,254,740,991                                                 |
| `websiteUrl`    | Absolute HTTP(S) URL with hostname; at most 2,048 UTF-16 code units; no credentials, whitespace or control characters |
| `audience`      | Optional nonblank string, maximum 500 UTF-16 code units                                                               |

No extra JSON properties are allowed. Text fields reject C0 controls other than
TAB, LF, and CR, plus DEL. JSON content is limited to **16,384 UTF-8 bytes**,
including serialization overhead. The complete signed event is capped at 65,536
UTF-8 bytes, and the default adapter ignores incoming wire frames larger than
131,072 UTF-16 code units before JSON parsing or cryptographic verification.
Application string limits and the byte limits are separate. Inputs are not silently trimmed or prices coerced from strings.
`audience: null` is invalid; omit the property if absent.

The parser verifies the ID and Schnorr signature over a fresh copy of the wire
fields. This avoids trusting a cached verification flag on a modified object.
It returns only allowlisted `NostrListing` fields; malformed JSON, unsupported
schemas, incorrect tags, bad signatures, and oversized events are ignored.

## Discovery and replacement

1. Query kind `30078` with `#t: ["satslots-listing"]`, optionally exact authors.
2. Verify and validate events. Never render arbitrary relay JSON or HTML.
3. Deduplicate valid listings by the full address (kind, author, and `d`). The
   same listing ID from different authors represents different listings.
4. Keep greatest `created_at`; equal timestamps select the **lowest
   lexicographical event ID**, per NIP-01.
5. Apply category and requested result limit **after** revision selection, then
   return newest-first listings with event-ID tie ordering.

Category is deliberately not used as an initial relay filter: an old Bitcoin
revision must not reappear after a newer revision changes that listing to Design.
The newest _valid_ listing observed in the bounded query is used. Relays can omit,
truncate, or withhold newer events; discovery is not an authoritative inventory
or a global completeness guarantee. Unsupported newer schemas are skipped. NIP-09
deletion handling, historical pagination, and advanced discovery are not in P0.

## Relays and failure semantics

Default primary relays: `wss://relay.damus.io`, `wss://nos.lol`.
Default fallback relays: `wss://relay.nostr.band`, `wss://nostr.wine`.
They are examples of configurable public relays, **not guaranteed available**;
operators can require authentication, payment, or reject this event kind.
The service does not sign relay-auth requests automatically.

- Primaries run in parallel. If **any** primary fails, fallbacks run in parallel.
- One successful relay is sufficient. Publish success requires a positive relay
  acknowledgement, not just successful signing or a socket write.
- Default whole-operation deadline is 5 seconds per relay. A primary plus fallback
  round can take about 10 seconds. Allowed deadline: 100–30,000 milliseconds.
- Default event cap is 200 per relay (configurable 1–1,000); at most eight configured
  relay entries. Connections/subscriptions are operation-scoped, not persistent.
- An EOSE response with no matching events is successful empty discovery.
- Incomplete timed-out/closed queries are discarded and reported as failures.
- Reaching the local event cap returns the bounded result with `truncated: true`.
- If all attempted relays fail, throw `RelayOperationError` with per-relay reasons;
  do not return an empty marketplace or successful publication.
- Successful calls retain individual failure diagnostics for nonblocking warnings.

## Security and integration boundaries

A signature proves control of the author's key, not website ownership, reputation,
availability, moderation approval, or payment. Public profiles and listing text
are assertions by their author. Render text through React's normal escaping;
never use `dangerouslySetInnerHTML`. Do not fetch these URLs server-side without
separate SSRF protections. Rendering remote avatars also exposes users to the
image host; choose an appropriate frontend privacy policy.

`connectNostr` establishes a **local extension connection**, not a backend session.
Josh's backend must authenticate the requester, bind ownership to a verified
pubkey, validate persisted events itself, enforce authorization, and calculate
booking/payment amounts server-side. Receiving an `eventId` is not proof that a
backend save succeeded. No database fields or backend routes are invented here.

See [integration examples](./nostr-integration.md) for the frontend handoff.
