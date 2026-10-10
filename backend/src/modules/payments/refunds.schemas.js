import { z } from 'zod';
import { entityId, requiredText } from '../../shared/request-validation.js';
export const requestRefundSchema = z.strictObject({
  paymentId: entityId,
  reason: requiredText(500).min(5),
});
export const reviewRefundSchema = z
  .strictObject({
    decision: z.enum(['approve', 'reject']),
    reason: requiredText(500).min(5).optional(),
  })
  .refine(
    (value) => value.decision !== 'reject' || !!value.reason,
    'Provide a reason for rejection.',
  );
