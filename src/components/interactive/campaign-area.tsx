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
  return (
    <>
      <h2 id="campaigns-title">
        Your next <em>campaign.</em>
      </h2>
      <p className="dialog-lead">
        A local planning workspace, not a campaign dashboard. No saved campaigns
        are loaded. Prepare a creative and inspect the planned delivery and
        reporting surfaces.
      </p>
      <CampaignEditor />
      <AdDeliveryPreview />
      <CampaignAnalytics />
    </>
  );
}
