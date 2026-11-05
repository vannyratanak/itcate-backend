import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto';

// Format: scrypt$<N>$<salt base64>$<hash base64>   (r=8, p=1, 64-byte key)
const N = 16384;
const KEYLEN = 64;

const derive = (password: string, salt: Buffer, n: number) =>
  new Promise<Buffer>((resolve, reject) =>
    _scrypt(password, salt, KEYLEN, { N: n, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, key) => (e ? reject(e) : resolve(key))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N);
  return `scrypt$${N}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Constant-time check. Malformed hashes return false. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, salt, hash] = (stored ?? '').split('$');
  const nn = Number(n);
  if (alg !== 'scrypt' || !Number.isInteger(nn) || nn < 1024 || nn > 1 << 20 || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(password, Buffer.from(salt, 'base64'), nn);
  return expected.length === key.length && timingSafeEqual(expected, key);
}

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;
/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(p: unknown): string | null {
  if (typeof p !== 'string') return 'password is required';
  if (p.length < PASSWORD_MIN) return `password must be at least ${PASSWORD_MIN} characters`;
  if (p.length > PASSWORD_MAX) return `password must be at most ${PASSWORD_MAX} characters`;
  return null;
}

// Hash verified when the username is unknown, so "no such user" costs the same as "wrong password".
let dummy: Promise<string> | null = null;
export const dummyHash = () => (dummy ??= hashPassword('timing-equalizer-not-a-real-password'));
