import mongoose from 'mongoose';

// Define schemas inline for the seed script
const ProfileSchema = new mongoose.Schema({
  pubkey: { type: String, required: true, unique: true },
  username: String,
  bio: String,
  lightning_address: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const ListingSchema = new mongoose.Schema({
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

const BookingSchema = new mongoose.Schema({
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

const Profile = mongoose.models.Profile || mongoose.model('Profile', ProfileSchema);
const Listing = mongoose.models.Listing || mongoose.model('Listing', ListingSchema);
const Booking = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);

const MONGODB_URI = 'mongodb+srv://joshxion_db_user:62AOD2OetlhwkGEg@cluster0.fssus3m.mongodb.net/satslots?retryWrites=true&w=majority';

async function seedMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Create anonymous profile
    const anonProfile = await Profile.findOneAndUpdate(
      { pubkey: '0000000000000000000000000000000000000000000000000000000000000000' },
      {
        pubkey: '0000000000000000000000000000000000000000000000000000000000000000',
        username: 'anonymous',
        created_at: new Date(),
        updated_at: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log('✓ Anonymous profile created/updated');

    // Create the Lamborghini listing
    const lamborghiniListing = await Listing.findOneAndUpdate(
      { id: 'b7615deb-52cf-4a11-a247-e38baf82a3e8' },
      {
        id: 'b7615deb-52cf-4a11-a247-e38baf82a3e8',
        pubkey: '278108610f53fe5cf73d103772dc4deafd005ec255f8cb5c562b03d7d5cca606',
        title: 'Lamborghini',
        description: 'Luxury automotive advertising opportunities. Reach high-net-worth individuals interested in luxury cars and lifestyle.',
        category: 'Automotive',
        audience: 'Luxury',
        price_sats: 10000,
        ad_duration_days: 7,
        max_ads: 5,
        address: '30078:278108610f53fe5cf73d103772dc4deafd005ec255f8cb5c562b03d7d5cca606:satslots:kCnrf3KZ8-ck',
        lightning_address: null,
        published: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log('✓ Lamborghini listing created/updated');

    // Create the BItdev PH listing
    const bitdevListing = await Listing.findOneAndUpdate(
      { id: '1145b06c-2abe-48af-851a-ebbabc475d76' },
      {
        id: '1145b06c-2abe-48af-851a-ebbabc475d76',
        pubkey: '47b24f89c88337f22f54c6967fe196c033d68a96bb22654df65e07356212cd99',
        title: 'BItdev PH',
        description: 'BItdev PH is a premier Bitcoin and blockchain development community in the Philippines. We provide advertising opportunities for blockchain projects, DeFi platforms, and cryptocurrency services to reach our growing community of developers and enthusiasts.',
        category: 'Bitcoin',
        audience: 'Developers',
        price_sats: 5000,
        ad_duration_days: 7,
        max_ads: 10,
        address: '30078:47b24f89c88337f22f54c6967fe196c033d68a96bb22654df65e07356212cd99:satslots:tIZJ_ObO2rDS',
        image_url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=400&fit=crop',
        lightning_address: null,
        published: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log('✓ BItdev PH listing created/updated');

    // Create advertiser profile for iPhone Duo
    const advertiserProfile = await Profile.findOneAndUpdate(
      { pubkey: 'iphone_duo_advertiser' },
      {
        pubkey: 'iphone_duo_advertiser',
        username: 'iPhone Duo',
        created_at: new Date(),
        updated_at: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log('✓ iPhone Duo advertiser profile created/updated');

    // Create iPhone Duo booking for BItdev PH
    const iphoneBooking = await Booking.findOneAndUpdate(
      { id: 'cd21b4c8-6784-40e0-8d87-88bed4ef9877' },
      {
        id: 'cd21b4c8-6784-40e0-8d87-88bed4ef9877',
        listing_id: '1145b06c-2abe-48af-851a-ebbabc475d76',
        advertiser_pubkey: 'iphone_duo_advertiser',
        ad_id: 'iphone-duo-campaign-1789941849964',
        status: 'approved',
        starts_on: new Date('2026-09-20T00:00:00Z'),
        ends_on: new Date('2026-09-26T00:00:00Z'),
        image_url: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&h=400&fit=crop',
        website_url: 'https://www.apple.com/iphone-16',
        created_at: new Date(),
        updated_at: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log('✓ iPhone Duo booking created/updated');

    console.log('\n✓ MongoDB seeding completed successfully!');
    
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
}

seedMongoDB();
