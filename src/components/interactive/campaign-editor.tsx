"use client";

import { useEffect, useState } from "react";
import type { CampaignFormValues } from "@/lib/frontend-forms";
import { isHttpUrl } from "@/lib/marketplace";
import { AdCreative } from "./ad-creative";

const emptyValues: CampaignFormValues = {
  name: "",
  headline: "",
  destinationUrl: "",
  description: "",
};
const acceptedImageTypes = ["image/png", "image/jpeg", "image/webp"];
const maxPreviewBytes = 5 * 1024 * 1024;

export function CampaignEditor() {
  const [values, setValues] = useState<CampaignFormValues>(emptyValues);
  const [artwork, setArtwork] = useState<{ file: File; url: string } | null>(
    null,
  );
  const [fileError, setFileError] = useState("");
  const [reviewed, setReviewed] = useState(false);

  useEffect(() => {
    if (!artwork) return;
    return () => URL.revokeObjectURL(artwork.url);
  }, [artwork]);

  function update(field: keyof CampaignFormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setReviewed(false);
  }

  return (
    <section aria-labelledby="creative-title">
      <h3 id="creative-title">Prepare a creative</h3>
      <form
        aria-label="Campaign creative"
        aria-describedby="campaign-unavailable"
        onSubmit={(event) => {
          event.preventDefault();
          setReviewed(true);
        }}
        onReset={(event) => {
          event.currentTarget
            .querySelectorAll("input")
            .forEach((input) => input.setCustomValidity(""));
          setValues(emptyValues);
          setArtwork(null);
          setFileError("");
          setReviewed(false);
        }}
      >
        <label htmlFor="campaign-name">Campaign name</label>
        <input
          id="campaign-name"
          value={values.name}
          maxLength={80}
          required
          onChange={(event) => {
            update("name", event.target.value);
            event.target.setCustomValidity(
              event.target.value.trim() ? "" : "Enter a campaign name.",
            );
          }}
        />
        <label htmlFor="creative-headline">Creative headline</label>
        <input
          id="creative-headline"
          value={values.headline}
          maxLength={80}
          required
          onChange={(event) => {
            update("headline", event.target.value);
            event.target.setCustomValidity(
              event.target.value.trim() ? "" : "Enter a headline.",
            );
          }}
        />
        <label htmlFor="creative-destination">Destination URL</label>
        <input
          id="creative-destination"
          type="url"
          value={values.destinationUrl}
          required
          onChange={(event) => {
            update("destinationUrl", event.target.value);
            event.target.setCustomValidity(
              isHttpUrl(event.target.value)
                ? ""
                : "Enter a full HTTP or HTTPS address.",
            );
          }}
        />
        <label htmlFor="creative-description">Creative description</label>
        <textarea
          id="creative-description"
          rows={2}
          maxLength={160}
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
        />
        <label htmlFor="creative-artwork">
          Choose artwork for local preview
        </label>
        <input
          id="creative-artwork"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-describedby="artwork-note artwork-error"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setArtwork(null);
            setReviewed(false);
            setFileError("");
            if (!file) return;
            if (
              !acceptedImageTypes.includes(file.type) ||
              file.size > maxPreviewBytes
            ) {
              setFileError(
                "Choose a PNG, JPEG, or WebP image no larger than 5 MiB.",
              );
              event.target.value = "";
              return;
            }
            setArtwork({ file, url: URL.createObjectURL(file) });
          }}
        />
        <p id="artwork-note" className="dialog-lead">
          PNG, JPEG, or WebP; up to 5 MiB for this local preview only. No file
          is uploaded. Production limits and validation are not agreed.
        </p>
        <p id="artwork-error" role="alert">
          {fileError}
        </p>
        {artwork && (
          <p className="feature-filename">
            Selected locally: {artwork.file.name}
          </p>
        )}
        <div className="flex flex-wrap gap-4 feature-action">
          <button type="submit" className="text-link">
            Review creative locally
          </button>
          <button type="reset" className="text-link">
            Clear creative
          </button>
        </div>
        {reviewed && (
          <p role="status" className="booking-warning">
            Local review ready for {values.name}. Not saved, uploaded, approved,
            or activated.
          </p>
        )}
      </form>
      <div className="feature-section">
        <h4>Creative preview</h4>
        <AdCreative
          headline={values.headline}
          description={values.description}
          localImageUrl={artwork?.url}
        />
        {values.destinationUrl && (
          <p className="feature-filename">
            Destination (not opened): {values.destinationUrl}
          </p>
        )}
      </div>
      <p id="campaign-unavailable" className="form-disclaimer" role="status">
        Campaign persistence, uploads, and activation are unavailable. This
        workspace is unsaved and clears when closed. There is no campaign record
        or booking association.
      </p>
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          className="text-link"
          disabled
          aria-describedby="campaign-unavailable"
        >
          Campaign saving unavailable
        </button>
        <button
          type="button"
          className="text-link"
          disabled
          aria-describedby="campaign-unavailable"
        >
          Activation unavailable
        </button>
      </div>
    </section>
  );
}
