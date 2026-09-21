import { getMongo } from "./client";
import { Listing, Booking, Payment, Profile, Session, AuthChallenge, ListingComment } from "./schemas";

/**
 * Check if a listing has overlapping ads for a given date range
 */
export async function listingOverlappingAds(
  listingId: string,
  startsOn: Date,
  endsOn: Date
): Promise<number> {
  await getMongo();
  
  const count = await Booking.countDocuments({
    listing_id: listingId,
    status: { $in: ['approved', 'pending'] },
    $or: [
      { starts_on: { $lte: endsOn }, ends_on: { $gte: startsOn } }
    ]
  });
  
  return count;
}

/**
 * Get listing by ID
 */
export async function getListingById(listingId: string) {
  await getMongo();
  return await Listing.findOne({ id: listingId });
}

/**
 * Get booking by ad_id
 */
export async function getBookingByAdId(adId: string) {
  await getMongo();
  return await Booking.findOne({ ad_id: adId });
}

/**
 * Create a new booking
 */
export async function createBooking(bookingData: any) {
  await getMongo();
  const booking = new Booking(bookingData);
  return await booking.save();
}

/**
 * Create a new payment
 */
export async function createPayment(paymentData: any) {
  await getMongo();
  const payment = new Payment(paymentData);
  return await payment.save();
}

/**
 * Get profile by pubkey
 */
export async function getProfileByPubkey(pubkey: string) {
  await getMongo();
  return await Profile.findOne({ pubkey });
}

/**
 * Create or update profile
 */
export async function upsertProfile(pubkey: string, profileData: any) {
  await getMongo();
  return await Profile.findOneAndUpdate(
    { pubkey },
    { ...profileData, updated_at: new Date() },
    { upsert: true, returnDocument: 'after' }
  );
}

/**
 * Get approved bookings for a listing (for public display)
 */
export async function getApprovedBookings(listingId: string) {
  await getMongo();
  return await Booking.find({
    listing_id: listingId,
    status: { $in: ['approved', 'completed'] }
  }).sort({ created_at: -1 });
}

/**
 * Get all listings with pagination
 */
export async function getListings(limit: number = 100, offset: number = 0) {
  await getMongo();
  return await Listing.find({ published: true })
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(offset);
}

/**
 * Get listings by pubkey
 */
export async function getListingsByPubkey(pubkey: string) {
  await getMongo();
  return await Listing.find({ pubkey }).sort({ created_at: -1 });
}

/**
 * Get booking by ID
 */
export async function getBookingById(bookingId: string) {
  await getMongo();
  return await Booking.findOne({ id: bookingId });
}

/**
 * Update booking status
 */
export async function updateBookingStatus(bookingId: string, status: string) {
  await getMongo();
  return await Booking.findOneAndUpdate(
    { id: bookingId },
    { status, updated_at: new Date() },
    { returnDocument: 'after' }
  );
}

/**
 * Get payment by payment hash
 */
export async function getPaymentByHash(paymentHash: string) {
  await getMongo();
  return await Payment.findOne({ payment_hash: paymentHash });
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(paymentId: string, status: string, settledAt?: Date) {
  await getMongo();
  const updateData: any = { status, updated_at: new Date() };
  if (settledAt) {
    updateData.settled_at = settledAt;
  }
  return await Payment.findOneAndUpdate(
    { id: paymentId },
    updateData,
    { returnDocument: 'after' }
  );
}

/**
 * Create a new listing
 */
export async function createListing(listingData: any) {
  await getMongo();
  const listing = new Listing(listingData);
  return await listing.save();
}

/**
 * Update listing
 */
export async function updateListing(listingId: string, updateData: any) {
  await getMongo();
  return await Listing.findOneAndUpdate(
    { id: listingId },
    { ...updateData, updated_at: new Date() },
    { returnDocument: 'after' }
  );
}

/**
 * Delete listing
 */
export async function deleteListing(listingId: string) {
  await getMongo();
  return await Listing.findOneAndDelete({ id: listingId });
}

/**
 * Create a new session
 */
export async function createSessionDB(sessionData: any) {
  await getMongo();
  const session = new Session(sessionData);
  return await session.save();
}

/**
 * Get session by token
 */
export async function getSessionByToken(token: string) {
  await getMongo();
  return await Session.findOne({ token });
}

/**
 * Revoke session
 */
export async function revokeSessionByToken(token: string) {
  await getMongo();
  return await Session.findOneAndUpdate(
    { token },
    { revoked_at: new Date() },
    { returnDocument: 'after' }
  );
}

/**
 * Create auth challenge
 */
export async function createAuthChallenge(challengeData: any) {
  await getMongo();
  const challenge = new AuthChallenge(challengeData);
  return await challenge.save();
}

/**
 * Consume auth challenge
 */
export async function consumeAuthChallenge(challenge: string) {
  await getMongo();
  const result = await AuthChallenge.findOneAndUpdate(
    { challenge, consumed_at: null, expires_at: { $gt: new Date() } },
    { consumed_at: new Date() },
    { returnDocument: 'after' }
  );
  return result !== null;
}

/**
 * Clean expired challenges
 */
export async function cleanExpiredChallenges() {
  await getMongo();
  const expiryDate = new Date(Date.now() - 3600000); // 1 hour ago
  return await AuthChallenge.deleteMany({ expires_at: { $lt: expiryDate } });
}

/**
 * Get listing by address (the "30078:pubkey:listing_id" format)
 */
export async function getListingByAddress(address: string) {
  await getMongo();
  const listing = await Listing.findOne({ address });
  if (!listing) return null;
  
  const profile = await Profile.findOne({ pubkey: listing.pubkey });
  return {
    ...listing.toObject(),
    username: profile?.username || null,
  };
}

/**
 * Get comments for a listing with author username
 */
export async function getListingComments(listingId: string) {
  await getMongo();
  const comments = await ListingComment.find({ listing_id: listingId })
    .sort({ created_at: 1 });
  
  // Enrich with author usernames
  const enriched = await Promise.all(
    comments.map(async (c) => {
      const profile = await Profile.findOne({ pubkey: c.pubkey });
      return {
        id: c.id,
        listing_id: c.listing_id,
        author_pubkey: c.pubkey,
        body: c.comment,
        created_at: c.created_at,
        author_username: profile?.username || null,
      };
    })
  );
  
  return enriched;
}

/**
 * Get bookings for a listing with advertiser username (for public display)
 */
export async function getBookingsWithAdvertiser(listingId: string) {
  await getMongo();
  const bookings = await Booking.find({
    listing_id: listingId,
    status: { $in: ['approved', 'completed'] },
  }).sort({ created_at: -1 });
  
  const enriched = await Promise.all(
    bookings.map(async (b) => {
      const profile = await Profile.findOne({ pubkey: b.advertiser_pubkey });
      return {
        id: b.id,
        listing_id: b.listing_id,
        advertiser_pubkey: b.advertiser_pubkey,
        advertiser_username: profile?.username || null,
        ad_id: b.ad_id,
        status: b.status,
        starts_on: b.starts_on.toISOString(),
        ends_on: b.ends_on.toISOString(),
        created_at: b.created_at.toISOString(),
        image_url: b.image_url,
        website_url: b.website_url,
      };
    })
  );
  
  return enriched;
}
