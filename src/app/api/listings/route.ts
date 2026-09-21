import { randomBytes } from "node:crypto";
import {
  ok,
  readJson,
  requireUser,
  route,
} from "@/lib/api/handler";
import { listingCreateSchema } from "@/lib/api/schemas";
import { isSameOrigin, jsonError } from "@/lib/auth/http";
import { isCategory } from "@/lib/marketplace";
import { isPubkey } from "@/lib/nostr/validation";
import { getMongo } from "@/lib/mongodb/client";
import { 
  getListings, 
  getListingsByPubkey,
  getListingById 
} from "@/lib/mongodb/queries";
import { Listing } from "@/lib/mongodb/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET /api/listings — public room listing.
 *
 * No session required: browsing the marketplace is anonymous.
 */
export async function GET(request: Request): Promise<Response> {
  return route(async () => {
    await getMongo();
    
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const pubkey = url.searchParams.get("pubkey");

    if (category !== null && !isCategory(category)) {
      return jsonError("Unknown category.", 400);
    }
    if (pubkey !== null && !isPubkey(pubkey)) {
      return jsonError("pubkey must be 64 lowercase hex characters.", 400);
    }

    const requested = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
    const limit =
      Number.isInteger(requested) && requested > 0
        ? Math.min(requested, MAX_LIMIT)
        : DEFAULT_LIMIT;

    let listings;
    if (pubkey) {
      listings = await getListingsByPubkey(pubkey);
    } else {
      listings = await getListings(limit, 0);
    }

    // Filter by category if specified
    if (category) {
      listings = listings.filter(listing => listing.category === category);
    }

    // Apply limit
    listings = listings.slice(0, limit);

    return ok({ 
      listings: listings.map(listing => ({
        id: listing.id,
        pubkey: listing.pubkey,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        audience: listing.audience,
        priceSats: listing.price_sats,
        adDurationDays: listing.ad_duration_days,
        maxAds: listing.max_ads,
        address: listing.address,
        imageUrl: listing.image_url,
        websiteUrl: listing.website_url,
        lightningAddress: listing.lightning_address,
        published: listing.published,
        createdAt: listing.created_at,
        updatedAt: listing.updated_at
      }))
    });
  });
}

/**
 * POST /api/listings — create a room owned by the caller.
 *
 * The owner comes from the session, never from the body.
 */
export async function POST(request: Request): Promise<Response> {
  return route(async () => {
    if (!isSameOrigin(request)) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    const auth = await requireUser();
    if (!auth.user) return auth.response;

    const body = await readJson(request, listingCreateSchema);
    if (!body.data) return body.response;
    const input = body.data;

    await getMongo();

    // A caller-supplied id makes a retried create idempotent through
    // unique (pubkey, listing_id); otherwise one is minted here.
    const listingId = input.listingId ?? randomBytes(9).toString("base64url");
    
    // Generate address from listing details
    const address = `30078:${auth.user.pubkey}:satslots:${listingId}`;

    try {
      // Check if listing already exists (idempotent)
      const existing = await getListingById(listingId);
      if (existing && existing.pubkey === auth.user.pubkey) {
        return ok({ 
          listing: {
            id: existing.id,
            pubkey: existing.pubkey,
            title: existing.title,
            description: existing.description,
            category: existing.category,
            audience: existing.audience,
            priceSats: existing.price_sats,
            adDurationDays: existing.ad_duration_days,
            maxAds: existing.max_ads,
            address: existing.address,
            imageUrl: existing.image_url,
            websiteUrl: existing.website_url,
            lightningAddress: existing.lightning_address,
            published: existing.published,
            createdAt: existing.created_at,
            updatedAt: existing.updated_at
          }
        });
      }

      // Create new listing
      const listing = new Listing({
        id: listingId,
        pubkey: auth.user.pubkey,
        title: input.title,
        description: input.description ?? "",
        category: input.category,
        audience: input.audience ?? "",
        price_sats: input.priceSats,
        ad_duration_days: input.adDurationDays,
        max_ads: input.maxAds,
        address: address,
        image_url: input.imageUrl ?? null,
        website_url: input.websiteUrl ?? null,
        lightning_address: input.lightningAddress ?? null,
        published: false,
      });

      await listing.save();

      return ok({ 
        listing: {
          id: listing.id,
          pubkey: listing.pubkey,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          audience: listing.audience,
          priceSats: listing.price_sats,
          adDurationDays: listing.ad_duration_days,
          maxAds: listing.max_ads,
          address: listing.address,
          imageUrl: listing.image_url,
          websiteUrl: listing.website_url,
          lightningAddress: listing.lightning_address,
          published: listing.published,
          createdAt: listing.created_at,
          updatedAt: listing.updated_at
        }
      }, 201);
    } catch (error: any) {
      if (error.code === 11000) {
        // Duplicate key error
        if (input.listingId) {
          const existing = await getListingById(listingId);
          if (existing && existing.pubkey === auth.user.pubkey) {
            return ok({ 
              listing: {
                id: existing.id,
                pubkey: existing.pubkey,
                title: existing.title,
                description: existing.description,
                category: existing.category,
                audience: existing.audience,
                priceSats: existing.price_sats,
                adDurationDays: existing.ad_duration_days,
                maxAds: existing.max_ads,
                address: existing.address,
                imageUrl: existing.image_url,
                websiteUrl: existing.website_url,
                lightningAddress: existing.lightning_address,
                published: existing.published,
                createdAt: existing.created_at,
                updatedAt: existing.updated_at
              }
            });
          }
        }
        return jsonError("You already have a room with that id.", 409);
      }
      throw error;
    }
  });
}
