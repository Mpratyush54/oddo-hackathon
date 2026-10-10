import { z } from 'zod';
import {
  id,
  email,
  instant,
  count,
  role,
  ttl,
  recordKeys,
  prefixedKey,
  hash256,
} from './primitives.js';

const encodedPasswordParts = z.tuple([
  z.literal('scrypt'),
  z.literal('32768'),
  z.literal('8'),
  z.literal('1'),
  z.hex().length(32).lowercase(),
  z.hex().length(128).lowercase(),
]);

export const accountSchema = z.strictObject({
  ...recordKeys,
  pk: prefixedKey('ACCOUNT#').refine(
    (key) => hash256.safeParse(key.slice('ACCOUNT#'.length)).success,
    'Use an account hash key.',
  ),
  sk: z.literal('ACCOUNT'),
  id,
  passwordHash: z
    .string()
    .refine(
      (value) => encodedPasswordParts.safeParse(value.split(':')).success,
      'Use the encoded scrypt password format.',
    ),
});
export const profileSchema = z.strictObject({
  ...recordKeys,
  pk: prefixedKey('USER#'),
  sk: z.literal('PROFILE'),
  id,
  name: z.string().min(2).max(80),
  email,
  emailVerified: z.boolean(),
  sessionVersion: count.min(1),
  createdAt: instant,
  disabled: z.boolean().optional(),
});
export const accessSchema = z.strictObject({
  ...recordKeys,
  pk: prefixedKey('USER#'),
  sk: prefixedKey('ACCESS#'),
  clubId: id,
  role,
  collegeId: id.optional(),
});
export const sessionSchema = z.strictObject({
  ...recordKeys,
  pk: prefixedKey('SESSION#'),
  sk: z.literal('SESSION'),
  userId: id,
  sessionVersion: count.min(1),
  csrfToken: hash256,
  revoked: z.boolean(),
  expiresAt: ttl,
});
export const refreshSchema = z.strictObject({
  ...recordKeys,
  pk: prefixedKey('REFRESH#').refine(
    (key) => hash256.safeParse(key.slice('REFRESH#'.length)).success,
    'Use a refresh-token hash key.',
  ),
  sk: z.literal('REFRESH'),
  userId: id,
  sessionId: id,
  revoked: z.boolean(),
  expiresAt: ttl,
});
