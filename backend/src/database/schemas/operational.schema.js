import { z } from 'zod';
import { id, count, ttl, recordKeys, hash256, prefixedKey } from './primitives.js';
import { clubPartition } from './club.schema.js';

export const requestSchema = z.strictObject({
  ...recordKeys,
  pk: clubPartition,
  sk: z.string().refine((key) => {
    const [label, userId, requestId, extra] = key.split('#');
    return label === 'REQUEST' && Boolean(userId) && Boolean(requestId) && extra === undefined;
  }, 'Use REQUEST#userId#requestId.'),
  fingerprint: hash256,
  result: z.record(z.string(), z.json()),
  expiresAt: ttl,
});
export const counterSchema = z.strictObject({
  ...recordKeys,
  pk: prefixedKey('LIMIT#'),
  sk: z.literal('COUNT'),
  count,
  expiresAt: ttl,
});
export const messageMappingSchema = z.strictObject({
  ...recordKeys,
  pk: prefixedKey('MESSAGE#'),
  sk: z.literal('DELIVERY'),
  deliveryPk: clubPartition,
  deliverySk: prefixedKey('DELIVERY#'),
});
export const messageStatusSchema = z.strictObject({
  ...recordKeys,
  pk: prefixedKey('MESSAGE#'),
  sk: z.literal('STATUS'),
  providerStatus: z.enum(['sent', 'delivered', 'read', 'failed']),
  providerTimestamp: count,
});
