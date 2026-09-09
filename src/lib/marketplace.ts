export const categories = ["Bitcoin", "Design", "Development"] as const;
export type Category = (typeof categories)[number];
export type MarketplaceFilter = "all" | Category;
export type SampleListingId = "fieldnotes" | "offscript" | "quietbuild";

interface ListingDetails {
  readonly name: string;
  readonly category: Category;
  readonly description: string;
  readonly price: number;
  readonly audience?: string;
}
export interface SampleListing extends ListingDetails {
  readonly id: SampleListingId;
  readonly local: false;
}
export interface LocalListing extends ListingDetails {
  readonly id: `local-${number}`;
  readonly local: true;
  readonly websiteUrl: string;
}
export type Listing = SampleListing | LocalListing;
export type LocalListingInput = Omit<LocalListing, "id" | "local">;

export const sampleListings: readonly SampleListing[] = Object.freeze([
  Object.freeze({
    id: "fieldnotes",
    local: false,
    name: "Bitcoin Fieldnotes",
    category: "Bitcoin",
    description:
      "Thoughtful essays for people building a more independent world.",
    price: 5000,
    audience: "Bitcoin builders, curious readers, and independent thinkers.",
  } as const),
  Object.freeze({
    id: "offscript",
    local: false,
    name: "Offscript",
    category: "Design",
    description:
      "A home for good taste, small studios, and doing things your own way.",
    price: 3000,
    audience: "Independent designers, small studios, and creative founders.",
  } as const),
  Object.freeze({
    id: "quietbuild",
    local: false,
    name: "Quiet Build",
    category: "Development",
    description: "Notes from the workbench. For the people who actually ship.",
    price: 4000,
    audience:
      "Open-source contributors, solo developers, and hands-on builders.",
  } as const),
]);

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
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
