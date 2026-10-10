import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

export const scrypt = promisify(scryptCallback);

export const hash = (value) => createHash('sha256').update(value).digest('hex');

export const accountKey = (email) => 'ACCOUNT#' + hash(String(email).trim().toLowerCase());

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const digest = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return ['scrypt', 32768, 8, 1, salt, digest.toString('hex')].join(':');
}

export async function verifyPassword(password, encoded) {
  const parts = encoded.split(':');
  const expected = Buffer.from(parts[5], 'hex');
  const actual = await scrypt(password, parts[4], 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
