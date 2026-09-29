import { getDeliverableCampaign } from "@/lib/campaigns";
import { Campaign } from "@/lib/mongodb/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const fallback = new URL("/", request.url);
  try {
    const { id } = await params;
    const campaign = await getDeliverableCampaign(id);
    if (!campaign) return Response.redirect(fallback, 303);
    await Campaign.updateOne({ id }, { $inc: { clicks: 1 } });
    return Response.redirect(campaign.website_url, 303);
  } catch (error) {
    console.error("campaign click failed:", error);
    return Response.redirect(fallback, 303);
  }
}
