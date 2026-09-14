"use client";

import { createContext, useContext, type RefObject } from "react";
import type { MarketplaceFilter } from "@/lib/marketplace";
import type { NostrListing } from "@/lib/nostr";
import type { useNostrIdentity } from "./use-nostr-identity";
import type { useNostrMarketplace } from "./use-nostr-marketplace";

export type ModalSelection =
  | { kind: "publisher" }
  | { kind: "about" }
  | { kind: "campaigns" }
  | { kind: "placement"; listingAddress: string };
export interface ExperienceContextValue {
  listings: readonly NostrListing[];
  identity: ReturnType<typeof useNostrIdentity>;
  marketplace: ReturnType<typeof useNostrMarketplace>;
  filter: MarketplaceFilter;
  setFilter: (filter: MarketplaceFilter) => void;
  modal: ModalSelection | null;
  openModal: (selection: ModalSelection, trigger?: HTMLElement) => void;
  closeModal: () => void;
  restoreFocus: () => void;
  marketplaceRef: RefObject<HTMLElement | null>;
}
export const ExperienceContext = createContext<ExperienceContextValue | null>(
  null,
);
export function useExperience(): ExperienceContextValue {
  const context = useContext(ExperienceContext);
  if (!context)
    throw new Error(
      "SatSlots interactive components require an ExperienceProvider.",
    );
  return context;
}

export function Icon({
  name,
  small = false,
}: {
  name: "arrow-up" | "arrow-right" | "asterisk" | "close" | "check" | "bolt";
  small?: boolean;
}) {
  return (
    <svg className={small ? "icon icon-small" : "icon"} aria-hidden="true">
      <use href={`#${name}`} />
    </svg>
  );
}
