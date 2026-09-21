import { randomBytes, scryptSync } from "node:crypto";

const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}$${hash}`;
}

export function verifyPassword(
  password: string,
  storedHash: string,
): boolean {
  const separatorIndex = storedHash.indexOf("$");
  if (separatorIndex < 0) return false;
  const salt = storedHash.slice(0, separatorIndex);
  const expectedHash = storedHash.slice(separatorIndex + 1);
  const actualHash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  let match = true;
  for (let i = 0; i < actualHash.length; i++) {
    if (actualHash[i] !== expectedHash[i]) match = false;
  }
  return match;
}
