import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ExperienceProvider } from "@/components/interactive/experience-provider";
import { ListingBooking } from "@/components/interactive/listing-booking";
import { ListingThread } from "@/components/interactive/listing-thread";
import { getSession } from "@/lib/auth/session";
import { formatSats } from "@/lib/marketplace";
import { parseListingAddress } from "@/lib/nostr";
import { getMongo } from "@/lib/mongodb/client";
import {
  getListingByAddress,
  getListingComments,
  getBookingsWithAdvertiser,
} from "@/lib/mongodb/queries";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ address: string }> };

function decodeAddress(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const loadRoom = cache(async (address: string) => {
  await getMongo();
  return await getListingByAddress(address);
});

function shortKey(pubkey: string): string {
  return `${pubkey.slice(0, 12)}…`;
}

export async function generateMetadata({
  params,
}: Context): Promise<Metadata> {
  const { address } = await params;
  const parsed = parseListingAddress(decodeAddress(address));
  if (!parsed) return { title: "Listing not found — SatSlots" };

  const room = await loadRoom(decodeAddress(address)).catch(() => null);
  if (!room) return { title: "Listing not found — SatSlots" };

  const description =
    room.description ??
    room.audience ??
    `A website banner placement at ${formatSats(room.price_sats)} sats per day.`;

  return {
    title: `${room.title} — SatSlots`,
    description,
    openGraph: {
      title: room.title,
      description,
      type: "website",
      siteName: "SatSlots",
    },
  };
}

export default async function ListingPage({ params }: Context) {
  const { address: raw } = await params;
  const address = decodeAddress(raw);

  if (!parseListingAddress(address)) notFound();

  let room: any;
  let comments: any[];
  let approvedBookings: any[];
  try {
    await getMongo();
    room = await getListingByAddress(address);

    if (room) {
      [comments, approvedBookings] = await Promise.all([
        getListingComments(room.id),
        getBookingsWithAdvertiser(room.id),
      ]);
    } else {
      comments = [];
      approvedBookings = [];
    }
  } catch (error) {
    return (
      <main className="site-shell">
        <h1>Listing</h1>
        <p role="alert" className="form-error">
          The database could not be reached, so this listing cannot be shown
          right now. Try again in a moment.
        </p>
        <Link className="text-link" href="/">
          Back to the marketplace
        </Link>
      </main>
    );
  }

  if (!room) notFound();

  const viewer = await getSession();

  return (
    <ExperienceProvider>
      <main className="site-shell section-space">
        <p className="eyebrow section-label">
          <Link className="text-link" href="/">
            ← Marketplace
          </Link>
        </p>

        <div className="listing-split-layout">
          {/* Left side: Twitter thread-style ad list (60%) */}
          <div className="listing-ad-feed">
            <div className="section-heading">
              <h2>Advertisement Feed</h2>
              <p className="dialog-lead">
                {approvedBookings.length > 0 
                  ? `Recent approved bookings (${approvedBookings.length})`
                  : 'No approved bookings yet - be the first to advertise!'}
              </p>
            </div>

            <div className="ad-thread">
              {approvedBookings.length > 0 ? (
                approvedBookings.map((booking: any) => (
                  <div key={booking.id} className="ad-thread-card">
                    <div className="ad-thread-header">
                      <div className="ad-thread-avatar">
                        <div className="avatar-placeholder">
                          {booking.advertiser_username?.charAt(0).toUpperCase() || '?'}
                        </div>
                      </div>
                      <div className="ad-thread-meta">
                        <span className="ad-thread-author">
                          {booking.advertiser_username || 'Anonymous'}
                        </span>
                        <span className="ad-thread-time">
                          {new Date(booking.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="ad-thread-content">
                      {booking.website_url && (
                        <p className="ad-thread-text">
                          <a 
                            href={booking.website_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-link"
                          >
                            Visit advertiser website ↗
                          </a>
                        </p>
                      )}
                      {booking.image_url && (
                        <a 
                          href={booking.website_url || '#'} 
                          target={booking.website_url ? '_blank' : '_self'}
                          rel={booking.website_url ? 'noopener noreferrer' : undefined}
                        >
                          <img
                            src={booking.image_url}
                            alt={`Ad by ${booking.advertiser_username || 'Anonymous'}`}
                            className="ad-thread-image"
                          />
                        </a>
                      )}
                      <div className="ad-thread-stats">
                        <span>📅 {new Date(booking.starts_on).toLocaleDateString()}</span>
                        <span>→ {new Date(booking.ends_on).toLocaleDateString()}</span>
                        <span className={`status-${booking.status}`}>
                          {booking.status === 'approved' ? '⏳ Active' : '✅ Completed'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="ad-thread-card">
                  <div className="ad-thread-content">
                    <p className="ad-thread-text" style={{ color: 'var(--muted)' }}>
                      No approved bookings yet. Book this space to see your advertisement here!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side: Listing details and booking (40%) */}
          <div className="listing-details-panel">
            {room.image_url && (
              <div className="listing-banner">
                <img
                  src={room.image_url}
                  alt={room.title}
                  className="w-full h-48 object-cover rounded-lg"
                />
              </div>
            )}

            <div className="section-heading">
              <div>
                <div className="listing-category mono">{room.category}</div>
                <h1>{room.title}</h1>
              </div>
            </div>

            <p className="dialog-lead">{room.description}</p>
            {room.audience && <p className="muted">{room.audience}</p>}

            <div className="booking-summary">
              <div>
                <span>Placement</span>
                <span>Website banner</span>
              </div>
              <div>
                <span>Daily price</span>
                <span>{formatSats(room.price_sats)} sats</span>
              </div>
              <div>
                <span>Ad length</span>
                <span>
                  {room.ad_duration_days}{" "}
                  {room.ad_duration_days === 1 ? "day" : "days"}
                </span>
              </div>
              <div>
                <span>Ads at once</span>
                <span>{room.max_ads}</span>
              </div>
              <div>
                <span>Publisher</span>
                <span>{room.username || shortKey(room.pubkey)}</span>
              </div>
              <div>
                <span>Nostr key</span>
                <span className="mono">{shortKey(room.pubkey)}</span>
              </div>
              {room.website_url && (
                <div>
                  <span>Website</span>
                  <span>
                    <a
                      href={room.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Visit website
                    </a>
                  </span>
                </div>
              )}
            </div>

            {room.published ? (
              <p className="mono muted text-sm">
                ✓ Published to relays
              </p>
            ) : (
              <p className="booking-warning text-sm">
                ⚠ Not yet published to relay
              </p>
            )}

            <div className="booking-section">
              <h3>Book This Space</h3>
              <p className="dialog-lead text-sm">
                Create a Lightning invoice to secure your advertising slot
              </p>
              <ListingBooking
                listingId={room.id}
                priceSats={room.price_sats}
                adDurationDays={room.ad_duration_days}
                publisherPubkey={room.pubkey}
              />
            </div>

            <ListingThread
              listingId={room.id}
              comments={comments.map((c: any) => ({
                id: c.id,
                authorPubkey: c.author_pubkey,
                authorUsername: c.author_username || "",
                body: c.body,
                createdAt: c.created_at instanceof Date ? c.created_at.toISOString() : c.created_at,
              }))}
              publisherPubkey={room.pubkey}
            />

            {!viewer && (
              <p className="form-disclaimer text-sm" role="status">
                Sign in with Nostr to book and post comments
              </p>
            )}
          </div>
        </div>
      </main>
    </ExperienceProvider>
  );
}
