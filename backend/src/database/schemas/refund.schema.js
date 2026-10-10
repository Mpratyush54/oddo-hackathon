import { z } from 'zod';
import { recordKeys, id, instant } from './primitives.js';
import { clubPartition } from './club.schema.js';
export const refundRecordSchema = z.strictObject({
  ...recordKeys,
  pk: clubPartition,
  sk: id.startsWith('REFUND#'),
  id,
  clubId: id,
  userId: id,
  requesterName: z.string(),
  paymentId: id,
  paymentPk: id.startsWith('USER#'),
  paymentSk: id.startsWith('PAYMENT#'),
  amount: z.number().int().positive(),
  currency: z.literal('INR'),
  mode: z.literal('test'),
  status: z.enum(['Requested', 'Rejected', 'Processing', 'NeedsReview', 'Failed', 'Processed']),
  reason: z.string().min(5).max(500),
  detail: z.string().max(1000).optional(),
  createdAt: instant,
  updatedAt: instant,
  version: z.number().int().nonnegative(),
  reviewedBy: id.optional(),
  reviewedAt: instant.optional(),
  rejectionReason: z.string().max(500).optional(),
  providerRefundId: id.optional(),
  automatic: z.boolean().optional(),
  membershipLocked: z
    .object({ status: z.enum(['Active', 'Pending', 'Expiring', 'Expired']), expires: z.iso.date() })
    .optional(),
});
