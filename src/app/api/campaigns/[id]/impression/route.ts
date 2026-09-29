import { ok, route } from "@/lib/api/handler";
import { jsonError } from "@/lib/auth/http";
import { getDeliverableCampaign } from "@/lib/campaigns";
import { Campaign } from "@/lib/mongodb/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return route(async () => {
    const { id } = await params;
    const campaign = await getDeliverableCampaign(id);
    if (!campaign) return jsonError("Campaign is not deliverable.", 404);
    await Campaign.updateOne({ id }, { $inc: { impressions: 1 } });
    return ok({ recorded: true });
  });
}
