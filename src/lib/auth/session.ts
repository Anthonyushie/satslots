import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { isText } from "@/lib/nostr/validation";
import { getMongo } from "@/lib/mongodb/client";
import { 
  createSessionDB, 
  getSessionByToken, 
  revokeSessionByToken,
  getProfileByPubkey,
  upsertProfile
} from "@/lib/mongodb/queries";
import { sha256Hex } from "./challenge";


const COOKIE_NAME = "satslots_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;

const TOKEN_PATTERN = new RegExp(`^[0-9a-f]{${TOKEN_BYTES * 2}}$`);

function readToken(value: unknown): string | null {
  return typeof value === "string" && TOKEN_PATTERN.test(value) ? value : null;
}

export interface SessionUser {
  readonly pubkey: string;
  readonly username: string;
}

export async function createSession(pubkey: string): Promise<void> {
  await getMongo();
  
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await createSessionDB({
    id: randomBytes(16).toString("hex"),
    pubkey,
    token: sha256Hex(token),
    expires_at: expiresAt,
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  await getMongo();
  
  const store = await cookies();
  const token = readToken(store.get(COOKIE_NAME)?.value);
  if (!token) return null;

  const session = await getSessionByToken(sha256Hex(token));
  if (!session || session.revoked_at || session.expires_at < new Date()) {
    return null;
  }

  const profile = await getProfileByPubkey(session.pubkey);
  if (!profile) {
    return null;
  }

  return {
    pubkey: profile.pubkey,
    username: profile.username || `user_${profile.pubkey.slice(0, 8)}`,
  };
}

export async function revokeSession(): Promise<void> {
  await getMongo();
  
  const store = await cookies();
  const token = readToken(store.get(COOKIE_NAME)?.value);
  if (token) {
    await revokeSessionByToken(sha256Hex(token));
  }
  store.delete(COOKIE_NAME);
}


function normaliseUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return isText(trimmed, 1, 48) ? trimmed : null;
}

export async function ensureProfile(
  pubkey: string,
  desiredUsername?: unknown,
): Promise<SessionUser> {
  await getMongo();
  
  const base =
    normaliseUsername(desiredUsername) ?? `user_${pubkey.slice(0, 8)}`;

  // Check if profile already exists
  const existing = await getProfileByPubkey(pubkey);
  if (existing) {
    return {
      pubkey: existing.pubkey,
      username: existing.username || `user_${pubkey.slice(0, 8)}`,
    };
  }

  // Create new profile with desired username
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 40)}-${attempt}`;
    try {
      const profile = await upsertProfile(pubkey, {
        username: candidate,
      });
      if (profile) {
        return {
          pubkey: profile.pubkey,
          username: profile.username || `user_${pubkey.slice(0, 8)}`,
        };
      }
    } catch (error: any) {
      if (error.code === 11000) continue; // Duplicate key error
      throw error;
    }
  }
  throw new Error(`could not allocate a unique username for ${pubkey}`);
}
