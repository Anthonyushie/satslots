import "server-only";

/**
 * Database row shapes and their API equivalents.
 *
 * Two pg driver behaviours are handled here rather than at every call site:
 *
 *   - `bigint` (price_sats) arrives as a string, because int8 does not fit in a JS
 *     number in general. Prices are small, so they are narrowed once, here.
 *   - `date` arrives as a JS Date at local midnight, which shifts across timezones.
 *     Queries therefore select `starts_on::text`, giving a plain YYYY-MM-DD string,
 *     and this module never constructs a Date from it.
 */

/** Column list for a listing read. Kept in one place so routes cannot drift apart. */
export const LISTING_COLUMNS = `
  id, pubkey, listing_id, address, event_id, title, description, category,
  price_sats, website_url, audience, ad_duration_days, max_ads, image_url,
  lightning_address, created_at, updated_at
`;

/**
 * A booking joined to its room and the room's owner, which is what both the
 * dashboard list and the receipt need.
 */
export const BOOKING_SELECT = `
  select b.id, b.listing_id, b.advertiser_pubkey, b.campaign_id, b.ad_id,
         b.status, b.starts_on::text as starts_on, b.ends_on::text as ends_on,
         b.image_url, b.website_url,
         b.created_at, b.updated_at,
         l.title       as room_title,
         l.category    as room_category,
         l.price_sats  as room_price_sats,
         l.ad_duration_days as room_ad_duration_days,
         l.pubkey      as room_pubkey,
         l.image_url   as room_image_url,
         p.username    as room_username
    from bookings b
    join listings l on l.id = b.listing_id
    join profiles p on p.pubkey = l.pubkey
`;

export interface ListingRow {
  id: string;
  pubkey: string;
  listing_id: string;
  address: string;
  event_id: string | null;
  title: string;
  description: string | null;
  category: string;
  price_sats: string;
  website_url: string | null;
  audience: string | null;
  ad_duration_days: number;
  max_ads: number;
  image_url: string | null;
  lightning_address: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Listing {
  id: string;
  pubkey: string;
  listingId: string;
  address: string;
  eventId: string | null;
  title: string;
  description: string | null;
  category: string;
  priceSats: number;
  websiteUrl: string | null;
  audience: string | null;
  adDurationDays: number;
  maxAds: number;
  imageUrl: string | null;
  lightningAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toListing(row: ListingRow): Listing {
  return {
    id: row.id,
    pubkey: row.pubkey,
    listingId: row.listing_id,
    address: row.address,
    eventId: row.event_id,
    title: row.title,
    description: row.description,
    category: row.category,
    priceSats: Number(row.price_sats),
    websiteUrl: row.website_url,
    audience: row.audience,
    adDurationDays: row.ad_duration_days,
    maxAds: row.max_ads,
    imageUrl: row.image_url,
    lightningAddress: row.lightning_address,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface BookingRow {
  id: string;
  listing_id: string;
  advertiser_pubkey: string;
  campaign_id: string | null;
  ad_id: string;
  status: string;
  starts_on: string;
  ends_on: string;
  image_url: string | null;
  website_url: string | null;
  created_at: Date;
  updated_at: Date;
  room_title: string;
  room_category: string;
  room_price_sats: string;
  room_ad_duration_days: number;
  room_pubkey: string;
  room_image_url: string | null;
  room_username: string;
}

export interface Booking {
  id: string;
  adId: string;
  status: string;
  advertiserPubkey: string;
  listingId: string;
  startsOn: string;
  endsOn: string;
  imageUrl: string | null;
  websiteUrl: string | null;
  createdAt: string;
  updatedAt: string;
  room: {
    id: string;
    title: string;
    category: string;
    publisherPubkey: string;
    publisherUsername: string;
    priceSats: number;
    adDurationDays: number;
    imageUrl: string | null;
  };
}

/** Inclusive day count: a 1st-to-7th booking is 7 days, not 6. */
export function daysBetween(startsOn: string, endsOn: string): number {
  const start = Date.parse(`${startsOn}T00:00:00Z`);
  const end = Date.parse(`${endsOn}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

/**
 * The receipt shown to the booker: what was booked, for how long, and what it
 * costs. The total is derived here from the room's stored price, never from
 * anything the browser sent.
 */
export interface BookingReceipt {
  reference: string;
  days: number;
  dailyPriceSats: number;
  totalSats: number;
}

export function toReceipt(booking: Booking): BookingReceipt {
  const days = daysBetween(booking.startsOn, booking.endsOn);
  return {
    reference: booking.id,
    days,
    dailyPriceSats: booking.room.priceSats,
    totalSats: days * booking.room.priceSats,
  };
}

export function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    adId: row.ad_id,
    status: row.status,
    advertiserPubkey: row.advertiser_pubkey,
    listingId: row.listing_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    imageUrl: row.image_url,
    websiteUrl: row.website_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    room: {
      id: row.listing_id,
      title: row.room_title,
      category: row.room_category,
      publisherPubkey: row.room_pubkey,
      publisherUsername: row.room_username,
      priceSats: Number(row.room_price_sats),
      adDurationDays: row.room_ad_duration_days,
      imageUrl: row.room_image_url,
    },
  };
}

/**
 * A thread comment joined to its author's display name.
 *
 * The join is inner on profiles because author_pubkey is a NOT NULL foreign key to
 * it, so a comment cannot outlive its author.
 */
export const COMMENT_SELECT = `
  select c.id, c.listing_id, c.author_pubkey, c.body, c.created_at,
         p.username as author_username
    from listing_comments c
    join profiles p on p.pubkey = c.author_pubkey
`;

export interface CommentRow {
  id: string;
  listing_id: string;
  author_pubkey: string;
  body: string;
  created_at: Date;
  author_username: string;
}

export interface Comment {
  id: string;
  listingId: string;
  authorPubkey: string;
  authorUsername: string;
  body: string;
  createdAt: string;
}

export function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    listingId: row.listing_id,
    authorPubkey: row.author_pubkey,
    authorUsername: row.author_username,
    body: row.body,
    createdAt: row.created_at.toISOString(),
  };
}
