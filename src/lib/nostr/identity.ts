import { createNostrClient, type NostrClient } from "./client";
import { getNostrPublicKey, type Nip07Provider } from "./nip07";
import {
  compareEvents,
  isPubkey,
  isRecord,
  isSafeHttpUrl,
  isText,
  verifiedEvent,
} from "./validation";
import {
  NostrError,
  RelayOperationError,
  type NostrProfile,
  type NostrConnection,
  type ProfileResult,
} from "./types";

/** Pure DTO mapping; no database writes, remote image fetches, or HTML parsing. */
export function mapNostrProfile(
  pubkey: string,
  metadata: unknown,
): NostrProfile {
  if (!isPubkey(pubkey))
    throw new NostrError("INVALID_INPUT", "Invalid Nostr public key.");
  const source = isRecord(metadata) ? metadata : {};
  const name = isText(source.display_name, 1, 120)
    ? source.display_name
    : isText(source.name, 1, 120)
      ? source.name
      : `${pubkey.slice(0, 8)}…`;
  return {
    pubkey,
    name,
    avatar: isSafeHttpUrl(source.picture) ? source.picture : null,
    bio: isText(source.about, 0, 4000) ? source.about : "",
  };
}

export async function getNostrProfile(
  pubkey: string,
  client: NostrClient = createNostrClient(),
): Promise<ProfileResult> {
  if (!isPubkey(pubkey))
    throw new NostrError("INVALID_INPUT", "Invalid Nostr public key.");
  const result = await client.query({ kinds: [0], authors: [pubkey] });
  const events = result.events
    .map((event) => verifiedEvent(event))
    .filter((event) => event !== null)
    .filter((event) => event.kind === 0 && event.pubkey === pubkey)
    .sort(compareEvents);
  for (const event of events) {
    try {
      const metadata: unknown = JSON.parse(event.content);
      if (isRecord(metadata))
        return {
          profile: mapNostrProfile(pubkey, metadata),
          status: "found",
          relays: result.relays,
        };
    } catch {
      /* Ignore malformed relay content. */
    }
  }
  return {
    profile: mapNostrProfile(pubkey, null),
    status: "missing",
    relays: result.relays,
  };
}

/** A local signer connection, NOT an authenticated backend session. */
export async function connectNostr(
  options: {
    provider?: Nip07Provider;
    client?: NostrClient;
  } = {},
): Promise<NostrConnection> {
  const pubkey = await getNostrPublicKey(options.provider);
  try {
    const { profile, status, relays } = await getNostrProfile(
      pubkey,
      options.client,
    );
    return { pubkey, profile, profileStatus: status, relays };
  } catch (error) {
    if (!(error instanceof RelayOperationError)) throw error;
    return {
      pubkey,
      profile: mapNostrProfile(pubkey, null),
      profileStatus: "unavailable",
      relays: error.relays,
    };
  }
}
