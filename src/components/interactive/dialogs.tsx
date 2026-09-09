"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  categories,
  formatSats,
  isCategory,
  isHttpUrl,
  type Listing,
} from "@/lib/marketplace";
import {
  Icon,
  useExperience,
} from "@/components/interactive/experience-context";

function NativeDialog({
  id,
  labelledBy,
  active,
  children,
}: {
  id: string;
  labelledBy: string;
  active: boolean;
  children: ReactNode;
}) {
  const { closeModal, restoreFocus } = useExperience();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdropPress = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog) return;
    const body = document.body;
    const hadClass = body.classList.contains("dialog-open");
    const overflow = body.style.overflow;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    body.classList.add("dialog-open");
    body.style.overflow = "hidden";
    return () => {
      // Cleanup also runs during StrictMode's effect replay. The onClose guard
      // ignores a queued native close event if this dialog has reopened.
      if (dialog.open) dialog.close();
      if (!hadClass) body.classList.remove("dialog-open");
      body.style.overflow = overflow;
      backdropPress.current = false;
      restoreFocus();
    };
  }, [active, restoreFocus]);

  return (
    <dialog
      ref={dialogRef}
      id={id}
      className="site-dialog"
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        closeModal();
      }}
      onClose={(event) => {
        if (active && !event.currentTarget.open) closeModal();
      }}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        backdropPress.current =
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom);
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;
        if (
          backdropPress.current &&
          event.target === event.currentTarget &&
          outside
        )
          closeModal();
        backdropPress.current = false;
      }}
    >
      <div className="dialog-inner">{children}</div>
    </dialog>
  );
}

function DialogTop({
  children,
  closeLabel,
}: {
  children: ReactNode;
  closeLabel: string;
}) {
  const { closeModal } = useExperience();
  return (
    <div className="dialog-top flex justify-between items-center">
      <span className="eyebrow">{children}</span>
      <button
        type="button"
        className="icon-button"
        data-close-dialog=""
        aria-label={closeLabel}
        onClick={closeModal}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}

function PublisherForm() {
  const { addListing } = useExperience();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const urlRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = nameRef.current;
    const url = urlRef.current;
    const description = descriptionRef.current;
    if (!name || !url || !description) return;
    name.setCustomValidity(
      name.value.trim() ? "" : "Please add a publication name.",
    );
    description.setCustomValidity(
      description.value.trim() ? "" : "Please describe your audience.",
    );
    url.setCustomValidity(
      isHttpUrl(url.value)
        ? ""
        : "Please enter a full HTTP or HTTPS website address.",
    );
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const category = String(data.get("category"));
    const price = Number(data.get("price"));
    if (
      !isCategory(category) ||
      !Number.isSafeInteger(price) ||
      price < 1 ||
      price > 100000000
    )
      return;
    addListing({
      name: name.value.trim(),
      description: description.value.trim(),
      websiteUrl: url.value.trim(),
      category,
      price,
    });
    form.reset();
  }

  return (
    <form id="publisher-form" onSubmit={submit}>
      <label htmlFor="site-name">Publication name</label>
      <input
        ref={nameRef}
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
        ref={urlRef}
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
        ref={descriptionRef}
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
      <div className="form-disclaimer">
        <Icon name="asterisk" small />
        <span>No wallet needed. No data is sent to a server.</span>
      </div>
      <button className="button button-ink w-full" type="submit">
        Create my listing preview <Icon name="arrow-up" />
      </button>
    </form>
  );
}

