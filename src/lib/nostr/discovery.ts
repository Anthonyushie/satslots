import { createNostrClient, type NostrClient } from "./client";
import {
  buildListingEvent,
  LISTING_KIND,
  LISTING_TOPIC,
  parseListingEvent,
} from "./listing-event";
import { signNostrEvent, type Nip07Provider } from "./nip07";
import { isCategory } from "../marketplace";
import { isPubkey } from "./validation";
import {
  NostrError,
  type ListingInput,
  type RelayPublishResult,
  type NostrListing,
  type DiscoveryFilters,
  type DiscoveryResult,
} from "./types";

export async function publishListing(
  input: ListingInput,
  options: {
    provider?: Nip07Provider;
    expectedPubkey?: string;
    client?: NostrClient;
  } = {},
): Promise<RelayPublishResult> {
  const template = buildListingEvent(input);
  const event = await signNostrEvent(template, options);
  return (options.client ?? createNostrClient()).publish(event);
}

export function deduplicateListings(
  events: readonly unknown[],
): NostrListing[] {
  const byAddress = new Map<string, NostrListing>();
  for (const event of events) {
    const listing = parseListingEvent(event);
    if (!listing) continue;
    const current = byAddress.get(listing.address);
    if (
      !current ||
      listing.createdAt > current.createdAt ||
      (listing.createdAt === current.createdAt &&
        listing.eventId < current.eventId)
    ) {
      byAddress.set(listing.address, listing);
    }
  }
  return [...byAddress.values()].sort(
    (a, b) =>
      b.createdAt - a.createdAt ||
      (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0),
  );
}

export async function discoverListings(
  filters: DiscoveryFilters = {},
  client: NostrClient = createNostrClient(),
): Promise<DiscoveryResult> {
  const { authors, category, limit = 50 } = filters;
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 200 ||
    (category !== undefined &&
      (typeof category !== "string" || !isCategory(category))) ||
    (authors !== undefined &&
      (!Array.isArray(authors) ||
        !authors.length ||
        authors.length > 100 ||
        !authors.every(isPubkey)))
  ) {
    throw new NostrError("INVALID_INPUT", "Invalid discovery filters.");
  }
  // Fetch all categories so an older matching revision cannot replace a newer
  // revision that changed category. Apply category/limit only AFTER deduping.
  const { events, relays } = await client.query({
    kinds: [LISTING_KIND],
    "#t": [LISTING_TOPIC],
    ...(authors ? { authors: [...authors] } : {}),
  });
  const listings = deduplicateListings(events)
    .filter(
      (listing) =>
        (!category || listing.category === category) &&
        (!authors || authors.includes(listing.pubkey)),
    )
    .slice(0, limit);
  return { listings, relays };
}
