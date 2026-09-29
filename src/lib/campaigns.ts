import "server-only";
import { getMongo } from "@/lib/mongodb/client";
import { Booking, Campaign, Payment } from "@/lib/mongodb/schemas";

/** Returns a campaign only while its paid, approved booking is in its run window. */
export async function getDeliverableCampaign(id: string) {
  await getMongo();
  const campaign = await Campaign.findOne({ id, status: "active" });
  if (!campaign) return null;
  const booking = await Booking.findOne({
    id: campaign.booking_id,
    status: "approved",
  });
  if (!booking) return null;
  const paid = await Payment.exists({
    booking_id: booking.id,
    status: "settled",
  });
  if (!paid) return null;
  const today = new Date().toISOString().slice(0, 10);
  const startsOn = booking.starts_on.toISOString().slice(0, 10);
  const endsOn = booking.ends_on.toISOString().slice(0, 10);
  if (today < startsOn || today > endsOn) return null;
  return campaign;
}
