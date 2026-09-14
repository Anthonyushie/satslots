"use client";
import { categories, isHttpUrl } from "@/lib/marketplace";
import { useState } from "react";
import type { ListingFormValues } from "@/lib/frontend-forms";
import { ListingPersistence } from "./listing-persistence";
import { CampaignAreaButton } from "./campaign-area";

export function PublisherForm() {
  const [review, setReview] = useState<ListingFormValues | null>(null);
  return (
    <form
      id="publisher-form"
      onChange={() => setReview(null)}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setReview({
          name: String(data.get("name") ?? "").trim(),
          websiteUrl: String(data.get("url") ?? "").trim(),
          category: String(data.get("category") ?? ""),
          dailyPriceSats: String(data.get("price") ?? ""),
          description: String(data.get("description") ?? "").trim(),
        });
      }}
      aria-describedby="publisher-unavailable"
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
      <label htmlFor="site-description">Who is it for?</label>
      <textarea
        className="w-full"
        id="site-description"
        name="description"
        rows={2}
        maxLength={160}
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
      <button type="submit" className="text-link feature-action">
        Review listing locally
      </button>
      <ListingPersistence review={review} />
      <CampaignAreaButton className="text-link feature-action">
        Preview campaign tools ↗
      </CampaignAreaButton>
    </form>
  );
}
