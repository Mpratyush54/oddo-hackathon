import { z } from 'zod';
import { id, email, instant, count, role, ttl, recordKeys } from './primitives.js';

export const accountSchema = z.strictObject({
  ...recordKeys,
  pk: z.string().regex(/^ACCOUNT#[a-f0-9]{64}$/),
  sk: z.literal('ACCOUNT'),
  id,
  passwordHash: z.string().regex(/^scrypt:32768:8:1:[a-f0-9]{32}:[a-f0-9]{128}$/),
});
export const profileSchema = z.strictObject({
  ...recordKeys,
  pk: z.string().regex(/^USER#.+$/),
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
  pk: z.string().regex(/^USER#.+$/),
  sk: z.string().regex(/^ACCESS#.+$/),
  clubId: id,
  role,
  collegeId: id.optional(),
});
export const sessionSchema = z.strictObject({
  ...recordKeys,
  pk: z.string().regex(/^SESSION#.+$/),
  sk: z.literal('SESSION'),
  userId: id,
  sessionVersion: count.min(1),
  csrfToken: z.string().regex(/^[a-f0-9]{64}$/),
  revoked: z.boolean(),
  expiresAt: ttl,
});
export const refreshSchema = z.strictObject({
  ...recordKeys,
  pk: z.string().regex(/^REFRESH#[a-f0-9]{64}$/),
  sk: z.literal('REFRESH'),
  userId: id,
  sessionId: id,
  revoked: z.boolean(),
  expiresAt: ttl,
});
