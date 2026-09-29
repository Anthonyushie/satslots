"use client";

import { useEffect, useMemo, useState } from "react";
import type { CampaignFormValues } from "@/lib/frontend-forms";
import { isHttpUrl } from "@/lib/marketplace";
import { AdCreative } from "./ad-creative";
import { useExperience } from "./experience-context";

const emptyValues: CampaignFormValues = {
  name: "",
  headline: "",
  destinationUrl: "",
  description: "",
};
const acceptedImageTypes = ["image/png", "image/jpeg", "image/webp"];
const maxPreviewBytes = 5 * 1024 * 1024;

interface CampaignRecord extends CampaignFormValues {
  id: string;
  bookingId: string;
  imageUrl: string;
  status: "draft" | "active" | "paused";
  impressions: number;
  clicks: number;
}
interface EligibleBooking {
  id: string;
  roomTitle: string;
  startsOn: string;
  endsOn: string;
  campaignId: string | null;
}

export function CampaignEditor({
  initialBookingId,
}: {
  initialBookingId?: string;
}) {
  const { user, openModal } = useExperience();
  const [values, setValues] = useState<CampaignFormValues>(emptyValues);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [bookings, setBookings] = useState<EligibleBooking[]>([]);
  const [bookingId, setBookingId] = useState(initialBookingId ?? "");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileError, setFileError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(user));
  const [saving, setSaving] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === campaignId) ?? null,
    [campaignId, campaigns],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/campaigns")
      .then(async (response) => {
        if (!response.ok) throw new Error("Campaigns could not be loaded.");
        return response.json();
      })
      .then(
        (data: {
          campaigns?: CampaignRecord[];
          bookings?: EligibleBooking[];
        }) => {
          if (cancelled) return;
          setCampaigns(data.campaigns ?? []);
          setBookings(data.bookings ?? []);
          setBookingId(
            (current) =>
              current || initialBookingId || data.bookings?.[0]?.id || "",
          );
        },
      )
      .catch(
        (cause) =>
          !cancelled &&
          setError(
            cause instanceof Error
              ? cause.message
              : "Campaigns could not be loaded.",
          ),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [initialBookingId, user]);

  useEffect(
    () => () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function update(field: keyof CampaignFormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setReviewed(false);
    setMessage("");
  }

  function loadCampaign(id: string) {
    const campaign = campaigns.find((item) => item.id === id);
    setCampaignId(campaign?.id ?? null);
    if (!campaign) return;
    setBookingId(campaign.bookingId);
    setValues({
      name: campaign.name,
      headline: campaign.headline,
      destinationUrl: campaign.destinationUrl,
      description: campaign.description,
    });
    setImageUrl(campaign.imageUrl);
    setPreviewUrl(campaign.imageUrl);
    setMessage("");
    setError("");
  }

  async function save(status: "draft" | "active") {
    setError("");
    setMessage("");
    if (!user) {
      openModal({ kind: "auth", authMode: "login" });
      return;
    }
    if (!bookingId) {
      setError("Choose a paid booking first.");
      return;
    }
    if (!imageUrl) {
      setError("Choose campaign artwork first.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: campaignId ?? undefined,
          bookingId,
          ...values,
          imageUrl,
          status,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        campaign?: CampaignRecord;
      };
      if (!response.ok || !data.campaign)
        throw new Error(data.error || "Campaign could not be saved.");
      const saved = data.campaign;
      setCampaignId(saved.id);
      setCampaigns((current) => [
        saved,
        ...current.filter((item) => item.id !== saved.id),
      ]);
      setMessage(
        status === "active"
          ? "Campaign activated and ready for its embed."
          : "Draft saved.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Campaign could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="creative-title">
      <h3 id="creative-title">Prepare a creative</h3>
      {user && (
        <>
          {loading && (
            <p role="status" className="dialog-lead">
              Loading paid bookings…
            </p>
          )}
          {campaigns.length > 0 && (
            <>
              <label htmlFor="saved-campaign">Saved campaign</label>
              <select
                id="saved-campaign"
                value={campaignId ?? ""}
                onChange={(event) => loadCampaign(event.target.value)}
              >
                <option value="">New campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} · {campaign.status}
                  </option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="campaign-booking">Paid placement</label>
          <select
            id="campaign-booking"
            required
            value={bookingId}
            onChange={(event) => setBookingId(event.target.value)}
          >
            <option value="">Choose a paid booking</option>
            {bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.roomTitle} · {booking.startsOn} → {booking.endsOn}
              </option>
            ))}
          </select>
          {!loading && bookings.length === 0 && (
            <p className="booking-warning">
              Pay for a booking before creating a campaign.
            </p>
          )}
        </>
      )}
      <form
        aria-label="Campaign creative"
        onSubmit={(event) => {
          event.preventDefault();
          const submitter = (event.nativeEvent as SubmitEvent)
            .submitter as HTMLButtonElement | null;
          if (!user) setReviewed(true);
          else void save(submitter?.value === "active" ? "active" : "draft");
        }}
        onReset={(event) => {
          event.currentTarget
            .querySelectorAll("input")
            .forEach((input) => input.setCustomValidity(""));
          setValues(emptyValues);
          setCampaignId(null);
          setImageUrl("");
          setPreviewUrl("");
          setFileError("");
          setMessage("");
          setError("");
          setReviewed(false);
        }}
      >
        <label htmlFor="campaign-name">Campaign name</label>
        <input
          id="campaign-name"
          value={values.name}
          maxLength={80}
          required
          onChange={(event) => update("name", event.target.value)}
        />
        <label htmlFor="creative-headline">Creative headline</label>
        <input
          id="creative-headline"
          value={values.headline}
          maxLength={80}
          required
          onChange={(event) => update("headline", event.target.value)}
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
            setFileError("");
            setReviewed(false);
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
            setPreviewUrl(URL.createObjectURL(file));
            const reader = new FileReader();
            reader.onload = () => setImageUrl(String(reader.result ?? ""));
            reader.onerror = () => setFileError("The image could not be read.");
            reader.readAsDataURL(file);
          }}
        />
        <p id="artwork-note" className="dialog-lead">
          PNG, JPEG, or WebP; up to 5 MiB.
        </p>
        <p id="artwork-error" role="alert">
          {fileError}
        </p>
        <div className="feature-section">
          <h4>Creative preview</h4>
          <AdCreative
            headline={values.headline}
            description={values.description}
            localImageUrl={previewUrl || imageUrl}
            live={Boolean(user && selectedCampaign?.status === "active")}
          />
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="booking-warning">
            {message}
          </p>
        )}
        {reviewed && (
          <p role="status" className="booking-warning">
            Local review ready for {values.name}. Not saved, uploaded, approved,
            or activated. Sign in and complete a paid booking to continue.
          </p>
        )}
        <div className="flex flex-wrap gap-4 feature-action">
          {user ? (
            <>
              <button
                type="submit"
                name="status"
                value="draft"
                className="text-link"
                disabled={saving || !bookingId}
              >
                Save draft
              </button>
              <button
                type="submit"
                name="status"
                value="active"
                className="text-link"
                disabled={saving || !bookingId}
              >
                Activate campaign
              </button>
            </>
          ) : (
            <>
              <button type="submit" className="text-link">
                Review creative locally
              </button>
              <button type="button" className="text-link" disabled>
                Campaign saving unavailable
              </button>
              <button type="button" className="text-link" disabled>
                Activation unavailable
              </button>
            </>
          )}
          <button type="reset" className="text-link">
            Clear creative
          </button>
        </div>
      </form>
      {selectedCampaign && (
        <section className="feature-section">
          <h3>Delivery & analytics</h3>
          <div className="booking-summary">
            <div>
              <span>Status</span>
              <span>{selectedCampaign.status}</span>
            </div>
            <div>
              <span>Impressions</span>
              <span>{selectedCampaign.impressions.toLocaleString()}</span>
            </div>
            <div>
              <span>Clicks</span>
              <span>{selectedCampaign.clicks.toLocaleString()}</span>
            </div>
            <div>
              <span>CTR</span>
              <span>
                {selectedCampaign.impressions
                  ? `${((selectedCampaign.clicks / selectedCampaign.impressions) * 100).toFixed(1)}%`
                  : "0.0%"}
              </span>
            </div>
          </div>
          <p>
            <a
              className="text-link"
              href={`/demo/${selectedCampaign.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open publisher demo ↗
            </a>
          </p>
          <p className="feature-filename">
            Embed: &lt;iframe src=&quot;
            {typeof window === "undefined" ? "" : window.location.origin}/embed/
            {selectedCampaign.id}&quot; title=&quot;Sponsored
            message&quot;&gt;&lt;/iframe&gt;
          </p>
        </section>
      )}
    </section>
  );
}
