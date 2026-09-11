import type { Event, EventTemplate } from "nostr-tools/pure";
import { isCategory } from "../marketplace";
import {
  NostrError,
  type ListingEventContent,
  type ListingInput,
  type NostrListing,
} from "./types";
import {
  contentFits,
  isRecord,
  isSafeHttpUrl,
  isText,
  verifiedEvent,
  MAX_FUTURE_SECONDS,
} from "./validation";

export const LISTING_KIND = 30078;
export const LISTING_NAMESPACE = "satslots:";
export const LISTING_TOPIC = "satslots-listing";

const contentKeys = new Set([
  "schemaVersion",
  "name",
  "category",
  "description",
  "priceSats",
  "websiteUrl",
  "audience",
]);

function listingContent(value: unknown): ListingEventContent | null {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !contentKeys.has(key))
  )
    return null;
  const {
    schemaVersion,
    name,
    category,
    description,
    priceSats,
    websiteUrl,
    audience,
  } = value;
  if (
    schemaVersion !== 1 ||
    !isText(name, 1, 120) ||
    typeof category !== "string" ||
    !isCategory(category) ||
    !isText(description, 1, 4000) ||
    typeof priceSats !== "number" ||
    !Number.isSafeInteger(priceSats) ||
    priceSats <= 0 ||
    !isSafeHttpUrl(websiteUrl) ||
    (audience !== undefined && !isText(audience, 1, 500))
  )
    return null;
  return {
    schemaVersion,
    name,
    category,
    description,
    priceSats,
    websiteUrl,
    ...(audience !== undefined ? { audience } : {}),
  };
}

export function isListingId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function buildListingEvent(
  input: ListingInput,
  createdAt = Math.floor(Date.now() / 1000),
): EventTemplate {
  if (!isRecord(input) || !isListingId(input.listingId)) {
    throw new NostrError(
      "INVALID_INPUT",
      "A stable listingId of 1–128 letters, numbers, underscores or hyphens is required.",
    );
  }
  const { listingId, ...fields } = input;
  // Do not allow a caller to override the version or smuggle extra fields.
  if (Object.hasOwn(fields, "schemaVersion"))
    throw new NostrError(
      "INVALID_INPUT",
      "schemaVersion is managed by the service.",
    );
  const content = listingContent({ ...fields, schemaVersion: 1 });
  if (
    !content ||
    !Number.isSafeInteger(createdAt) ||
    createdAt < 0 ||
    createdAt > Math.floor(Date.now() / 1000) + MAX_FUTURE_SECONDS
  ) {
    throw new NostrError(
      "INVALID_INPUT",
      "Invalid listing fields or creation timestamp.",
    );
  }
  const json = JSON.stringify(content);
  if (!contentFits(json))
    throw new NostrError("INVALID_INPUT", "Listing content exceeds 16 KiB.");
  return {
    kind: LISTING_KIND,
    created_at: createdAt,
    tags: [
      ["d", LISTING_NAMESPACE + listingId],
      ["t", "satslots"],
      ["t", LISTING_TOPIC],
      ["t", content.category],
      ["client", "satslots"],
    ],
    content: json,
  };
}

/** Returns only allowlisted, typed fields, never arbitrary relay JSON. */
export function parseListingEvent(raw: unknown): NostrListing | null {
  const event = verifiedEvent(raw);
  return event ? parseVerifiedListing(event) : null;
}

function parseVerifiedListing(event: Event): NostrListing | null {
  if (event.kind !== LISTING_KIND) return null;
  const identifiers = event.tags.filter(([key]) => key === "d");
  const clients = event.tags.filter(([key]) => key === "client");
  if (
    identifiers.length !== 1 ||
    identifiers[0].length !== 2 ||
    clients.length !== 1 ||
    clients[0].length !== 2 ||
    clients[0][1] !== "satslots"
  )
    return null;
  const d = identifiers[0][1];
  if (!d.startsWith(LISTING_NAMESPACE)) return null;
  const listingId = d.slice(LISTING_NAMESPACE.length);
  if (!isListingId(listingId)) return null;
  const topics = event.tags.filter(([key]) => key === "t");
  if (
    !topics.some((tag) => tag.length === 2 && tag[1] === "satslots") ||
    !topics.some((tag) => tag.length === 2 && tag[1] === LISTING_TOPIC)
  )
    return null;
  try {
    const content = listingContent(JSON.parse(event.content));
    if (
      !content ||
      !topics.some((tag) => tag.length === 2 && tag[1] === content.category) ||
      topics.some((tag) => isCategory(tag[1]) && tag[1] !== content.category)
    )
      return null;
    return {
      ...content,
      listingId,
      address: `${LISTING_KIND}:${event.pubkey}:${d}`,
      eventId: event.id,
      pubkey: event.pubkey,
      createdAt: event.created_at,
    };
  } catch {
    return null;
  }
}
