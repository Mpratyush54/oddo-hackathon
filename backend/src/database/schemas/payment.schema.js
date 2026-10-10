import { z } from 'zod';
import { recordKeys, id, instant, hash256 } from './primitives.js';
import { paymentActionSchema } from '../../modules/payments/payments.schemas.js';

export const paymentRecordSchema = z.strictObject({
  ...recordKeys,
  pk: id.startsWith('USER#'),
  sk: id.startsWith('PAYMENT#'),
  id,
  userId: id,
  clubId: id,
  fingerprint: hash256,
  action: paymentActionSchema,
  amount: z.number().int().positive(),
  currency: z.literal('INR'),
  mode: z.literal('test'),
  status: z.enum([
    'Creating',
    'Created',
    'CreationFailed',
    'Fulfilled',
    'RefundPending',
    'Refunded',
  ]),
  version: z.number().int().nonnegative(),
  createdAt: instant,
  orderId: id.optional(),
  paymentId: id.optional(),
  refundId: id.optional(),
  result: z.record(z.string(), z.json()).optional(),
});
export const paymentMappingSchema = z.strictObject({
  ...recordKeys,
  pk: id.startsWith('RAZORPAY#'),
  sk: z.literal('PAYMENT_REF'),
  paymentPk: id.startsWith('USER#'),
  paymentSk: id.startsWith('PAYMENT#'),
});
