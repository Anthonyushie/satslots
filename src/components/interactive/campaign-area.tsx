"use client";

import type { ReactNode } from "react";
import { useExperience } from "./experience-context";
import { CampaignEditor } from "./campaign-editor";
import { CampaignAnalytics } from "./campaign-analytics";
import { AdDeliveryPreview } from "./ad-creative";

export function CampaignAreaButton({
  children = "Campaigns ↗",
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const { openModal } = useExperience();
  return (
    <button
      type="button"
      className={className}
      onClick={(event) => openModal({ kind: "campaigns" }, event.currentTarget)}
    >
      {children}
    </button>
  );
}

export function CampaignArea() {
  const { modal, user } = useExperience();
  const bookingId = modal?.kind === "campaigns" ? modal.bookingId : undefined;
  return (
    <>
      <h2 id="campaigns-title">
        Your next <em>campaign.</em>
      </h2>
      <p className="dialog-lead">
        {user
          ? "Create a campaign for a paid placement, activate its iframe, and inspect live delivery totals."
          : "Preview a creative locally. Sign in and complete a paid booking to save and activate it."}
      </p>
      <CampaignEditor initialBookingId={bookingId} />
      {!user && <AdDeliveryPreview />}
      {!user && <CampaignAnalytics />}
    </>
  );
}
