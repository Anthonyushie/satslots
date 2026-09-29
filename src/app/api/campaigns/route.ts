import crypto from "crypto";
import { ok, readJson, requireUser, route } from "@/lib/api/handler";
import { campaignSaveSchema } from "@/lib/api/schemas";
import { isSameOrigin, jsonError } from "@/lib/auth/http";
import { getMongo } from "@/lib/mongodb/client";
import { Booking, Campaign, Listing, Payment } from "@/lib/mongodb/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeCampaign(campaign: InstanceType<typeof Campaign>) {
  return {
    id: campaign.id,
    bookingId: campaign.booking_id,
    name: campaign.name,
    headline: campaign.headline,
    description: campaign.description ?? "",
    destinationUrl: campaign.website_url,
    imageUrl: campaign.image_url ?? "",
    status: campaign.status,
    impressions: campaign.impressions ?? 0,
    clicks: campaign.clicks ?? 0,
    createdAt: campaign.created_at.toISOString(),
    updatedAt: campaign.updated_at.toISOString(),
  };
}

export async function GET(): Promise<Response> {
  return route(async () => {
    const auth = await requireUser();
    if (!auth.user) return auth.response;
    await getMongo();

    const [campaigns, bookings] = await Promise.all([
      Campaign.find({ advertiser_pubkey: auth.user.pubkey }).sort({
        created_at: -1,
      }),
      Booking.find({ advertiser_pubkey: auth.user.pubkey }).sort({
        created_at: -1,
      }),
    ]);
    const bookingIds = bookings.map((booking) => booking.id);
    const settled = await Payment.find({
      booking_id: { $in: bookingIds },
      status: "settled",
    }).select("booking_id");
    const settledIds = new Set(settled.map((payment) => payment.booking_id));
    const eligible = bookings.filter((booking) => settledIds.has(booking.id));
    const listings = await Listing.find({
      id: { $in: eligible.map((booking) => booking.listing_id) },
    }).select("id title");
    const titles = new Map(
      listings.map((listing) => [listing.id, listing.title]),
    );

    return ok({
      campaigns: campaigns.map(serializeCampaign),
      bookings: eligible.map((booking) => ({
        id: booking.id,
        roomTitle: titles.get(booking.listing_id) ?? "Booked placement",
        startsOn: booking.starts_on.toISOString().slice(0, 10),
        endsOn: booking.ends_on.toISOString().slice(0, 10),
        campaignId: booking.campaign_id ?? null,
      })),
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  return route(async () => {
    if (!isSameOrigin(request))
      return jsonError("Cross-origin request rejected.", 403);
    const auth = await requireUser();
    if (!auth.user) return auth.response;
    const body = await readJson(request, campaignSaveSchema);
    if (!body.data) return body.response;
    await getMongo();

    const booking = await Booking.findOne({
      id: body.data.bookingId,
      advertiser_pubkey: auth.user.pubkey,
    });
    if (!booking) return jsonError("Choose one of your bookings.", 404);
    const paid = await Payment.exists({
      booking_id: booking.id,
      status: "settled",
    });
    if (!paid)
      return jsonError(
        "The booking must be paid before its campaign can be saved.",
        409,
      );

    const existing = body.data.id
      ? await Campaign.findOne({
          id: body.data.id,
          advertiser_pubkey: auth.user.pubkey,
        })
      : await Campaign.findOne({
          booking_id: booking.id,
          advertiser_pubkey: auth.user.pubkey,
        });
    if (body.data.id && !existing) return jsonError("Unknown campaign.", 404);

    const values = {
      booking_id: booking.id,
      advertiser_pubkey: auth.user.pubkey,
      name: body.data.name,
      headline: body.data.headline,
      description: body.data.description || undefined,
      website_url: body.data.destinationUrl,
      image_url: body.data.imageUrl,
      status: body.data.status,
      updated_at: new Date(),
    };
    const campaign = existing
      ? await Campaign.findOneAndUpdate({ id: existing.id }, values, {
          returnDocument: "after",
        })
      : await Campaign.create({
          id: crypto.randomUUID(),
          ...values,
          impressions: 0,
          clicks: 0,
          created_at: new Date(),
        });
    if (!campaign) return jsonError("Campaign could not be saved.", 500);
    booking.campaign_id = campaign.id;
    booking.image_url = campaign.image_url;
    booking.website_url = campaign.website_url;
    booking.updated_at = new Date();
    await booking.save();

    return ok({ campaign: serializeCampaign(campaign) }, existing ? 200 : 201);
  });
}
