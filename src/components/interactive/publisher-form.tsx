"use client";
import { categories, isCategory, isHttpUrl } from "@/lib/marketplace";
import { useState } from "react";
import type { ListingFormValues } from "@/lib/frontend-forms";
import { NostrError, publishListing } from "@/lib/nostr";
import { ListingPersistence, type SavedRoom } from "./listing-persistence";
import { CampaignAreaButton } from "./campaign-area";
import { useExperience } from "./experience-context";

const DEFAULT_AD_DURATION_DAYS = 7;
const DEFAULT_MAX_ADS = 1;

/**
 * A fresh listing id: 9 random bytes as base64url, giving 12 characters of
 * `[A-Za-z0-9_-]`.
 *
 * That alphabet is exactly the one listingId is restricted to (isListingId in
 * src/lib/nostr/listing-event.ts), so no escaping is needed on the way to the `d`
 * tag or the share URL. Generated on the first submit rather than during render:
 * a value created while rendering would differ between the server pass and
 * hydration.
 */
function randomListingId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function PublisherForm() {
  const { user, openModal } = useExperience();
  const [review, setReview] = useState<ListingFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedRoom | null>(null);
  // Kept until the relay publish succeeds, because a retry has to resend the same
  // fields, and the form has already been reset by then.
  const [published, setPublished] = useState<ListingFormValues | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  /**
   * Signs and publishes the room to the relays the marketplace reads from.
   *
   * `expectedPubkey` is load-bearing: the room row belongs to the session pubkey,
   * and the address is derived from the event's author. Signing with a different
   * extension account would publish an event whose address does not match the row,
   * so the room would never resolve. The signer refuses that instead.
   */
  async function publishToRelays(room: SavedRoom, values: ListingFormValues) {
    setPublishError(null);
    try {
      if (!isCategory(values.category)) {
        throw new Error("Unknown category.");
      }
      const priceSats = Number(values.dailyPriceSats);
      const result = await publishListing(
        {
          listingId: room.listingId,
          name: values.name,
          category: values.category,
          description: values.description,
          priceSats,
          websiteUrl: values.websiteUrl,
          audience: values.audience,
        },
        { expectedPubkey: room.pubkey },
      );

      // Best-effort: the room is already live on the relays at this point, so a
      // failure to record the id must not be reported as a failed publish.
      await fetch(`/api/listings/${room.id}/event`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: result.eventId }),
      }).catch(() => {});

      setSaved({ ...room, published: true });
      setPublished(null);
    } catch (cause) {
      setPublishError(
        cause instanceof NostrError
          ? cause.message
          : "The room was saved, but it could not be published to the relays.",
      );
    }
  }

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const values: ListingFormValues = {
      name: String(data.get("name") ?? "").trim(),
      websiteUrl: String(data.get("url") ?? "").trim(),
      category: String(data.get("category") ?? ""),
      dailyPriceSats: String(data.get("price") ?? ""),
      description: String(data.get("description") ?? "").trim(),
      audience: String(data.get("audience") ?? "").trim(),
      adDurationDays: Number(data.get("duration") ?? DEFAULT_AD_DURATION_DAYS),
      maxAds: Number(data.get("maxAds") ?? DEFAULT_MAX_ADS),
      imageUrl: String(data.get("imageUrl") ?? "").trim() || undefined,
    };

    // Checked before anything else: a signed-out visitor should be sent to sign
    // in, not shown a preview of a room the server would refuse to create.
    if (!user) {
      setError("Sign in with your wallet before publishing a room.");
      openModal({ kind: "auth", authMode: "login" });
      return;
    }

    setReview(values);
    setSaved(null);
    setPublished(null);
    setPublishError(null);

    const priceSats = Number(values.dailyPriceSats);
    if (!Number.isInteger(priceSats) || priceSats < 1) {
      setError("Daily price must be a whole number of sats, at least 1.");
      return;
    }
    if (!isCategory(values.category)) {
      setError("Choose a category from the list.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Reused across retries so a resubmit returns the room that already exists
      // rather than creating a second one under a new address.
      const id = listingId ?? randomListingId();
      if (!listingId) setListingId(id);

      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listingId: id,
          title: values.name,
          description: values.description,
          audience: values.audience,
          websiteUrl: values.websiteUrl,
          category: values.category,
          priceSats,
          adDurationDays: values.adDurationDays,
          maxAds: values.maxAds,
          imageUrl: values.imageUrl,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: unknown;
        listing?: {
          id?: unknown;
          listingId?: unknown;
          address?: unknown;
          pubkey?: unknown;
          title?: unknown;
        };
      };

      if (!response.ok) {
        setError(
          typeof body.error === "string"
            ? body.error
            : "The room could not be published.",
        );
        return;
      }

      const room: SavedRoom = {
        id: String(body.listing?.id ?? ""),
        listingId: String(body.listing?.listingId ?? id),
        address: String(body.listing?.address ?? ""),
        pubkey: String(body.listing?.pubkey ?? user.pubkey),
        title: String(body.listing?.title ?? values.name),
        published: false,
      };

      setSaved(room);
      setPublished(values);
      // The room exists, so the id has done its job and `saved.listingId` carries
      // it from here. Clearing it means a second room gets its own id instead of
      // resolving back to this one through unique (pubkey, listing_id).
      setListingId(null);
      form.reset();

      // The room exists now. Everything past this point is about making it
      // discoverable, and failures there are reported separately.
      await publishToRelays(room, values);
    } catch {
      setError("Could not reach the server. Nothing was saved.");
    } finally {
      setSaving(false);
    }
  }

  async function retryPublish() {
    if (!saved || !published) return;
    setSaving(true);
    try {
      await publishToRelays(saved, published);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      id="publisher-form"
      onChange={() => {
        setSaved(null);
        setPublishError(null);
        // Editing the form is new intent, so the next submit is a new room rather
        // than a retry that would resolve to the previous one.
        setListingId(null);
      }}
      onSubmit={publish}
    >
      <label htmlFor="site-name">Publication name</label>
      <input
        className="w-full"
        id="site-name"
        name="name"
        maxLength={48}
        placeholder="The name above your door"
        required
        onInput={(event) =>
          event.currentTarget.setCustomValidity(
            event.currentTarget.value.trim()
              ? ""
              : "Please add a publication name.",
          )
        }
      />
      <label htmlFor="site-url">Website URL</label>
      <input
        className="w-full"
        id="site-url"
        name="url"
        type="url"
        placeholder="Your website’s full HTTPS address"
        required
        onInput={(event) =>
          event.currentTarget.setCustomValidity(
            isHttpUrl(event.currentTarget.value)
              ? ""
              : "Please enter a full HTTP or HTTPS website address.",
          )
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="site-category">Your corner</label>
          <select
            className="w-full"
            id="site-category"
            name="category"
            defaultValue="Bitcoin"
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="site-price">Daily price in sats</label>
          <input
            className="w-full"
            id="site-price"
            name="price"
            type="number"
            min={1}
            max={100000000}
            step={1}
            defaultValue={5000}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="site-duration">Days an ad lasts</label>
          <input
            className="w-full"
            id="site-duration"
            name="duration"
            type="number"
            min={1}
            max={365}
            step={1}
            defaultValue={DEFAULT_AD_DURATION_DAYS}
            required
          />
        </div>
        <div>
          <label htmlFor="site-max-ads">Ads that fit at once</label>
          <input
            className="w-full"
            id="site-max-ads"
            name="maxAds"
            type="number"
            min={1}
            max={50}
            step={1}
            defaultValue={DEFAULT_MAX_ADS}
            required
          />
        </div>
      </div>
      <label htmlFor="site-description">The placement</label>
      <textarea
        className="w-full"
        id="site-description"
        name="description"
        rows={2}
        maxLength={4000}
        placeholder="What an advertiser gets: where the banner appears and how big."
        required
        onInput={(event) =>
          event.currentTarget.setCustomValidity(
            event.currentTarget.value.trim()
              ? ""
              : "Please describe the placement.",
          )
        }
      />
      <label htmlFor="site-audience">Who is it for?</label>
      <textarea
        className="w-full"
        id="site-audience"
        name="audience"
        rows={2}
        maxLength={500}
        placeholder="A few honest words about your audience."
        required
        onInput={(event) =>
          event.currentTarget.setCustomValidity(
            event.currentTarget.value.trim()
              ? ""
              : "Please describe your audience.",
          )
        }
      />
      <label htmlFor="site-image">Banner image URL (optional)</label>
      <input
        className="w-full"
        id="site-image"
        name="imageUrl"
        type="url"
        placeholder="https://example.com/banner.jpg"
      />
      <button type="submit" className="text-link feature-action" disabled={saving}>
        {saving ? "Publishing…" : "Publish room"}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <ListingPersistence
        review={review}
        saved={saved}
        publishError={publishError}
        retrying={saving}
        onRetryPublish={() => void retryPublish()}
      />
      <CampaignAreaButton className="text-link feature-action">
        Preview campaign tools ↗
      </CampaignAreaButton>
    </form>
  );
}
