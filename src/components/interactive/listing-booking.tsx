"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatSats } from "@/lib/marketplace";
import { useExperience } from "./experience-context";

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
  expiresAt: string;
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
}: {
  listingId: string;
  priceSats: number;
  adDurationDays: number;
}) {
  const router = useRouter();
  const { user, openModal } = useExperience();
  const [startsOn, setStartsOn] = useState("");
  const [adName, setAdName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const startRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (startRef.current) {
      startRef.current.min = new Date().toISOString().slice(0, 10);
    }
  }, []);

  const endsOn = startsOn ? addDays(startsOn, adDurationDays - 1) : null;
  const quotedTotal = startsOn ? adDurationDays * priceSats : null;

  useEffect(() => {
    if (!booking || paymentStatus === "settled") return;
    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((Date.parse(booking.expiresAt) - Date.now()) / 1000),
      );
      setRemainingSeconds(remaining);
      if (remaining === 0) setPaymentStatus("failed");
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [booking, paymentStatus]);

  // Poll for payment status after booking is created.
  useEffect(() => {
    if (!booking || paymentStatus === "settled" || paymentStatus === "failed")
      return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/payments/by-hash/${booking.paymentHash}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.status === "settled" || data.status === "failed") {
            setPaymentStatus(data.status);
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

    if (!user) {
      setError("Sign in with Nostr before booking this placement.");
      openModal({ kind: "auth", authMode: "login" });
      return;
    }

    setBusy(true);
    setError(null);
    setBooking(null);
    setPaymentStatus(null);

    try {
      const bookingResponse = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listingId,
          startsOn,
          adId: adName.trim() || crypto.randomUUID(),
        }),
      });
      const bookingData = (await bookingResponse.json().catch(() => ({}))) as {
        error?: unknown;
        booking?: { id?: string; startsOn?: string; endsOn?: string };
      };
      if (!bookingResponse.ok || !bookingData.booking?.id) {
        setError(
          typeof bookingData.error === "string"
            ? bookingData.error
            : "Could not create booking.",
        );
        return;
      }
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: bookingData.booking.id }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: unknown;
        paymentId?: string;
        invoice?: string;
        paymentHash?: string;
        amountSats?: number;
        expiresAt?: string;
      };

      if (!response.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Could not create booking.",
        );
        return;
      }

      if (data.invoice) {
        setBooking({
          bookingId: bookingData.booking.id,
          invoice: data.invoice,
          paymentHash: data.paymentHash ?? "",
          amountSats: data.amountSats ?? quotedTotal ?? 0,
          days: adDurationDays,
          roomTitle: "",
          startsOn: bookingData.booking.startsOn ?? startsOn,
          endsOn: bookingData.booking.endsOn ?? endsOn ?? "",
          expiresAt:
            data.expiresAt ?? new Date(Date.now() + 3_600_000).toISOString(),
        });
        setPaymentStatus("invoiced");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function retryInvoice() {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: booking.bookingId }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not create another invoice.");
      setBooking({
        ...booking,
        invoice: data.invoice,
        paymentHash: data.paymentHash,
        amountSats: data.amountSats,
        expiresAt: data.expiresAt,
      });
      setPaymentStatus("invoiced");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create another invoice.",
      );
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
        {adDurationDays === 1 ? "day" : "days"} from there — that length is set
        by the publisher.
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

          <label htmlFor="booking-ad-name">Ad name</label>
          <input
            className="w-full"
            id="booking-ad-name"
            type="text"
            placeholder="My Product"
            required
            value={adName}
            onChange={(event) => setAdName(event.target.value)}
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
            disabled={busy || !startsOn || !adName.trim()}
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
            {paymentStatus === "settled" ? "Payment received!" : "Scan to pay"}
          </h3>

          {paymentStatus !== "settled" && paymentStatus !== "failed" && (
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
              <div>
                <span>Invoice expires</span>
                <span>
                  {Math.floor(remainingSeconds / 60)}:
                  {String(remainingSeconds % 60).padStart(2, "0")}
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
            <>
              <p>
                Your payment has been confirmed. Build and activate the creative
                for this placement.
              </p>
              <button
                type="button"
                className="button button-ink w-full"
                onClick={(event) =>
                  openModal(
                    { kind: "campaigns", bookingId: booking.bookingId },
                    event.currentTarget,
                  )
                }
              >
                Create campaign
              </button>
            </>
          )}
          {paymentStatus === "failed" && (
            <>
              <p role="alert" className="form-error">
                This invoice expired before payment was confirmed.
              </p>
              <button
                type="button"
                className="button button-ink w-full"
                disabled={busy}
                onClick={() => void retryInvoice()}
              >
                {busy ? "Creating invoice…" : "Create a new invoice"}
              </button>
            </>
          )}
        </div>
      )}

      {!booking && (
        <p className="booking-warning">
          Sign in with Nostr, reserve the dates, then pay with Lightning to
          confirm your booking.
        </p>
      )}
    </section>
  );
}
