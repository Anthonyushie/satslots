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
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
