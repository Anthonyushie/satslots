"use client";

import { useEffect } from "react";

export function EmbedImpression({ campaignId }: { campaignId: string }) {
  useEffect(() => {
    void fetch(`/api/campaigns/${campaignId}/impression`, {
      method: "POST",
      keepalive: true,
    });
  }, [campaignId]);
  return null;
}
