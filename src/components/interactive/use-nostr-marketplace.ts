"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { discoverListings, type NostrListing, type RelayResult } from "@/lib/nostr";
import {
  isCategory,
  mergeListings,
  type MarketplaceListing,
} from "@/lib/marketplace";

/** Matches MAX_LIMIT in src/app/api/listings/route.ts. */
const INDEX_LIMIT = 100;

interface MarketplaceState {
  status: "loading" | "ready" | "error";
  listings: readonly MarketplaceListing[];
  relays: readonly RelayResult[];
  /**
   * True when `GET /api/listings` failed. Worth surfacing on its own: the index is
   * where a publisher's own saved rooms live, so losing it is not the same as a
   * relay being down, and silently showing a thinner grid would look like the rooms
   * had been deleted.
   */
  indexUnavailable: boolean;
}

function seconds(value: unknown): number {
  const ms = Date.parse(typeof value === "string" ? value : "");
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function fromRelay(listing: NostrListing): MarketplaceListing {
  return {
    address: listing.address,
    name: listing.name,
    category: listing.category,
    description: listing.description,
    priceSats: listing.priceSats,
    pubkey: listing.pubkey,
    source: "relay",
    createdAt: listing.createdAt,
    eventId: listing.eventId,
    imageUrl: null,
  };
}

/**
 * Reads every room from our own index.
 *
 * The response is validated rather than trusted: a room that cannot be linked or
 * filtered would render as a broken card, so it is dropped instead.
 */
async function fetchIndexedRooms(): Promise<MarketplaceListing[]> {
  const response = await fetch(`/api/listings?limit=${INDEX_LIMIT}`);
  if (!response.ok) {
    throw new Error(`The room index returned ${response.status}.`);
  }
  const body = (await response.json()) as { listings?: unknown };
  if (!Array.isArray(body.listings)) {
    throw new Error("The room index did not return a list.");
  }

  return body.listings.flatMap((raw): MarketplaceListing[] => {
    if (typeof raw !== "object" || raw === null) return [];
    const room = raw as Record<string, unknown>;
    const { address, title, category, pubkey } = room;
    if (
      typeof address !== "string" ||
      typeof title !== "string" ||
      typeof pubkey !== "string" ||
      typeof category !== "string" ||
      !isCategory(category)
    ) {
      return [];
    }
    return [
      {
        address,
        name: title,
        category,
        description:
          typeof room.description === "string" ? room.description : "",
        priceSats: typeof room.priceSats === "number" ? room.priceSats : 0,
        pubkey,
        source: "index",
        createdAt: seconds(room.createdAt),
        eventId: typeof room.eventId === "string" ? room.eventId : null,
        imageUrl: typeof room.imageUrl === "string" ? room.imageUrl : null,
      },
    ];
  });
}

export function useNostrMarketplace() {
  const [state, setState] = useState<MarketplaceState>({
    status: "loading",
    listings: [],
    relays: [],
    indexUnavailable: false,
  });
  const operation = useRef(0);

  const loadListings = useCallback(async () => {
    const request = ++operation.current;
    // Both sources load together, and neither is allowed to fail the other. A room
    // saved but not yet published exists only in the index; a room from another
    // client exists only on the relays. Requiring both would hide exactly the rooms
    // this grid is meant to show.
    const [index, relays] = await Promise.allSettled([
      fetchIndexedRooms(),
      discoverListings(),
    ]);
    if (request !== operation.current) return;

    const indexRooms = index.status === "fulfilled" ? index.value : [];
    const relayResults = relays.status === "fulfilled" ? relays.value.relays : [];
    const relayRooms =
      relays.status === "fulfilled"
        ? relays.value.listings.map(fromRelay)
        : [];

    // A relay that is down is reported per-relay (`ok: false`) rather than thrown,
    // so `discoverListings` still fulfils when every relay fails. A rejection is
    // therefore not the only way the relay side can have come back useless, and
    // checking for one alone would let a total outage render as an empty grid.
    const indexUsable = index.status === "fulfilled";
    const relaysUsable = relayResults.some((relay) => relay.ok);

    // Nothing from either source and at least one of them broken. Saying "no rooms"
    // here would be a claim we cannot support.
    if (!indexUsable && !relaysUsable) {
      setState((current) => ({ ...current, status: "error" }));
      return;
    }

    setState({
      status: "ready",
      listings: mergeListings(indexRooms, relayRooms),
      relays: relayResults,
      indexUnavailable: !indexUsable,
    });
  }, []);

  useEffect(() => {
    // Cancel before starting I/O when React replays the mount in StrictMode.
    const timer = window.setTimeout(() => void loadListings(), 0);
    return () => {
      window.clearTimeout(timer);
      operation.current += 1;
    };
  }, [loadListings]);

  const refresh = useCallback(() => {
    setState((current) => ({ ...current, status: "loading" }));
    return loadListings();
  }, [loadListings]);

  return { ...state, refresh };
}
