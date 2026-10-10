import { z } from 'zod';
import { promoCodeSchema } from '../../../../shared/schemas.js';
import { entityId, requiredText, moneyAmount } from '../../shared/request-validation.js';

export const quoteRequestSchema = z.object({
  productId: entityId,
  code: z.string().trim().toUpperCase().pipe(promoCodeSchema),
  quantity: z.number().int().min(1).max(10),
  joinMembership: z.boolean().default(false),
});

export const orderRequestSchema = z.object({
  productId: entityId,
  size: requiredText(20),
  quantity: z.number().int().min(1).max(10),
  promoCode: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.union([promoCodeSchema, z.literal('')]))
    .optional(),
  joinMembership: z.boolean().default(false),
});
export const inventoryRequestSchema = z.object({
  productId: entityId,
  size: requiredText(20),
  delta: z
    .number()
    .int()
    .min(-500)
    .max(500)
    .refine((value) => value !== 0, 'Enter a stock adjustment.'),
  reason: requiredText(200).min(4),
});
export const updateOrderSchema = z.object({
  orderId: entityId,
  status: z.enum(['Placed', 'Ready for pickup', 'Picked up', 'Cancelled']),
});
export const awardPointsSchema = z.object({
  memberId: entityId,
  kind: z.enum(['participation', 'volunteer', 'contribution']),
  points: z.number().int().min(1).max(500),
  reason: z.string().trim().max(160).optional(),
  eventId: entityId.optional(),
  taskId: entityId.optional(),
});
const promoFields = {
  id: entityId.optional(),
  code: promoCodeSchema,
  active: z.boolean().default(false),
  maxRedemptions: z.number().int().min(1).max(100000).optional(),
  memberOnly: z.boolean().default(false),
  minSubtotal: z.number().nonnegative().default(0),
  description: z.string().max(300).default(''),
};
export const savePromoSchema = z.object({
  promo: z.discriminatedUnion('type', [
    z.object({ ...promoFields, type: z.literal('percent'), value: z.number().positive().max(100) }),
    z.object({ ...promoFields, type: z.literal('fixed'), value: moneyAmount }),
  ]),
});
