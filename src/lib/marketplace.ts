export const categories = ["Bitcoin", "Design", "Development"] as const;
export type Category = (typeof categories)[number];
export type MarketplaceFilter = "all" | Category;
export type Role = "advertiser" | "publisher";
export const roleSteps = {
  advertiser: [
    [
      "Find your kind of people.",
      "Browse independent sites by topic. Choose a placement that makes sense for your brand—not someone’s tracking profile.",
    ],
    [
      "Make it a good fit.",
      "Send your creative. Agree on the dates and price. The publisher approves what appears in their space.",
    ],
    [
      "Pay the person. Get seen.",
      "The planned Lightning checkout pays the publisher directly. Your approved banner runs for the agreed period.",
    ],
  ],
  publisher: [
    [
      "Make room for a good fit.",
      "List a banner on a website you control. Set your topic, daily price, and the kinds of sponsors you welcome.",
    ],
    [
      "Your site. Your final say.",
      "Review the advertiser’s creative and requested dates. Only approve sponsorships you’re comfortable putting your name beside.",
    ],
    [
      "Keep the connection direct.",
      "The planned integration receives payment in your Lightning wallet, then displays the approved banner for the booked period.",
    ],
  ],
} as const satisfies Record<Role, readonly (readonly [string, string])[]>;

const satsFormatter = new Intl.NumberFormat("en-US");
export function formatSats(value: number): string {
  return satsFormatter.format(value);
}
export function isCategory(value: string): value is Category {
  return categories.some((category) => category === value);
}

/**
 * A room as the marketplace grid shows it.
 *
 * The grid is fed by two sources that do not share a shape: our own index in
 * Postgres, and listing events discovered on relays — which include rooms other
 * clients published that we have never indexed. Both are mapped into this one
 * shape so a card renders identically either way.
 */
export interface MarketplaceListing {
  readonly address: string;
  readonly name: string;
  readonly category: Category;
  readonly description: string;
  readonly priceSats: number;
  readonly pubkey: string;
  /** Which source this room came from. */
  readonly source: "index" | "relay";
  /**
   * Seconds since epoch. For an indexed room this is when the row was created; for
   * a relay room it is the listing event's own timestamp.
   */
  readonly createdAt: number;
  /**
   * Null for a room that was saved but never accepted by a relay. That is a real
   * state, not an error: saving and publishing are separate steps and the publish
   * can fail on its own.
   */
  readonly eventId: string | null;
  /** Room banner image URL, if set by the publisher. */
  readonly imageUrl: string | null;
}

/**
 * Combines the two sources into one grid, keyed by Nostr address.
 *
 * Where both know a room, the index wins. That is deliberate rather than
 * arbitrary: a card links to `/listings/<address>`, which resolves against the
 * index, so preferring relay metadata would let a card and the page it opens
 * disagree about the same room.
 */
export function mergeListings(
  indexed: readonly MarketplaceListing[],
  fromRelays: readonly MarketplaceListing[],
): MarketplaceListing[] {
  const byAddress = new Map(indexed.map((listing) => [listing.address, listing]));
  for (const listing of fromRelays) {
    if (!byAddress.has(listing.address)) byAddress.set(listing.address, listing);
  }
  return [...byAddress.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
