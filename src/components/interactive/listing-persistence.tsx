import type { ListingFormValues } from "@/lib/frontend-forms";
import { Icon } from "./experience-context";

export function ListingPersistence({
  review,
}: {
  review: ListingFormValues | null;
}) {
  return (
    <section aria-label="Listing review and persistence">
      {review && (
        <div className="booking-summary" aria-live="polite">
          <h3>Unsaved listing review</h3>
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
          <p>{review.description}</p>
        </div>
      )}
      <div className="form-disclaimer" id="publisher-unavailable" role="status">
        <Icon name="asterisk" small />
        <span>
          Publishing is unavailable until the backend listing and authentication
          contracts are connected. Nothing is saved or published. Form values
          remain in this page only and are lost on reload. Database persistence,
          ownership checks, and relay publication order still need agreement.
        </span>
      </div>
      <button
        className="button button-ink w-full"
        type="button"
        disabled
        aria-describedby="publisher-unavailable"
      >
        Publishing unavailable <Icon name="arrow-up" />
      </button>
    </section>
  );
}
