import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Password hashing with node's built-in scrypt — no external dependency.
// Stored format: "<saltHex>:<hashHex>".
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Secret for signing the auth cookie. Set RECALL_SECRET in production (docker-compose / AWS).
export const COOKIE_SECRET = process.env.RECALL_SECRET ?? 'dev-insecure-secret-change-me';
export const COOKIE_NAME = 'recall_uid';
