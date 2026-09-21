import "server-only";
import { z } from "zod";
import { categories } from "@/lib/marketplace";
import { isSafeHttpUrl, isText } from "@/lib/nostr/validation";

/**
 * Request validation.
 *
 * Every rule here mirrors a check constraint in db/migrations. That duplication is
 * deliberate: without it a bad request reaches Postgres and fails as a constraint
 * violation, which surfaces to the caller as a 500 instead of a 400 that says what
 * was wrong. When a constraint changes, change the matching rule here.
 */

/** Reuses the project's own text validator, which also rejects control characters. */
const text = (min: number, max: number, label: string) =>
  z.string().refine((value) => isText(value, min, max), {
    message: `${label} must be ${min}-${max} characters of plain text.`,
  });

/** Matches isListingId in src/lib/nostr/listing-event.ts, so a room maps to a Nostr `d` tag. */
const listingId = z
  .string()
  .regex(
    /^[A-Za-z0-9_-]{1,128}$/,
    "Must be 1-128 letters, numbers, underscores or hyphens.",
  );

const websiteUrl = z
  .string()
  .refine(isSafeHttpUrl, { message: "Must be a full HTTP or HTTPS address." });

const lightningAddress = z
  .string()
  .regex(/^[^@]+@[^@]+\.[^@]+$/, "Must be a valid lightning address (user@domain.com).")
  .optional()
  .nullable();

/**
 * Base validators carry no defaults on purpose. `.default()` belongs only on the
 * create schema: a defaulted field inside an update schema would be injected into
 * every patch and silently overwrite a value the caller never mentioned.
 *
 * Ranges match listings_ad_duration_days_check and listings_max_ads_check.
 */
const adDurationDays = z.number().int().min(1).max(365);
const maxAds = z.number().int().min(1).max(50);

/**
 * price_sats is bigint. Capped at the JS safe-integer ceiling because the value is
 * handled as a number in application code.
 *
 * The minimum is 1, not 0, even though the column allows 0. A listing event
 * rejects a non-positive price (listingContent in src/lib/nostr/listing-event.ts),
 * so a free room could be created here and then never be published to a relay —
 * permanently invisible in a marketplace that reads only relays. Refusing it at
 * the boundary keeps every stored room publishable.
 */
const priceSats = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

/** The three nullable columns can be cleared by sending an explicit null. */
const optionalDescription = text(1, 4000, "Description").nullable();
const optionalAudience = text(1, 500, "Audience").nullable();
const optionalWebsiteUrl = websiteUrl.nullable();

export const listingCreateSchema = z.object({
  // Optional: the server generates one when the caller does not supply it. Supplying
  // it is what makes a retried create idempotent, via unique (pubkey, listing_id).
  listingId: listingId.optional(),
  title: text(1, 200, "Publication name"),
  description: text(1, 4000, "Description").optional(),
  category: z.enum(categories),
  priceSats,
  websiteUrl: websiteUrl.optional(),
  audience: text(1, 500, "Audience").optional(),
  // Omitting these applies the database default (7 days, 1 ad).
  adDurationDays: adDurationDays.default(7),
  maxAds: maxAds.default(1),
  imageUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  lightningAddress: lightningAddress,
});

export const listingUpdateSchema = z
  .object({
    title: text(1, 200, "Publication name").optional(),
    description: optionalDescription.optional(),
    category: z.enum(categories).optional(),
    priceSats: priceSats.optional(),
    websiteUrl: optionalWebsiteUrl.optional(),
    audience: optionalAudience.optional(),
    adDurationDays: adDurationDays.optional(),
    maxAds: maxAds.optional(),
    imageUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

/** Matches the bookings_ad_id_check constraint. Doubles as the idempotency key. */
const adId = text(1, 128, "Ad id");

/** Real calendar date, not just the right shape — rejects 2026-02-31. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date in YYYY-MM-DD form.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Must be a real calendar date.");

export const bookingCreateSchema = z.object({
  adId,
  listingId: z.uuid("Must be a room id."),
  // Only the start is supplied; the end is derived from the room's ad length.
  startsOn: isoDate,
});

export const BOOKING_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "completed",
] as const;

export const bookingUpdateSchema = z.object({
  status: z.enum(BOOKING_STATUSES),
});

/**
 * The id a relay assigned to a published listing event.
 *
 * Recorded by the owner after the browser has signed and published the event, so
 * its shape is checked here but its authenticity is not: the route cannot verify
 * that a relay accepted it. A forged value can therefore only mislabel the owner's
 * own room, which is why this does not warrant a relay round-trip.
 */
export const listingEventSchema = z.object({
  eventId: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "Must be a 64-character lowercase hex event id."),
});

/** Matches the listing_comments_body_check constraint. */
export const commentCreateSchema = z.object({
  body: text(1, 2000, "Comment"),
});

export type ListingCreateInput = z.infer<typeof listingCreateSchema>;
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;
export type ListingEventInput = z.infer<typeof listingEventSchema>;
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>;

/** Payment creation: linked to a booking. */
export const paymentCreateSchema = z.object({
  bookingId: z.uuid("Must be a booking id."),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

/** Anonymous booking: no auth required, identified by email/payment. */
export const anonymousBookingSchema = z.object({
  listingId: z.uuid("Must be a room id."),
  startsOn: isoDate,
  contactEmail: z.string().email("Must be a valid email."),
  adName: text(1, 128, "Ad name").optional(),
  imageUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  websiteUrl: z.string().url("Must be a valid URL.").optional().nullable(),
});

export type AnonymousBookingInput = z.infer<typeof anonymousBookingSchema>;
