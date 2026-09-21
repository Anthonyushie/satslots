import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getMongo } from "@/lib/mongodb/client";
import { 
  createAuthChallenge, 
  consumeAuthChallenge,
  cleanExpiredChallenges
} from "@/lib/mongodb/queries";
import { CHALLENGE_TTL_MS, NONCE_HEX_LENGTH } from "./nip42";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

const NONCE_PATTERN = new RegExp(`^[0-9a-f]{${NONCE_HEX_LENGTH}}$`);

export function isNonce(value: unknown): value is string {
  return typeof value === "string" && NONCE_PATTERN.test(value);
}

export async function issueChallenge(): Promise<{
  nonce: string;
  expiresAt: string;
}> {
  await getMongo();
  
  const nonce = randomBytes(NONCE_HEX_LENGTH / 2).toString("hex");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  // Clean expired challenges
  await cleanExpiredChallenges();

  // Create new challenge
  await createAuthChallenge({
    id: randomBytes(16).toString("hex"),
    pubkey: "", // Will be filled during verification
    challenge: sha256Hex(nonce),
    created_at: new Date(),
    expires_at: expiresAt,
  });

  return { nonce, expiresAt: expiresAt.toISOString() };
}

export async function consumeChallenge(nonce: string): Promise<boolean> {
  if (!isNonce(nonce)) return false;
  return await consumeAuthChallenge(sha256Hex(nonce));
}
