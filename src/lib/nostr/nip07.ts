import {
  validateEvent,
  type Event,
  type EventTemplate,
} from "nostr-tools/pure";
import { NostrError } from "./types";
import {
  contentFits,
  isPubkey,
  verifiedEvent,
  MAX_FUTURE_SECONDS,
} from "./validation";

export interface Nip07Provider {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<Event>;
}

export function getNip07Provider(): Nip07Provider | undefined {
  if (typeof window === "undefined") return undefined;
  const provider = (window as Window & { nostr?: Partial<Nip07Provider> })
    .nostr;
  return provider &&
    typeof provider.getPublicKey === "function" &&
    typeof provider.signEvent === "function"
    ? (provider as Nip07Provider)
    : undefined;
}

export function isNip07Available(): boolean {
  return !!getNip07Provider();
}

function requireProvider(provider?: Nip07Provider): Nip07Provider {
  const resolved = provider ?? getNip07Provider();
  if (!resolved)
    throw new NostrError(
      "EXTENSION_UNAVAILABLE",
      "Install or enable a NIP-07 extension, then retry.",
    );
  return resolved;
}

export async function getNostrPublicKey(
  provider?: Nip07Provider,
): Promise<string> {
  const signer = requireProvider(provider);
  let pubkey: unknown;
  try {
    pubkey = await signer.getPublicKey();
  } catch (cause) {
    throw new NostrError(
      "EXTENSION_REJECTED",
      "The extension did not grant access to a public key.",
      { cause },
    );
  }
  if (!isPubkey(pubkey))
    throw new NostrError(
      "INVALID_INPUT",
      "Extension returned an invalid public key.",
    );
  return pubkey;
}

export async function signNostrEvent(
  template: EventTemplate,
  options: { provider?: Nip07Provider; expectedPubkey?: string } = {},
): Promise<Event> {
  const signer = requireProvider(options.provider);
  const pubkey = await getNostrPublicKey(signer);
  if (
    options.expectedPubkey !== undefined &&
    pubkey !== options.expectedPubkey
  ) {
    throw new NostrError(
      "SIGNER_MISMATCH",
      "The extension account changed. Reconnect before signing.",
    );
  }
  if (
    !validateEvent({ ...template, pubkey }) ||
    !Number.isSafeInteger(template.created_at) ||
    template.created_at < 0 ||
    template.created_at > Math.floor(Date.now() / 1000) + MAX_FUTURE_SECONDS ||
    !Number.isSafeInteger(template.kind) ||
    template.kind < 0 ||
    template.kind > 65535 ||
    !contentFits(template.content) ||
    template.tags.length > 64 ||
    !template.tags.every(
      (tag) =>
        tag.length > 0 && tag.length <= 8 && tag.every((v) => v.length <= 2048),
    )
  )
    throw new NostrError(
      "INVALID_INPUT",
      "Cannot sign an invalid or oversized event template.",
    );
  const expected: EventTemplate = {
    kind: template.kind,
    created_at: template.created_at,
    tags: template.tags.map((tag) => [...tag]),
    content: template.content,
  };
  const envelopeBytes = new TextEncoder().encode(
    JSON.stringify({
      ...expected,
      pubkey,
      id: "0".repeat(64),
      sig: "0".repeat(128),
    }),
  ).length;
  if (envelopeBytes > 65_536) {
    throw new NostrError(
      "INVALID_INPUT",
      "Signed event envelope exceeds 64 KiB.",
    );
  }
  let response: unknown;
  try {
    // Give the provider a separate copy: it cannot mutate our comparison target.
    response = await signer.signEvent({
      ...expected,
      tags: expected.tags.map((tag) => [...tag]),
    });
  } catch (cause) {
    throw new NostrError(
      "EXTENSION_REJECTED",
      "The extension did not sign the event.",
      { cause },
    );
  }
  const event = verifiedEvent(response);
  if (!event)
    throw new NostrError(
      "INVALID_SIGNATURE",
      "Extension returned an invalid signed event.",
    );
  if (
    event.pubkey !== pubkey ||
    event.kind !== expected.kind ||
    event.created_at !== expected.created_at ||
    event.content !== expected.content ||
    JSON.stringify(event.tags) !== JSON.stringify(expected.tags)
  )
    throw new NostrError(
      "SIGNER_MISMATCH",
      "Extension changed the event or signed with a different identity.",
    );
  return event;
}
