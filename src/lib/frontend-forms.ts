// In-memory UI input only. These are not backend requests or persisted records.
export interface ListingFormValues {
  name: string;
  websiteUrl: string;
  category: string;
  dailyPriceSats: string;
  description: string;
}

export interface BookingFormValues {
  startDate: string;
  endDate: string;
}

export interface CampaignFormValues {
  name: string;
  headline: string;
  destinationUrl: string;
  description: string;
}
