"use client";

import { useState } from "react";
import type { ListingFormValues } from "@/lib/frontend-forms";
import { Icon } from "./experience-context";

/** A room the server has created. `published` is false until a relay accepts it. */
export interface SavedRoom {
  id: string;
  listingId: string;
  address: string;
  pubkey: string;
  title: string;
  published: boolean;
}

/**
 * The shareable address of the room's own page.
 *
 * Absolute rather than relative so it can be pasted anywhere, which is the point
 * of a share link. Built at click time from window.location, so it never differs
 * between the server render and hydration.
 */
function shareUrl(address: string): string {
  const path = `/listings/${address}`;
  return typeof window === "undefined"
    ? path
    : new URL(path, window.location.origin).toString();
}

function ShareLink({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/listings/${address}`;

  return (
    <div className="booking-summary">
      <div>
        <span>Share link</span>
        <span className="mono">
          <a href={path}>{path}</a>
        </span>
      </div>
      <button
        type="button"
        className="text-link feature-action"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(shareUrl(address))
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        {copied ? "Copied" : "Copy share link"}
      </button>
    </div>
  );
}

export function ListingPersistence({
  review,
  saved,
  publishError,
  retrying,
  onRetryPublish,
}: {
  review: ListingFormValues | null;
  saved: SavedRoom | null;
  publishError: string | null;
  retrying: boolean;
  onRetryPublish: () => void;
}) {
  return (
    <section aria-label="Listing review and persistence">
      {saved && (
        <div className="booking-summary" role="status">
          <h3>{saved.published ? "Room published" : "Room saved"}</h3>
          <div>
            <span>Publication</span>
            <span>{saved.title}</span>
          </div>
          <div>
            <span>Room id</span>
            <span className="mono">{saved.id}</span>
          </div>
          {saved.published ? (
            <p>
              It is now in the marketplace, and shows up under “Rooms you own” on
              your dashboard.
            </p>
          ) : (
            <p className="booking-warning">
              It is saved to your account, but it has not reached the relays yet —
              so it is not in the marketplace and nobody else can find it. Retry to
              publish it.
            </p>
          )}
        </div>
      )}

      {saved && saved.address && <ShareLink address={saved.address} />}

      {publishError && (
        <>
          <p role="alert" className="form-error">
            {publishError}
          </p>
          <button
            type="button"
            className="text-link feature-action"
            disabled={retrying}
            onClick={onRetryPublish}
          >
            {retrying ? "Publishing…" : "Retry publishing to relays"}
          </button>
        </>
      )}

      {review && !saved && (
        <div className="booking-summary" aria-live="polite">
          <h3>Publishing this room</h3>
          <div>
            <span>Publication</span>
            <span>{review.name}</span>
          </div>
          <div>
            <span>Website</span>
            <span>{review.websiteUrl}</span>
          </div>
          <div>
            <span>Category</span>
            <span>{review.category}</span>
          </div>
          <div>
            <span>Daily price in sats</span>
            <span>{review.dailyPriceSats}</span>
          </div>
          <div>
            <span>Days an ad lasts</span>
            <span>{review.adDurationDays}</span>
          </div>
          <div>
            <span>Ads that fit at once</span>
            <span>{review.maxAds}</span>
          </div>
          <p>{review.description}</p>
          <p>{review.audience}</p>
        </div>
      )}
      <div className="form-disclaimer" role="status">
        <Icon name="asterisk" small />
        <span>
          A room is saved to your account and belongs to you alone — only you can
          edit or delete it. Advertisers book a start date; the end date comes
          from “Days an ad lasts”. Once the room is full for those dates, the next
          booking is refused.
        </span>
      </div>
    </section>
  );
}
