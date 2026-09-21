import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookingActions } from "@/components/interactive/booking-actions";
import { getSession } from "@/lib/auth/session";
import { getMongo } from "@/lib/mongodb/client";
import {
  getListingsByPubkey,
  getBookingById,
  getListingById,
} from "@/lib/mongodb/queries";
import { Booking, Listing, Profile } from "@/lib/mongodb/schemas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard — SatSlots",
  description: "Manage the rooms you own and the slots you have booked.",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting for the room owner",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  completed: "Completed",
};

function Status({ status }: { status: string }) {
  return (
    <span className={`status-pill status-${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function shortKey(pubkey: string): string {
  return `${pubkey.slice(0, 12)}…`;
}

function daysBetween(startsOn: string, endsOn: string): number {
  const start = Date.parse(`${startsOn}T00:00:00Z`);
  const end = Date.parse(`${endsOn}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

function Receipt({ booking, room }: { booking: any; room: any }) {
  const days = daysBetween(
    booking.starts_on instanceof Date
      ? booking.starts_on.toISOString().slice(0, 10)
      : booking.starts_on,
    booking.ends_on instanceof Date
      ? booking.ends_on.toISOString().slice(0, 10)
      : booking.ends_on,
  );

  return (
    <div className="booking-summary">
      <div>
        <span>Room</span>
        <span>{room?.title ?? "Unknown"}</span>
      </div>
      <div>
        <span>Corner</span>
        <span>{room?.category ?? ""}</span>
      </div>
      <div>
        <span>Dates</span>
        <span>
          {(booking.starts_on instanceof Date
            ? booking.starts_on.toISOString().slice(0, 10)
            : booking.starts_on)}{" "}
          →{" "}
          {(booking.ends_on instanceof Date
            ? booking.ends_on.toISOString().slice(0, 10)
            : booking.ends_on)}
        </span>
      </div>
      <div>
        <span>Ad length</span>
        <span>
          {days} {days === 1 ? "day" : "days"}
        </span>
      </div>
      <div>
        <span>Daily price</span>
        <span>{(room?.price_sats ?? 0).toLocaleString()} sats</span>
      </div>
      <div>
        <span>Total</span>
        <span>{(days * (room?.price_sats ?? 0)).toLocaleString()} sats</span>
      </div>
      <div>
        <span>Status</span>
        <span>
          <Status status={booking.status} />
        </span>
      </div>
      <div>
        <span>Reference</span>
        <span className="mono">{booking.id}</span>
      </div>
    </div>
  );
}

function CreativeBox({ booking }: { booking: any }) {
  return (
    <div className="creative-box">
      {booking.image_url ? (
        <img
          src={booking.image_url}
          alt={`Creative for ${booking.ad_id}`}
          className="creative-image"
        />
      ) : (
        <div className="creative-placeholder">
          <span className="creative-ad-id">{booking.ad_id}</span>
          <span className="creative-pubkey mono">
            {shortKey(booking.advertiser_pubkey)}
          </span>
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="marketplace-status">{children}</p>;
}

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/");

  let myRooms: any[] = [];
  let incomingBookings: any[] = [];
  let myBookings: any[] = [];

  try {
    await getMongo();

    myRooms = await getListingsByPubkey(user.pubkey);

    // Get bookings where user is the advertiser
    const myBookingDocs = await Booking.find({
      advertiser_pubkey: user.pubkey,
    }).sort({ starts_on: -1 });

    // Get bookings on user's rooms
    const myListingIds = myRooms.map((r) => r.id);
    const incomingDocs =
      myListingIds.length > 0
        ? await Booking.find({ listing_id: { $in: myListingIds } }).sort({
            starts_on: -1,
          })
        : [];

    // Enrich with room data
    const enrichBooking = async (b: any) => {
      const listing = await getListingById(b.listing_id);
      const publisherProfile = listing
        ? await Profile.findOne({ pubkey: listing.pubkey })
        : null;
      return { booking: b, listing, publisherProfile };
    };

    const enrichedIncoming = await Promise.all(incomingDocs.map(enrichBooking));
    const enrichedMine = await Promise.all(myBookingDocs.map(enrichBooking));

    incomingBookings = enrichedIncoming;
    myBookings = enrichedMine;
  } catch (error) {
    console.error("dashboard query failed:", error);
    return (
      <main className="site-shell dashboard">
        <h1>Dashboard</h1>
        <p role="alert" className="form-error">
          The database could not be reached, so nothing can be shown right now.
          Try again in a moment.
        </p>
      </main>
    );
  }

  return (
    <main className="site-shell dashboard">
      <h1>Dashboard</h1>
      <p className="dialog-lead">
        Signed in as <strong>{user.username}</strong>.
      </p>

      <section className="feature-section" aria-labelledby="rooms-heading">
        <h2 id="rooms-heading">Rooms you own</h2>
        {myRooms.length === 0 ? (
          <Empty>
            You have not created a room yet. Use "List your space" in the header
            to add one.
          </Empty>
        ) : (
          <ul className="dashboard-list">
            {myRooms.map((room) => (
              <li key={room.id} className="dashboard-card">
                <h3>{room.title}</h3>
                <p className="mono">
                  {room.category} ·{" "}
                  {room.price_sats.toLocaleString()} sats/day ·{" "}
                  {room.ad_duration_days} days · up to {room.max_ads}{" "}
                  {room.max_ads === 1 ? "ad" : "ads"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="feature-section" aria-labelledby="incoming-heading">
        <h2 id="incoming-heading">Bookings on your rooms</h2>
        {incomingBookings.length === 0 ? (
          <Empty>Nobody has booked your rooms yet.</Empty>
        ) : (
          <ul className="dashboard-list">
            {incomingBookings.map(({ booking, listing }: any) => (
              <li key={booking.id} className="dashboard-card">
                <div className="booking-card-layout">
                  <CreativeBox booking={booking} />
                  <div className="booking-card-details">
                    <h3>
                      {booking.ad_id} <Status status={booking.status} />
                    </h3>
                    <p className="mono">
                      advertiser {shortKey(booking.advertiser_pubkey)}
                    </p>
                    {booking.website_url && (
                      <p>
                        <a
                          href={booking.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-link"
                        >
                          Visit website
                        </a>
                      </p>
                    )}
                    <Receipt booking={booking} room={listing} />
                    <BookingActions
                      id={booking.id}
                      role="publisher"
                      status={booking.status}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="feature-section" aria-labelledby="booked-heading">
        <h2 id="booked-heading">Slots you have booked</h2>
        {myBookings.length === 0 ? (
          <Empty>You have not booked a slot yet.</Empty>
        ) : (
          <ul className="dashboard-list">
            {myBookings.map(({ booking, listing, publisherProfile }: any) => (
              <li key={booking.id} className="dashboard-card">
                <div className="booking-card-layout">
                  <CreativeBox booking={booking} />
                  <div className="booking-card-details">
                    <h3>
                      {listing?.title ?? "Unknown"}{" "}
                      <Status status={booking.status} />
                    </h3>
                    <p className="mono">
                      published by{" "}
                      {publisherProfile?.username ??
                        shortKey(listing?.pubkey ?? "")}{" "}
                      · ad id {booking.ad_id}
                    </p>
                    {booking.website_url && (
                      <p>
                        <a
                          href={booking.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-link"
                        >
                          Visit website
                        </a>
                      </p>
                    )}
                    <Receipt booking={booking} room={listing} />
                    <BookingActions
                      id={booking.id}
                      role="advertiser"
                      status={booking.status}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
