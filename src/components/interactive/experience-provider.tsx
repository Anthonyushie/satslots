"use client";

import {
  useCallback,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from "react";
import { type MarketplaceFilter } from "@/lib/marketplace";
import { useNostrIdentity } from "./use-nostr-identity";
import { useNostrMarketplace } from "./use-nostr-marketplace";
import {
  ExperienceContext,
  useExperience,
  type ModalSelection,
} from "@/components/interactive/experience-context";
import { DialogLayer } from "@/components/interactive/dialogs";

export { useExperience } from "@/components/interactive/experience-context";

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const identity = useNostrIdentity();
  const marketplace = useNostrMarketplace();
  const [filter, setFilter] = useState<MarketplaceFilter>("all");
  const [modal, setModal] = useState<ModalSelection | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const marketplaceRef = useRef<HTMLElement | null>(null);
  const openModal = useCallback(
    (selection: ModalSelection, trigger?: HTMLElement) => {
      const target =
        trigger ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      // Switching planning dialogs should return to the original page trigger.
      if (!target?.closest("dialog")) previousFocus.current = target;
      setModal(selection);
    },
    [],
  );
  const closeModal = useCallback(() => setModal(null), []);
  const restoreFocus = useCallback(() => {
    const target = previousFocus.current;
    if (target?.isConnected && !target.closest("[hidden]"))
      target.focus({ preventScroll: true });
    else marketplaceRef.current?.focus({ preventScroll: true });
  }, []);
  const value = {
    identity,
    marketplace,
    listings: marketplace.listings,
    filter,
    setFilter,
    modal,
    openModal,
    closeModal,
    restoreFocus,
    marketplaceRef,
  };

  return (
    <ExperienceContext.Provider value={value}>
      {children}
      <DialogLayer />
    </ExperienceContext.Provider>
  );
}

export function ListSpaceButton({
  children,
  className,
  onClick,
  type = "button",
  ...props
}: ComponentPropsWithRef<"button">) {
  const { openModal } = useExperience();
  return (
    <button
      {...props}
      type={type}
      className={className}
      data-list-space=""
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented)
          openModal({ kind: "publisher" }, event.currentTarget);
      }}
    >
      {children}
    </button>
  );
}

export function ProjectNotesButton({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const { openModal } = useExperience();
  return (
    <button
      type="button"
      id="about-button"
      className={className}
      onClick={(event) => openModal({ kind: "about" }, event.currentTarget)}
    >
      {children}
    </button>
  );
}
