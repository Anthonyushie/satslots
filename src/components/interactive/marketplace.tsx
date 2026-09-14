"use client";
import { categories, formatSats } from "@/lib/marketplace";
import type { NostrListing } from "@/lib/nostr";
import { Icon, useExperience } from "./experience-context";
import { ListSpaceButton } from "./experience-provider";

function ListingCard({ listing }: { listing: NostrListing }) {
  const { filter, openModal } = useExperience();
  return (
    <article
      className="listing-card"
      data-category={listing.category}
      data-listing-id={listing.address}
      hidden={filter !== "all" && filter !== listing.category}
    >
      <div className="listing-art custom-listing-art">
        <div className="mini-masthead flex justify-between">
          <span>NOSTR MARKETPLACE</span>
          <span>UNVERIFIED LISTING</span>
        </div>
        <div className="mini-editorial">{listing.name}</div>
        <span className="placement-type">WEBSITE BANNER</span>
      </div>
      <div className="listing-body">
        <div className="listing-category mono">{listing.category}</div>
        <h3>
          {listing.name} <Icon name="asterisk" small />
        </h3>
        <p>{listing.description}</p>
        <div className="listing-footer flex items-end justify-between gap-3">
          <div className="listing-price">
            {formatSats(listing.priceSats)} <span>sats / day</span>
          </div>
          <button
            type="button"
            className="placement-button"
            data-placement={listing.address}
            aria-label={`View ${listing.name} placement`}
            onClick={(event) =>
              openModal(
                { kind: "placement", listingAddress: listing.address },
                event.currentTarget,
              )
            }
          >
            <Icon name="arrow-up" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function Marketplace() {
  const { listings, filter, setFilter, marketplaceRef, marketplace } =
    useExperience();
  return (
    <section
      id="spaces"
      ref={marketplaceRef}
      tabIndex={-1}
      className="spaces-section site-shell section-space"
      aria-labelledby="spaces-title"
    >
      <div className="section-heading grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="eyebrow section-label">01 / THE MARKETPLACE</div>
          <h2 id="spaces-title">
            Small spaces.
            <br />
            <em>Right audiences.</em>
          </h2>
        </div>
        <div className="section-intro">
          <p>
            You don’t need to reach everyone.
            <br />
            Just the people who get what you’re building.
          </p>
          <div className="demo-indicator flex items-center gap-2">
            <span className="status-dot" />
            NOSTR MARKETPLACE · READ ONLY
          </div>
        </div>
      </div>
      <div className="market-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div
          className="filter-group flex flex-wrap gap-2"
          role="group"
          aria-label="Filter placements"
        >
          {(["all", ...categories] as const).map((category) => (
            <button
              key={category}
              type="button"
              className={`filter-button${filter === category ? " active" : ""}`}
              data-filter={category}
              aria-pressed={filter === category}
              onClick={() => setFilter(category)}
            >
              {category === "all" ? (
                <>
                  All spaces{" "}
                  <span>{String(listings.length).padStart(2, "0")}</span>
                </>
              ) : (
                category
              )}
            </button>
          ))}
        </div>
        <span className="mono muted market-note">
          DISCOVERED ON NOSTR RELAYS.
        </span>
      </div>
      <div className="marketplace-status" aria-live="polite">
        {marketplace.status === "loading" && (
          <p role="status">Loading Nostr listings…</p>
        )}
        {marketplace.status === "error" && (
          <p role="alert">
            Unable to load listings from relays.{" "}
            {listings.length > 0 && "Previously loaded listings may be stale."}
          </p>
        )}
        {marketplace.status === "ready" && listings.length === 0 && (
          <p>No listings found on the configured relays.</p>
        )}
        {marketplace.status === "ready" &&
          listings.length > 0 &&
          !listings.some(
            (listing) => filter === "all" || listing.category === filter,
          ) && <p>No listings match this category.</p>}
        {marketplace.status === "ready" &&
          marketplace.relays.some((relay) => !relay.ok) && (
            <p>Some relays are unavailable. Results may be incomplete.</p>
          )}
        {marketplace.status === "ready" &&
          marketplace.relays.some((relay) => relay.ok && relay.truncated) && (
            <p>Relay results were limited. More listings may be available.</p>
          )}
        <button
          type="button"
          className="text-link"
          disabled={marketplace.status === "loading"}
          onClick={() => void marketplace.refresh()}
        >
          {marketplace.status === "error"
            ? "Retry listings"
            : "Refresh listings"}
        </button>
      </div>
      <div
        id="listing-grid"
        className="listing-grid card-grid"
        aria-live="polite"
      >
        {listings.map((listing) => (
          <ListingCard key={listing.address} listing={listing} />
        ))}
      </div>
      <div className="market-bottom flex flex-col sm:flex-row justify-between gap-3">
        <p>
          Public Nostr listings are unverified. Booking and payments are
          unavailable.
        </p>
        <ListSpaceButton className="text-link">
          Your corner of the internet belongs here{" "}
          <span aria-hidden="true">↗</span>
        </ListSpaceButton>
      </div>
    </section>
  );
}
