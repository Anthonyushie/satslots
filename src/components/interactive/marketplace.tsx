"use client";

import {
  categories,
  formatSats,
  type Listing,
  type SampleListingId,
} from "@/lib/marketplace";
import {
  Icon,
  useExperience,
} from "@/components/interactive/experience-context";
import { ListSpaceButton } from "@/components/interactive/experience-provider";

function SampleArtwork({ id }: { id: SampleListingId }) {
  if (id === "fieldnotes")
    return (
      <div className="listing-art fieldnotes-art">
        <div className="mini-masthead flex justify-between">
          <span>FIELDNOTES</span>
          <span>BITCOIN, WITHOUT THE NOISE.</span>
        </div>
        <div className="mini-editorial">
          Stay curious.
          <br />
          <em>Stay sovereign.</em>
        </div>
        <div className="mini-slot flex items-center justify-between">
          <span>YOUR BRAND, IN GOOD COMPANY</span>
          <Icon name="arrow-up" small />
        </div>
        <span className="placement-type">WEBSITE BANNER</span>
      </div>
    );
  if (id === "offscript")
    return (
      <div className="listing-art offscript-art">
        <div className="mini-masthead flex justify-between">
          <span>OFFSCRIPT®</span>
          <span>DESIGN IS A POINT OF VIEW.</span>
        </div>
        <div className="offscript-layout flex items-center justify-between">
          <span>
            Less,
            <br />
            but
            <br />
            <em>louder.</em>
          </span>
          <svg className="ribbon-art" viewBox="0 0 150 160" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="12">
              <path d="M23 42C23 5 115 8 123 40s-88 50-96 81 91 41 102 1" />
              <path d="M23 61C23 24 115 27 123 59s-88 50-96 81" />
              <path d="M23 23C23 60 123 99 123 136" />
            </g>
          </svg>
        </div>
        <span className="placement-type">WEBSITE BANNER</span>
      </div>
    );
  return (
    <div className="listing-art quietbuild-art">
      <div className="mini-masthead flex justify-between">
        <span>~/QUIET.BUILD</span>
        <span>INDEPENDENT SOFTWARE.</span>
      </div>
      <div className="code-art">
        <span className="code-comment">{"// less noise. more shipping."}</span>
        <div>
          build<span className="code-cursor">_</span>
          <br />
          <em>
            something
            <br />
            that matters.
          </em>
        </div>
      </div>
      <span className="placement-type">WEBSITE BANNER</span>
    </div>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  const { filter, openModal } = useExperience();
  const categoryLabel = listing.local
    ? `${listing.category.toUpperCase()} · YOUR PREVIEW`
    : {
        fieldnotes: "BITCOIN & CULTURE",
        offscript: "DESIGN & INDEPENDENT WORK",
        quietbuild: "DEVELOPERS & OPEN SOURCE",
      }[listing.id];
  return (
    <article
      className="listing-card"
      data-category={listing.category}
      data-listing-id={listing.id}
      hidden={filter !== "all" && filter !== listing.category}
    >
      {listing.local ? (
        <div className="listing-art custom-listing-art">
          <div className="mini-masthead flex justify-between">
            <span>YOUR LITTLE CORNER.</span>
            <span>LOCAL PREVIEW ONLY</span>
          </div>
          <div className="mini-editorial">{listing.name}</div>
          <span className="placement-type">WEBSITE BANNER · NOT PUBLISHED</span>
        </div>
      ) : (
        <SampleArtwork id={listing.id} />
      )}
      <div className="listing-body">
        <div className="listing-category mono">{categoryLabel}</div>
        <h3>
          {listing.name} <Icon name="asterisk" small />
        </h3>
        <p>
          {listing.local ? (
            listing.description
          ) : listing.id === "fieldnotes" ? (
            <>
              Thoughtful essays for people building
              <br className="desktop-break" /> a more independent world.
            </>
          ) : listing.id === "offscript" ? (
            <>
              A home for good taste, small studios,
              <br className="desktop-break" /> and doing things your own way.
            </>
          ) : (
            <>
              Notes from the workbench.
              <br />
              For the people who actually ship.
            </>
          )}
        </p>
        <div className="listing-footer flex items-end justify-between gap-3">
          <div className="listing-price">
            {formatSats(listing.price)} <span>sats / day</span>
          </div>
          <button
            type="button"
            className="placement-button"
            data-placement={listing.id}
            aria-label={`View ${listing.name} placement`}
            onClick={(event) =>
              openModal(
                { kind: "placement", listingId: listing.id },
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
  const { listings, filter, setFilter, marketplaceRef } = useExperience();
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
            INTERACTIVE DEMO · SAMPLE LISTINGS
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
          CURATED BY PEOPLE, NOT PIXELS.
        </span>
      </div>
      <div
        id="listing-grid"
        className="listing-grid card-grid"
        aria-live="polite"
      >
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
      <div className="market-bottom flex flex-col sm:flex-row justify-between gap-3">
        <p>
          Illustrative publishers &amp; prices. No real bookings or payments.
        </p>
        <ListSpaceButton className="text-link">
          Your corner of the internet belongs here{" "}
          <span aria-hidden="true">↗</span>
        </ListSpaceButton>
      </div>
    </section>
  );
}
