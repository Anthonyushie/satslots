// In-memory UI input only. These are not backend requests or persisted records.
export interface ListingFormValues {
  name: string;
  websiteUrl: string;
  category: string;
  dailyPriceSats: string;
  /**
   * What the placement is. Distinct from `audience`, and required: a listing event
   * carries a non-empty description (see listingContent in src/lib/nostr/
   * listing-event.ts), so a room without one cannot be published to a relay.
   */
  description: string;
  /** Who the placement is for. Optional in the event, but the form requires it. */
  audience: string;
  adDurationDays: number;
  maxAds: number;
  /** Optional banner image URL for the room. */
  imageUrl?: string;
}

export interface CampaignFormValues {
  name: string;
  headline: string;
  destinationUrl: string;
  description: string;
}
