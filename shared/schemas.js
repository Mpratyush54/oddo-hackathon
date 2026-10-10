import { z } from 'zod';

const DIGITS = '0123456789';
const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const digitsSchema = z
  .string()
  .min(1)
  .refine(
    (value) => [...value].every((character) => DIGITS.includes(character)),
    'Use digits only.',
  );
export const promoCodeSchema = z
  .string()
  .min(4)
  .max(16)
  .refine(
    (value) =>
      [...value].every((character) => ('ABCDEFGHIJKLMNOPQRSTUVWXYZ' + DIGITS).includes(character)),
    'Use 4–16 uppercase letters or digits.',
  );
export const requestKeySchema = z
  .string()
  .min(8)
  .max(100)
  .refine(
    (value) => [...value].every((character) => (LETTERS + DIGITS + '_-').includes(character)),
    'Use letters, digits, underscores or hyphens for the request key.',
  );
export const phoneSchema = z.e164().min(9);
export const optionalPhoneSchema = z.union([phoneSchema, z.literal('')]);
export const graphVersionSchema = z
  .string()
  .startsWith('v')
  .endsWith('.0')
  .refine(
    (value) => digitsSchema.safeParse(value.slice(1, -2)).success,
    'Use a Graph version such as v25.0.',
  );
export const sha256Schema = z
  .hash('sha256')
  .refine((value) => value === value.toLowerCase(), 'Use a lowercase hexadecimal SHA-256 value.');

export function normalizePhone(value) {
  return [...String(value)].filter((character) => DIGITS.includes(character)).join('');
}

export function removeTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
