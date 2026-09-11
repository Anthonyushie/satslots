# Nostr P0 integration handoff

For **@wutche (Chikaome)**: import the service from `@/lib/nostr`. This PR intentionally
leaves the header, marketplace, dialogs, and sample/local inventory unchanged.
You own the UI wiring; there is no second state store, React provider, or component
design to adopt. The existing `Listing` union is unchanged: adapt `NostrListing`
explicitly instead of pretending relay inventory is a sample/local listing.

## Connect in a browser action

```ts
import {
  connectNostr,
  createNostrClient,
  isNip07Available,
  NostrError,
  RelayOperationError,
} from "@/lib/nostr";

const client = createNostrClient(); // or pass explicit relay configuration

async function connect() {
  if (!isNip07Available()) {
    // Show extension-install/enable guidance and a Retry action.
    return;
  }
  try {
    const connection = await connectNostr({ client });
    // Store connection.pubkey and connection.profile in your React state.
    // profile contains { pubkey, name, avatar, bio } for backend mapping.
    // profileStatus: "found", "missing", or "unavailable".
    // "unavailable" means connected signer, but all profile relays failed.
    // Offer a profile retry rather than showing a false authentication failure.
    return connection;
  } catch (error) {
    if (error instanceof NostrError) {
      // EXTENSION_UNAVAILABLE, EXTENSION_REJECTED, INVALID_INPUT, etc.
      // Render a human-readable error and allow user-initiated retry.
    }
    throw error;
  }
}
```

Only access the extension in client-side actions. Importing these modules during
Next.js static rendering is safe: neither `window` nor a socket is required at
module initialization. Relay I/O needs a runtime with WebSocket support (browsers;
Node 22+ provides it). On older Node runtimes supply a compatible implementation
through nostr-tools' `useWebSocketImplementation` before relay use. No server
polyfill dependency is added by this PR.

There is no automatic persistence or global "current user". On disconnect, clear
your UI identity/profile state and any backend session independently. The service
cannot revoke an extension's site permissions; the user manages those there.
Changing accounts during an async operation requires reconnecting. Pass the stored
pubkey as `expectedPubkey` when signing to guard this boundary.

## Publish a listing

```ts
import { publishListing, type ListingInput } from "@/lib/nostr";

async function publish(input: ListingInput, connectedPubkey: string) {
  const result = await publishListing(input, {
    client,
    expectedPubkey: connectedPubkey,
  });
  // result.eventId: pass to the backend through the agreed persistence API.
  // result.acceptedRelays: positive relay acknowledgements.
  // result.failedRelays: failures even when publication succeeded elsewhere.
  return result;
}
```

Generate `listingId` once, then reuse it for edits. `priceSats` is the DAILY price,
not the total booking amount. The existing local model's `price` can be mapped to
`priceSats` at your UI boundary. Do not pass `local`, art configuration, or other
frontend-only fields into `ListingInput`.

A failed call can be retried, but relays may have accepted an event even if an
acknowledgement was lost. For exact-event retry and backend verification, use the
lower-level functions and retain the signed event:

```ts
import { buildListingEvent, signNostrEvent } from "@/lib/nostr";

async function signAndPublish(input: ListingInput, connectedPubkey: string) {
  const event = await signNostrEvent(buildListingEvent(input), {
    expectedPubkey: connectedPubkey,
  });
  const publication = await client.publish(event);
  // Retain event for identical retry and hand it to the agreed backend API.
  // The backend must independently verify event and ownership, not trust the UI.
  return { event, publication };
}
```

Publishing never writes to a database. Model relay publication and backend
persistence as distinct async states. Do not report full listing creation if the
backend save failed, and do not erase a successful relay acknowledgement.

## Discover inventory

```ts
import { discoverListings } from "@/lib/nostr";

async function loadListings() {
  try {
    const { listings, relays } = await discoverListings(
      { category: "Bitcoin", limit: 50 },
      client,
    );
    // Use listing.address as the stable React key / revision identity.
    // eventId identifies one signed revision; pubkey identifies the publisher.
    // Render normal escaped text. No HTML rendering or URL trust implied.
    // Warn nonblockingly on failed or truncated relay results.
    return { listings, relays };
  } catch (error) {
    if (error instanceof RelayOperationError) {
      // All relays failed: show an error/retry state, not "no listings".
      // error.relays contains sanitized per-relay diagnostics.
    }
    throw error;
  }
}
```

`discoverListings` returns `{ listings, relays }`, not a bare array, so UI callers
can distinguish failures from successful empty inventory. `authors` accepts up
to 100 exact hexadecimal pubkeys. `limit` is 1–200 (default 50). Result size is
bounded; it is not a complete search index. Do not use discovered price or
availability as authority for bookings.

Every UI action should expose loading, success, failure, and retry states. No
live Nostr UI is added here; local samples remain until your integration PR.

## Public API summary

| Export                                                           | Result / purpose                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `isNip07Available()`                                             | SSR-safe extension detection                                                 |
| `getNostrPublicKey(provider?)`                                   | Canonical lowercase 64-character hex public key                              |
| `connectNostr({ client?, provider? })`                           | Identity, mapped profile, profile status, relay diagnostics                  |
| `getNostrProfile(pubkey, client?)`                               | Profile, `found`/`missing` status, relay diagnostics; throws on total outage |
| `mapNostrProfile(pubkey, metadata)`                              | Pure safe mapping to `{ pubkey, name, avatar, bio }`                         |
| `buildListingEvent(input)`                                       | Validated unsigned kind-30078 event template                                 |
| `signNostrEvent(template, { expectedPubkey?, provider? })`       | Verified, unchanged event signed by the intended identity                    |
| `publishListing(input, { client?, expectedPubkey?, provider? })` | Event ID, accepted relays, failed relays                                     |
| `parseListingEvent(unknown)`                                     | Validated `NostrListing`, or `null`                                          |
| `deduplicateListings(events)`                                    | Latest valid listings per full address                                       |
| `discoverListings(filters?, client?)`                            | Safe listings and relay diagnostics                                          |
| `getRelayConfig(overrides?)`                                     | Validated immutable primary/fallback configuration                           |
| `createNostrClient(config?)`                                     | Reusable client with operation-scoped connections                            |
| `client.query(filter)` / `client.publish(event)`                 | Bounded generic queries / verified signed-event publication                  |

Generic query filters support exact `ids`, exact `authors`, `kinds`, `since`,
`until`, `limit`, and single-letter tag filters such as `#t`. Unsupported filter
keys are rejected rather than sent arbitrarily. No full-text relay search in P0.

## Verification and manual smoke test

```sh
npm ci
npm run test:nostr
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

The Nostr suite uses real Schnorr signatures with public test-only keys,
mocked transport/extension responses, and wire-level tests exercising the actual
nostr-tools adapter with a simulated WebSocket. It requires neither live relays
nor a browser extension. Existing browser tests cover the unchanged landing page,
not real extension permissions or external relay availability.

After UI wiring, manually test: extension absent; permission denied; connection
with missing profile; account switch before signing; listing publication with a
positive relay acknowledgement; discovery of that event; edit with the same
identifier; one relay offline; all relays offline; and independent backend save
failure. Use a throwaway identity and harmless test listing, with explicit
consent before publishing anything to public relays. P1 caching, reputation,
relay-health UI, and advanced discovery are intentionally deferred.
