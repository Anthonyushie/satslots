"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { discoverListings, type DiscoveryResult } from "@/lib/nostr";

type MarketplaceState = DiscoveryResult & {
  status: "loading" | "ready" | "error";
};

export function useNostrMarketplace() {
  const [state, setState] = useState<MarketplaceState>({
    status: "loading",
    listings: [],
    relays: [],
  });
  const operation = useRef(0);

  const loadListings = useCallback(async () => {
    const request = ++operation.current;
    try {
      const result = await discoverListings();
      if (request === operation.current)
        setState({ ...result, status: "ready" });
    } catch {
      if (request === operation.current) {
        setState((current) => ({ ...current, status: "error" }));
      }
    }
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
