"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from "react";
import {
  sampleListings,
  type Listing,
  type LocalListing,
  type LocalListingInput,
  type MarketplaceFilter,
} from "@/lib/marketplace";
import {
  ExperienceContext,
  useExperience,
  type ModalSelection,
} from "@/components/interactive/experience-context";
import { DialogLayer } from "@/components/interactive/dialogs";

export { useExperience } from "@/components/interactive/experience-context";

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [samples] = useState(sampleListings);
  const [localListings, setLocalListings] = useState<readonly LocalListing[]>(
    [],
  );
  const [filter, setFilter] = useState<MarketplaceFilter>("all");
  const [modal, setModal] = useState<ModalSelection | null>(null);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const nextId = useRef(0);
  const previousFocus = useRef<HTMLElement | null>(null);
  const marketplaceRef = useRef<HTMLElement | null>(null);
  const listings = useMemo<readonly Listing[]>(
    () => [...localListings, ...samples],
    [localListings, samples],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openModal = useCallback(
    (selection: ModalSelection, trigger?: HTMLElement) => {
      previousFocus.current =
        trigger ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
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
  const addListing = useCallback((input: LocalListingInput) => {
    // Allocate outside the updater: StrictMode may invoke state updaters twice.
    const listing: LocalListing = {
      ...input,
      id: `local-${++nextId.current}`,
      local: true,
    };
    setLocalListings((current) => [listing, ...current]);
    setFilter("all");
    setModal(null);
    setToast({
      message:
        "Your preview is ready. It stays here until you reload—nothing is published.",
    });
    marketplaceRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }, []);
  const removeListing = useCallback((id: string) => {
    setLocalListings((current) =>
      current.filter((listing) => listing.id !== id),
    );
    setModal(null);
    setToast({ message: "Local preview removed. Nothing was published." });
  }, []);
  const value = useMemo(
    () => ({
      listings,
      filter,
      setFilter,
      modal,
      openModal,
      closeModal,
      restoreFocus,
      addListing,
      removeListing,
      marketplaceRef,
    }),
    [
      listings,
      filter,
      modal,
      openModal,
      closeModal,
      restoreFocus,
      addListing,
      removeListing,
    ],
  );

  return (
    <ExperienceContext.Provider value={value}>
      {children}
      <DialogLayer />
      <div
        id="toast"
        className="toast"
        role="status"
        aria-live="polite"
        hidden={!toast}
      >
        {toast?.message}
      </div>
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
