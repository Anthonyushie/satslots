"use client";

import { useState } from "react";
import type { BookingFormValues } from "@/lib/frontend-forms";
import { LightningCheckout } from "./lightning-checkout";
import { CampaignAreaButton } from "./campaign-area";

export function BookingForm() {
  const [values, setValues] = useState<BookingFormValues>({
    startDate: "",
    endDate: "",
  });
  const [reviewed, setReviewed] = useState(false);
  return (
    <div className="feature-section">
      <h3>Plan a booking</h3>
      <p className="dialog-lead" id="booking-dates-note">
        Prepare requested dates only. Availability, date inclusivity, and the
        publisher’s timezone are not connected. No price quote or reservation is
        generated. These inputs are discarded when you leave this placement.
      </p>
      <form
        aria-label="Booking dates"
        aria-describedby="booking-dates-note"
        onSubmit={(event) => {
          event.preventDefault();
          setReviewed(true);
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="booking-start">Requested start date</label>
            <input
              id="booking-start"
              type="date"
              required
              value={values.startDate}
              onChange={(event) => {
                setValues({ ...values, startDate: event.target.value });
                setReviewed(false);
              }}
            />
          </div>
          <div>
            <label htmlFor="booking-end">Requested end date</label>
            <input
              id="booking-end"
              type="date"
              required
              min={values.startDate || undefined}
              value={values.endDate}
              onChange={(event) => {
                setValues({ ...values, endDate: event.target.value });
                setReviewed(false);
              }}
            />
          </div>
        </div>
        <button type="submit" className="text-link feature-action">
          Review requested dates
        </button>
        {reviewed && (
          <p role="status" className="booking-warning">
            Requested dates: {values.startDate} to {values.endDate}. Not
            reserved or saved.
          </p>
        )}
      </form>
      <LightningCheckout />
      <CampaignAreaButton className="text-link feature-action">
        Prepare campaign creative ↗
      </CampaignAreaButton>
      <p className="dialog-lead">
        The campaign workspace is separate; these dates are not transferred or
        booked.
      </p>
    </div>
  );
}
