"use client";

import { createContext, useContext, type RefObject } from "react";
import type { MarketplaceFilter, MarketplaceListing } from "@/lib/marketplace";
import type { SessionUser } from "@/lib/auth/client";
import type { useNostrIdentity } from "./use-nostr-identity";
import type { useNostrMarketplace } from "./use-nostr-marketplace";

export type ModalSelection =
  | { kind: "publisher" }
  | { kind: "about" }
  | { kind: "campaigns" }
  | { kind: "auth"; authMode: "signup" | "login"; authSubMode?: "nostr" | "email" };
export interface ExperienceContextValue {
  isAuthenticated: boolean;
  user: SessionUser | null;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  listings: readonly MarketplaceListing[];
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
