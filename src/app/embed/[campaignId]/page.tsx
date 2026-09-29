import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmbedImpression } from "@/components/interactive/embed-impression";
import { getDeliverableCampaign } from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const campaign = await getDeliverableCampaign(campaignId).catch(() => null);
  if (!campaign) notFound();

  return (
    <main className="embed-canvas">
      <EmbedImpression campaignId={campaign.id} />
      <a
        className="embed-creative"
        href={`/api/campaigns/${campaign.id}/click`}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label={`${campaign.headline} — sponsored`}
      >
        <img src={campaign.image_url} alt="" />
        <span className="embed-copy">
          <span className="eyebrow">SPONSORED</span>
          <strong>{campaign.headline}</strong>
          {campaign.description && <span>{campaign.description}</span>}
        </span>
      </a>
    </main>
  );
}
