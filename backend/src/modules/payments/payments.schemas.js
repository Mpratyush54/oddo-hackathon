import { z } from 'zod';
import { requestKeySchema, sha256Schema } from '../../../../shared/schemas.js';
import { entityId } from '../../shared/request-validation.js';
import { orderRequestSchema } from '../commerce/commerce.schemas.js';
import { eventReferenceSchema } from '../tickets/tickets.schemas.js';

export const paymentActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('tickets.book'), args: eventReferenceSchema }),
  z.strictObject({ type: z.literal('orders'), args: orderRequestSchema }),
  z.strictObject({ type: z.literal('membership.demo-dues'), args: z.strictObject({}) }),
]);
export const createPaymentSchema = z.strictObject({
  clubId: entityId,
  action: paymentActionSchema,
  idempotencyKey: requestKeySchema,
});
export const verifyPaymentSchema = z.strictObject({
  idempotencyKey: requestKeySchema,
  razorpay_order_id: entityId,
  razorpay_payment_id: entityId,
  razorpay_signature: sha256Schema,
});
