import Image from "next/image";

// Presentation only: callers own selection, authorization, and delivery.
// localImageUrl is an object URL from a user-selected file, never a remote ad URL.
export function AdCreative({
  headline,
  description,
  localImageUrl,
}: {
  headline?: string;
  description?: string;
  localImageUrl?: string;
}) {
  return (
    <div className="ad-creative" aria-label="Ad creative presentation">
      {headline || description || localImageUrl ? (
        <>
          <span className="eyebrow">LOCAL PREVIEW · NOT SERVING</span>
          {localImageUrl && (
            <Image
              src={localImageUrl}
              alt="Selected creative artwork"
              width={640}
              height={360}
              unoptimized
            />
          )}
          {headline && <h4>{headline}</h4>}
          {description && <p>{description}</p>}
        </>
      ) : (
        <p role="status">
          Ad delivery unavailable. No approved creative is connected.
        </p>
      )}
    </div>
  );
}

export function AdDeliveryPreview() {
  return (
    <section className="feature-section" aria-labelledby="delivery-title">
      <h3 id="delivery-title">Ad delivery</h3>
      <p className="dialog-lead">
        This is an empty presentation shell, not a live embed. Campaign
        selection, approval, scheduling, and delivery are not connected.
      </p>
      <AdCreative />
      <p className="booking-warning">
        The current site is a static export. Runtime campaign embeds need a
        deployment and delivery contract before installation code can be
        offered.
      </p>
      <button type="button" className="text-link" disabled>
        Embed installation unavailable
      </button>
    </section>
  );
}
