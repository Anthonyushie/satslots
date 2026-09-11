import { verifyEvent, type Event } from "nostr-tools/pure";

export const MAX_CONTENT_BYTES = 16_384;
export const MAX_FUTURE_SECONDS = 300;
const encoder = new TextEncoder();

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPubkey(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export function isText(
  value: unknown,
  min: number,
  max: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    value.trim().length >= min &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  );
}

export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.hostname.length > 0 &&
      !url.username &&
      !url.password &&
      value === value.trim() &&
      !/[\u0000-\u0020\u007f]/.test(value)
    );
  } catch {
    return false;
  }
}

export function contentFits(value: string): boolean {
  return (
    value.length <= MAX_CONTENT_BYTES &&
    encoder.encode(value).length <= MAX_CONTENT_BYTES
  );
}

/** Copy wire fields before verification: never trust nostr-tools' cached symbol. */
export function verifiedEvent(
  value: unknown,
  now = Math.floor(Date.now() / 1000),
): Event | null {
  try {
    if (!isRecord(value)) return null;
    const { id, pubkey, sig, kind, created_at, tags, content } = value;
    if (
      !isPubkey(id) ||
      !isPubkey(pubkey) ||
      typeof sig !== "string" ||
      !/^[0-9a-f]{128}$/.test(sig) ||
      typeof kind !== "number" ||
      !Number.isSafeInteger(kind) ||
      kind < 0 ||
      kind > 65535 ||
      typeof created_at !== "number" ||
      !Number.isSafeInteger(created_at) ||
      created_at < 0 ||
      created_at > now + MAX_FUTURE_SECONDS ||
      typeof content !== "string" ||
      !contentFits(content) ||
      !Array.isArray(tags) ||
      tags.length > 64 ||
      !tags.every(
        (tag: unknown) =>
          Array.isArray(tag) &&
          tag.length > 0 &&
          tag.length <= 8 &&
          tag.every(
            (part: unknown) => typeof part === "string" && part.length <= 2048,
          ),
      )
    )
      return null;
    const copy: Event = {
      id,
      pubkey,
      sig,
      kind,
      created_at,
      content,
      tags: tags.map((tag: string[]) => [...tag]),
    };
    if (encoder.encode(JSON.stringify(copy)).length > 65_536) return null;
    return verifyEvent(copy) ? copy : null;
  } catch {
    return null;
  }
}

/** NIP-01: newer timestamp wins; ties use the lexicographically lowest ID. */
export function compareEvents(a: Event, b: Event): number {
  return (
    b.created_at - a.created_at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
