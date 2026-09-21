import mongoose, { Schema, Document, Model } from "mongoose";

// ===== Profile Schema =====
export interface IProfile extends Document {
  pubkey: string;
  username?: string;
  bio?: string;
  lightning_address?: string;
  created_at: Date;
  updated_at: Date;
}

const ProfileSchema = new Schema<IProfile>({
  pubkey: { type: String, required: true, unique: true },
  username: String,
  bio: String,
  lightning_address: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// ===== Listing Schema =====
export interface IListing extends Document {
  id: string;
  pubkey: string;
  title: string;
  description: string;
  category: string;
  audience: string;
  price_sats: number;
  ad_duration_days: number;
  max_ads: number;
  address: string;
  image_url?: string;
  website_url?: string;
  lightning_address?: string;
  published: boolean;
  created_at: Date;
  updated_at: Date;
}

const ListingSchema = new Schema<IListing>({
  id: { type: String, required: true, unique: true },
  pubkey: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  audience: { type: String, required: true },
  price_sats: { type: Number, required: true },
  ad_duration_days: { type: Number, required: true },
  max_ads: { type: Number, required: true },
  address: { type: String, required: true, unique: true },
  image_url: String,
  website_url: String,
  lightning_address: String,
  published: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// ===== Booking Schema =====
export interface IBooking extends Document {
  id: string;
  listing_id: string;
  advertiser_pubkey: string;
  campaign_id?: string;
  ad_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  starts_on: Date;
  ends_on: Date;
  image_url?: string;
  website_url?: string;
  created_at: Date;
  updated_at: Date;
}

const BookingSchema = new Schema<IBooking>({
  id: { type: String, required: true, unique: true },
  listing_id: { type: String, required: true, index: true },
  advertiser_pubkey: { type: String, required: true, index: true },
  campaign_id: String,
  ad_id: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  starts_on: { type: Date, required: true },
  ends_on: { type: Date, required: true },
  image_url: String,
  website_url: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// ===== Payment Schema =====
export interface IPayment extends Document {
  id: string;
  booking_id: string;
  amount_sats: number;
  status: 'pending' | 'invoiced' | 'settled' | 'failed' | 'refunded';
  ln_invoice: string;
  payment_hash: string;
  settled_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const PaymentSchema = new Schema<IPayment>({
  id: { type: String, required: true, unique: true },
  booking_id: { type: String, required: true, index: true },
  amount_sats: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'invoiced', 'settled', 'failed', 'refunded'],
    default: 'pending'
  },
  ln_invoice: { type: String, required: true },
  payment_hash: { type: String, required: true, unique: true },
  settled_at: Date,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// ===== Session Schema =====
export interface ISession extends Document {
  id: string;
  pubkey: string;
  token: string;
  expires_at: Date;
  created_at: Date;
  revoked_at?: Date;
}

const SessionSchema = new Schema<ISession>({
  id: { type: String, required: true, unique: true },
  pubkey: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true },
  expires_at: { type: Date, required: true },
  created_at: { type: Date, default: Date.now },
  revoked_at: Date
});

// ===== AuthChallenge Schema =====
export interface IAuthChallenge extends Document {
  id: string;
  pubkey: string;
  challenge: string;
  created_at: Date;
  expires_at: Date;
  consumed_at?: Date;
}

const AuthChallengeSchema = new Schema<IAuthChallenge>({
  id: { type: String, required: true, unique: true },
  pubkey: { type: String, default: "", index: true },
  challenge: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true },
  consumed_at: Date
});

// ===== Campaign Schema =====
export interface ICampaign extends Document {
  id: string;
  advertiser_pubkey: string;
  name: string;
  website_url: string;
  image_url?: string;
  created_at: Date;
  updated_at: Date;
}

const CampaignSchema = new Schema<ICampaign>({
  id: { type: String, required: true, unique: true },
  advertiser_pubkey: { type: String, required: true, index: true },
  name: { type: String, required: true },
  website_url: { type: String, required: true },
  image_url: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// ===== Review Schema =====
export interface IReview extends Document {
  id: string;
  booking_id: string;
  reviewer_pubkey: string;
  rating: number;
  comment?: string;
  created_at: Date;
}

const ReviewSchema = new Schema<IReview>({
  id: { type: String, required: true, unique: true },
  booking_id: { type: String, required: true, index: true },
  reviewer_pubkey: { type: String, required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String,
  created_at: { type: Date, default: Date.now }
});

// ===== ListingComment Schema =====
export interface IListingComment extends Document {
  id: string;
  listing_id: string;
  pubkey: string;
  comment: string;
  created_at: Date;
}

const ListingCommentSchema = new Schema<IListingComment>({
  id: { type: String, required: true, unique: true },
  listing_id: { type: String, required: true, index: true },
  pubkey: { type: String, required: true, index: true },
  comment: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

// Export models
export const Profile = (mongoose.models.Profile as Model<IProfile>) || mongoose.model<IProfile>('Profile', ProfileSchema);
export const Listing = (mongoose.models.Listing as Model<IListing>) || mongoose.model<IListing>('Listing', ListingSchema);
export const Booking = (mongoose.models.Booking as Model<IBooking>) || mongoose.model<IBooking>('Booking', BookingSchema);
export const Payment = (mongoose.models.Payment as Model<IPayment>) || mongoose.model<IPayment>('Payment', PaymentSchema);
export const Session = (mongoose.models.Session as Model<ISession>) || mongoose.model<ISession>('Session', SessionSchema);
export const AuthChallenge = (mongoose.models.AuthChallenge as Model<IAuthChallenge>) || mongoose.model<IAuthChallenge>('AuthChallenge', AuthChallengeSchema);
export const Campaign = (mongoose.models.Campaign as Model<ICampaign>) || mongoose.model<ICampaign>('Campaign', CampaignSchema);
export const Review = (mongoose.models.Review as Model<IReview>) || mongoose.model<IReview>('Review', ReviewSchema);
export const ListingComment = (mongoose.models.ListingComment as Model<IListingComment>) || mongoose.model<IListingComment>('ListingComment', ListingCommentSchema);
