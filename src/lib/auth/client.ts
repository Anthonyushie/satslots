import { signNostrEvent } from "@/lib/nostr/nip07";
import { NostrError } from "@/lib/nostr/types";
import { buildAuthEventTemplate } from "./nip42";


export interface SessionUser {
  readonly pubkey: string;
  readonly username: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
  }
  return `Request failed with status ${response.status}.`;
}

export async function signInWithNostr(options: {
  expectedPubkey: string;
  username?: string;
}): Promise<SessionUser> {
  const challengeResponse = await fetch("/api/auth/challenge", {
    method: "POST",
  });
  if (!challengeResponse.ok) {
    throw new AuthError(
      await readError(challengeResponse),
      challengeResponse.status,
    );
  }
  const { nonce, audience } = (await challengeResponse.json()) as {
    nonce: string;
    audience: string;
  };

  const event = await signNostrEvent(
    buildAuthEventTemplate({
      nonce,
      audience,
      createdAt: Math.floor(Date.now() / 1000),
    }),
    { expectedPubkey: options.expectedPubkey },
  );

  const verifyResponse = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, username: options.username }),
  });
  if (!verifyResponse.ok) {
    throw new AuthError(await readError(verifyResponse), verifyResponse.status);
  }
  const { user } = (await verifyResponse.json()) as { user: SessionUser };
  return user;
}

export async function fetchSession(): Promise<SessionUser | null> {
  try {
    const response = await fetch("/api/auth/session", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const { user } = (await response.json()) as { user: SessionUser | null };
    return user ?? null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof NostrError) return error.message;
  if (error instanceof AuthError) return error.message;
  if (error instanceof Error) return error.message;
  return "Sign-in failed.";
}
