import type { Event } from "nostr-tools/pure";
import type { Category } from "../marketplace";

export interface NostrProfile {
  readonly pubkey: string;
  readonly name: string;
  readonly avatar: string | null;
  readonly bio: string;
}

export interface ListingEventContent {
  readonly schemaVersion: 1;
  readonly name: string;
  readonly category: Category;
  readonly description: string;
  /** Daily price, in sats. Not a trusted booking/payment amount. */
  readonly priceSats: number;
  readonly websiteUrl: string;
  readonly audience?: string;
}

export type ListingInput = Omit<ListingEventContent, "schemaVersion"> & {
  /** Stable per-author identifier; reuse it to publish a revision. */
  readonly listingId: string;
};

export interface NostrListing extends ListingEventContent {
  readonly listingId: string;
  /** Nostr address: kind:pubkey:d. Use this, not eventId, as a UI key. */
  readonly address: string;
  readonly eventId: string;
  readonly pubkey: string;
  readonly createdAt: number;
}

export interface RelayConfig {
  readonly primary: readonly string[];
  readonly fallback: readonly string[];
  /** Per-relay, whole-operation deadline, including connection. */
  readonly timeoutMs: number;
  readonly maxEventsPerRelay: number;
}

export type RelayResult =
  | { readonly url: string; readonly ok: true; readonly truncated?: boolean }
  | {
      readonly url: string;
      readonly ok: false;
      readonly reason: "timeout" | "unavailable" | "closed" | "rejected";
    };

export interface RelayQueryResult {
  readonly events: readonly Event[];
  readonly relays: readonly RelayResult[];
}

export interface RelayPublishResult {
  readonly eventId: string;
  readonly acceptedRelays: readonly string[];
  readonly failedRelays: readonly Extract<RelayResult, { ok: false }>[];
}

export interface ProfileResult {
  readonly profile: NostrProfile;
  readonly status: "found" | "missing";
  readonly relays: readonly RelayResult[];
}

export interface NostrConnection {
  readonly pubkey: string;
  readonly profile: NostrProfile;
  readonly profileStatus: "found" | "missing" | "unavailable";
  readonly relays: readonly RelayResult[];
}

export interface DiscoveryFilters {
  readonly authors?: readonly string[];
  readonly category?: Category;
  readonly limit?: number;
}

export interface DiscoveryResult {
  readonly listings: readonly NostrListing[];
  readonly relays: readonly RelayResult[];
}

export class NostrError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "EXTENSION_UNAVAILABLE"
      | "EXTENSION_REJECTED"
      | "INVALID_SIGNATURE"
      | "SIGNER_MISMATCH",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "NostrError";
  }
}

export class RelayOperationError extends Error {
  constructor(public readonly relays: readonly RelayResult[]) {
    super("No configured relay completed the operation successfully.");
    this.name = "RelayOperationError";
  }
}
