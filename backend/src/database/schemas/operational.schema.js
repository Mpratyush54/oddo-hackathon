import { z } from 'zod';
import { id, count, ttl, recordKeys } from './primitives.js';
import { clubPartition } from './club.schema.js';

export const requestSchema = z.strictObject({
  ...recordKeys,
  pk: clubPartition,
  sk: z.string().regex(/^REQUEST#[^#]+#[^#]+$/),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  result: z.record(z.string(), z.json()),
  expiresAt: ttl,
});
export const counterSchema = z.strictObject({
  ...recordKeys,
  pk: z.string().regex(/^LIMIT#.+$/),
  sk: z.literal('COUNT'),
  count,
  expiresAt: ttl,
});
export const messageMappingSchema = z.strictObject({
  ...recordKeys,
  pk: z.string().regex(/^MESSAGE#.+$/),
  sk: z.literal('DELIVERY'),
  deliveryPk: clubPartition,
  deliverySk: z.string().regex(/^DELIVERY#.+$/),
});
export const messageStatusSchema = z.strictObject({
  ...recordKeys,
  pk: z.string().regex(/^MESSAGE#.+$/),
  sk: z.literal('STATUS'),
  providerStatus: z.enum(['sent', 'delivered', 'read', 'failed']),
  providerTimestamp: count,
});
