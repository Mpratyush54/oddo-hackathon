import { z } from 'zod';
import { id, recordKeys, instant, count } from './primitives.js';
import { pushSubscriptionSchema } from '../../modules/notifications/push.schemas.js';
export const pushRecordSchema = z.strictObject({
  ...recordKeys,
  pk: id.startsWith('USER#'),
  sk: id.startsWith('PUSH#'),
  userId: id,
  subscription: pushSubscriptionSchema,
  active: z.boolean(),
  createdAt: instant,
  updatedAt: instant,
  version: count,
});
export const pushOwnerSchema = z.strictObject({
  ...recordKeys,
  pk: id.startsWith('PUSH#'),
  sk: z.literal('OWNER'),
  userId: id,
  version: count,
});
