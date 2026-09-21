"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatSats } from "@/lib/marketplace";

/** Anonymous booking result from the API. */
interface BookingResult {
  bookingId: string;
  invoice: string;
  paymentHash: string;
  amountSats: number;
  days: number;
  roomTitle: string;
  startsOn: string;
  endsOn: string;
}

/** Adds whole days to a YYYY-MM-DD string in UTC, matching the server's helper. */
function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function ListingBooking({
  listingId,
  priceSats,
  adDurationDays,
  publisherPubkey,
}: {
  listingId: string;
  priceSats: number;
  adDurationDays: number;
  publisherPubkey: string;
}) {
  const router = useRouter();
  const [startsOn, setStartsOn] = useState("");
  const [email, setEmail] = useState("");
  const [adName, setAdName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (startRef.current) {
      startRef.current.min = new Date().toISOString().slice(0, 10);
    }
  }, []);

  const endsOn = startsOn ? addDays(startsOn, adDurationDays - 1) : null;
  const quotedTotal = startsOn ? adDurationDays * priceSats : null;

  // Poll for payment status after booking is created.
  useEffect(() => {
    if (!booking || paymentStatus === "settled") return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/payments/by-hash/${booking.paymentHash}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.status === "settled") {
            setPaymentStatus("settled");
            clearInterval(interval);
            startTransition(() => router.refresh());
          }
        }
      } catch {
        // Ignore polling errors — will retry.
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [booking, paymentStatus, router, startTransition]);

  async function bookAndPay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);
    setError(null);
    setBooking(null);
    setPaymentStatus(null);

    try {
      const response = await fetch("/api/bookings/anonymous", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listingId,
          startsOn,
          contactEmail: email,
          adName: adName || undefined,
          imageUrl: imageUrl || undefined,
          websiteUrl: websiteUrl || undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: unknown;
        bookingId?: string;
        invoice?: string;
        paymentHash?: string;
        amountSats?: number;
        days?: number;
        roomTitle?: string;
        startsOn?: string;
        endsOn?: string;
      };

      if (!response.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Could not create booking.",
        );
        return;
      }

      if (data.bookingId && data.invoice) {
        setBooking({
          bookingId: data.bookingId,
          invoice: data.invoice,
          paymentHash: data.paymentHash ?? "",
          amountSats: data.amountSats ?? (quotedTotal ?? 0),
          days: data.days ?? adDurationDays,
          roomTitle: data.roomTitle ?? "",
          startsOn: data.startsOn ?? startsOn,
          endsOn: data.endsOn ?? (endsOn ?? ""),
        });
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function copyInvoice() {
    if (booking?.invoice) {
      navigator.clipboard.writeText(booking.invoice);
    }
  }

  return (
    <section className="feature-section" aria-labelledby="booking-heading">
      <h2 id="booking-heading">Book a slot</h2>
      <p className="dialog-lead">
        Pick a start date. The ad runs for {adDurationDays}{" "}
        {adDurationDays === 1 ? "day" : "days"} from there — that length is set by
        the publisher.
      </p>

      {!booking && (
        <form aria-label="Book this room" onSubmit={bookAndPay}>
          <label htmlFor="booking-start">Start date</label>
          <input
            className="w-full"
            id="booking-start"
            ref={startRef}
            type="date"
            required
            value={startsOn}
            onChange={(event) => {
              setStartsOn(event.target.value);
              setError(null);
            }}
          />

          <label htmlFor="booking-email">Your email</label>
          <input
            className="w-full"
            id="booking-email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="booking-ad-name">Ad name (optional)</label>
          <input
            className="w-full"
            id="booking-ad-name"
            type="text"
            placeholder="My Product"
            value={adName}
            onChange={(event) => setAdName(event.target.value)}
          />

          <label htmlFor="booking-image-url">Banner image URL (optional)</label>
          <input
            className="w-full"
            id="booking-image-url"
            type="url"
            placeholder="https://example.com/banner.png"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
          />

          <label htmlFor="booking-website-url">Website URL (optional)</label>
          <input
            className="w-full"
            id="booking-website-url"
            type="url"
            placeholder="https://example.com"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
          />

          {startsOn && endsOn && quotedTotal !== null && (
            <div className="booking-summary" aria-live="polite">
              <div>
                <span>Runs</span>
                <span>
                  {startsOn} → {endsOn}
                </span>
              </div>
              <div>
                <span>Ad length</span>
                <span>
                  {adDurationDays} {adDurationDays === 1 ? "day" : "days"}
                </span>
              </div>
              <div>
                <span>Daily price</span>
                <span>{formatSats(priceSats)} sats</span>
              </div>
              <div>
                <span>Total</span>
                <span>{formatSats(quotedTotal)} sats</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="button button-ink w-full"
            disabled={busy || !startsOn || !email}
          >
            {busy ? "Creating invoice…" : "Book & Pay with Lightning"}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {booking && (
        <div className="booking-summary" role="status">
          <h3>
            {paymentStatus === "settled"
              ? "Payment received!"
              : "Scan to pay"}
          </h3>

          {paymentStatus !== "settled" && (
            <>
              <div className="qr-container">
                <QRCodeSVG
                  value={booking.invoice}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>

              <div>
                <span>Amount</span>
                <span>{formatSats(booking.amountSats)} sats</span>
              </div>
              <div>
                <span>Runs</span>
                <span>
                  {booking.startsOn} → {booking.endsOn}
                </span>
              </div>

              <div className="invoice-box">
                <label>Invoice (BOLT11)</label>
                <textarea
                  readOnly
                  value={booking.invoice}
                  rows={3}
                  className="w-full mono text-xs"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <button
                  type="button"
                  className="button button-secondary w-full"
                  onClick={copyInvoice}
                >
                  Copy invoice
                </button>
              </div>

              <p className="text-xs opacity-60 mt-2">
                Scan the QR code or copy the invoice to pay with your Lightning
                wallet. This page will update automatically once payment is
                confirmed.
              </p>
            </>
          )}

          {paymentStatus === "settled" && (
            <p>
              Your payment has been confirmed! The room owner will see your
              booking on their dashboard.
            </p>
          )}
        </div>
      )}

      {!booking && (
        <p className="booking-warning">
          No login required. Enter your details above, then pay with Lightning
          to confirm your booking.
        </p>
      )}
    </section>
  );
}
