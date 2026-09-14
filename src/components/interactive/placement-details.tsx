"use client";

import { BookingForm } from "./booking-form";
import { formatSats } from "@/lib/marketplace";
import type { NostrListing } from "@/lib/nostr";

export function PlacementDetails({ listing }: { listing: NostrListing }) {
  return (
    <div id="placement-content">
      <h2 id="placement-title">{listing.name}</h2>
      <p className="dialog-lead">{listing.description}</p>
      {listing.audience && <p>{listing.audience}</p>}
      <div className="booking-summary">
        <div>
          <span>Placement</span>
          <span>Website banner</span>
        </div>
        <div>
          <span>Advertised daily price</span>
          <span>{formatSats(listing.priceSats)} sats</span>
        </div>
        <div>
          <span>Website</span>
          <a
            href={listing.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit publisher website
          </a>
        </div>
      </div>
      <p>
        Public relay listing. Website ownership, availability, and price have
        not been verified.
      </p>
      <BookingForm />
    </div>
  );
}