function BookingSummary({
  listing,
  days,
}: {
  listing: Listing;
  days: number | null;
}) {
  return (
    <div className="booking-summary">
      <div>
        <span>Placement</span>
        <span>Website banner</span>
      </div>
      <div>
        <span>Publisher</span>
        <span>{listing.name}</span>
      </div>
      <div>
        <span>Daily rate</span>
        <span>{formatSats(listing.price)} sats</span>
      </div>
      <div>
        <span>Duration</span>
        <span>
          {days === null ? "—" : `${days} ${days === 1 ? "day" : "days"}`}
        </span>
      </div>
      <div className="total">
        <span>Total</span>
        <span>
          {days === null ? "—" : `${formatSats(listing.price * days)} sats`}
        </span>
      </div>
    </div>
  );
}
function BookingProgress({ step }: { step: number }) {
  return (
    <div className="booking-steps" aria-label="Demo booking progress">
      {["01 / DETAILS", "02 / APPROVAL", "03 / PAYMENT"].map((label, index) => (
        <span
          key={label}
          className={step >= index ? "active" : ""}
          aria-current={step === index ? "step" : undefined}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
function Booking({ listing }: { listing: Listing }) {
  const { closeModal, removeListing } = useExperience();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [daysInput, setDaysInput] = useState("1");
  const days = Number(daysInput);
  const validDays =
    daysInput.trim() !== "" &&
    Number.isInteger(days) &&
    days >= 1 &&
    days <= 30;
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const dialog = contentRef.current?.closest("dialog");
    if (dialog) dialog.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  return (
    <div id="placement-content" ref={contentRef}>
      {step === 0 ? (
        <>
          <span className="dialog-tag">
            {listing.local ? "LOCAL PREVIEW" : "SAMPLE PLACEMENT"} ·{" "}
            {listing.category.toUpperCase()}
          </span>
          <h2 id="placement-title" tabIndex={-1} ref={headingRef}>
            {listing.name}
          </h2>
          <p className="dialog-lead">
            {listing.description}
            <br />
            <br />
            <strong>The audience:</strong>{" "}
            {listing.audience || listing.description}
          </p>
          <BookingProgress step={0} />
          <form
            id="booking-details-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (validDays && event.currentTarget.reportValidity()) setStep(1);
            }}
          >
            <label htmlFor="booking-days">
              How many days? <span className="muted">(1–30)</span>
            </label>
            <input
              className="w-full"
              id="booking-days"
              type="number"
              min={1}
              max={30}
              step={1}
              required
              value={daysInput}
              onChange={(event) => setDaysInput(event.currentTarget.value)}
            />
            <div id="booking-summary" aria-live="polite" aria-atomic="true">
              <BookingSummary
                listing={listing}
                days={validDays ? days : null}
              />
            </div>
            <p className="booking-warning">
              This is a simulated booking. No dates are reserved, no publisher
              is contacted, and no money changes hands.
            </p>
            <button className="button button-ink w-full" type="submit">
              Preview booking request <Icon name="arrow-up" />
            </button>
          </form>
          {listing.local && (
            <button
              type="button"
              className="remove-preview"
              id="remove-local-listing"
              onClick={() => removeListing(listing.id)}
            >
              Remove this local preview
            </button>
          )}
        </>
      ) : step === 1 ? (
        <>
          <span className="dialog-tag">
            INTERACTIVE DEMO · PUBLISHER REVIEW
          </span>
          <h2 id="placement-title" tabIndex={-1} ref={headingRef}>
            A little human <em>approval.</em>
          </h2>
          <p className="dialog-lead">
            In the real product, {listing.name} would review your banner,
            destination, and dates before agreeing to a sponsorship.
          </p>
          <BookingProgress step={1} />
          <BookingSummary listing={listing} days={days} />
          <p className="booking-warning">
            The publisher stays in control. For this demo, you can simulate
            their approval. No request has actually been sent.
          </p>
          <div className="booking-actions">
            <button
              type="button"
              className="button button-outline"
              data-booking-back=""
              onClick={() => setStep(0)}
            >
              Back
            </button>
            <button
              type="button"
              className="button button-ink"
              data-booking-next=""
              onClick={() => setStep(2)}
            >
              Simulate publisher approval <Icon name="arrow-right" />
            </button>
          </div>
        </>
      ) : step === 2 ? (
        <>
          <span className="dialog-tag">
            INTERACTIVE DEMO · LIGHTNING CHECKOUT
          </span>
          <h2 id="placement-title" tabIndex={-1} ref={headingRef}>
            The shortest <em>route.</em>
          </h2>
          <p className="dialog-lead">
            An advertiser. A publisher. A direct payment.
          </p>
          <BookingProgress step={2} />
          <div className="checkout-art">
            <Icon name="bolt" />
            <strong>{formatSats(listing.price * days)}</strong>
            <span>
              SATOSHIS · {days} {days === 1 ? "DAY" : "DAYS"}
            </span>
            <p>Paid directly to {listing.name}</p>
          </div>
          <p className="booking-warning">
            No invoice is generated and no wallet is connected. Direct payment
            is not escrow; a real upfront payment would carry non-delivery risk.
          </p>
          <div className="booking-actions">
            <button
              type="button"
              className="button button-outline"
              data-booking-back=""
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              className="button button-ink"
              data-booking-next=""
              onClick={() => setStep(3)}
            >
              Simulate payment <Icon name="arrow-right" />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="success-icon">
            <Icon name="check" />
          </div>
          <span className="dialog-tag">DEMO COMPLETE · NO MONEY MOVED</span>
          <h2 id="placement-title" tabIndex={-1} ref={headingRef}>
            That’s the <em>idea.</em>
          </h2>
          <p className="dialog-lead">
            {listing.name}. A {days}-day sponsorship. A direct connection.
            <br />
            <br />
            In a completed product, confirmed payment would activate the
            approved banner for the agreed dates. This demo ends here.
          </p>
          <BookingSummary listing={listing} days={days} />
          <button
            type="button"
            className="button button-ink w-full"
            data-close-dialog=""
            onClick={closeModal}
          >
            Explore another space <Icon name="arrow-up" />
          </button>
        </>
      )}
    </div>
  );
}

/** ExperienceProvider renders this exactly once; parents need no modal markup. */
export function DialogLayer() {
  const { modal, listings, closeModal } = useExperience();
  const selected =
    modal?.kind === "placement"
      ? listings.find((listing) => listing.id === modal.listingId)
      : undefined;
  return (
    <>
      <NativeDialog
        id="publisher-dialog"
        labelledBy="publisher-title"
        active={modal?.kind === "publisher"}
      >
        <DialogTop closeLabel="Close listing form">
          YOUR CORNER OF THE INTERNET
        </DialogTop>
        <h2 id="publisher-title">
          Make a little <em>room.</em>
        </h2>
        <p className="dialog-lead">
          Try creating a listing. This preview stays in this browser session—it
          isn’t published or connected to Nostr.
        </p>
        <PublisherForm />
      </NativeDialog>
      <NativeDialog
        id="placement-dialog"
        labelledBy="placement-title"
        active={modal?.kind === "placement" && !!selected}
      >
        <DialogTop closeLabel="Close placement details">
          EXPLORE A PLACEMENT
        </DialogTop>
        {selected ? (
          <Booking key={selected.id} listing={selected} />
        ) : (
          <div id="placement-content" />
        )}
      </NativeDialog>
      <NativeDialog
        id="about-dialog"
        labelledBy="about-title"
        active={modal?.kind === "about"}
      >
        <DialogTop closeLabel="Close project notes">
          THE SMALL PRINT, IN NORMAL SIZE
        </DialogTop>
        <h2 id="about-title">
          A starting <em>point.</em>
        </h2>
        <p className="dialog-lead">
          SatSlots is a proposed open-source sponsorship marketplace for the
          BOSS Battle 2026 Freedom Stack track. It is not an official Bitshala
          product or an endorsed entry.
        </p>
        <div className="project-note">
          <h3>What works here</h3>
          <p>
            Placement filters, listing details, price calculations, a simulated
            booking journey, and local listing previews.
          </p>
          <h3>What still needs building</h3>
          <p>
            Nostr identity and relay publishing, website ownership checks,
            publisher approval, Lightning invoice settlement, banner delivery,
            and dispute handling.
          </p>
          <h3>Privacy in this demo</h3>
          <p>
            No analytics or advertising trackers are included. Form inputs stay
            in memory and disappear on reload. Fonts and styles are bundled
            locally.
          </p>
        </div>
        <button
          type="button"
          className="button button-ink w-full"
          data-close-dialog=""
          onClick={closeModal}
        >
          Back to the good stuff <Icon name="arrow-right" />
        </button>
      </NativeDialog>
    </>
  );
}
