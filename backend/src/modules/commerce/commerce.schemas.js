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
export const createProductSchema = z
  .object({
    name: requiredText(80),
    type: z.enum(['Hoodie', 'T-shirt', 'Tote bag', 'Other']),
    color: z.string().trim().min(1).max(40).default('teal'),
    price: moneyAmount,
    memberPrice: moneyAmount,
    stock: z
      .record(z.string().trim().min(1).max(20), z.number().int().min(0).max(5000))
      .refine((value) => Object.keys(value).length > 0, 'Add at least one size.'),
    image: z
      .string()
      .trim()
      .max(350000)
      .refine(
        (value) =>
          value === '' ||
          /^https?:\/\//i.test(value) ||
          /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value),
        'Use an http(s) image URL or upload a PNG, JPEG, or WebP file.',
      )
      .optional(),
    gallery: z
      .array(
        z
          .string()
          .trim()
          .max(350000)
          .refine(
            (value) =>
              /^https?:\/\//i.test(value) ||
              /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value),
            'Use an http(s) image URL or upload a PNG, JPEG, or WebP file.',
          ),
      )
      .max(3)
      .optional(),
  })
  .refine((value) => value.memberPrice <= value.price, {
    message: 'Member price cannot exceed the regular price.',
    path: ['memberPrice'],
  });

export const updateProductSchema = z
  .object({
    id: entityId,
    name: requiredText(80).optional(),
    type: z.enum(['Hoodie', 'T-shirt', 'Tote bag', 'Other', 'Merchandise']).optional(),
    color: z.string().trim().min(1).max(40).optional(),
    price: moneyAmount.optional(),
    memberPrice: moneyAmount.optional(),
    stock: z
      .record(z.string().trim().min(1).max(20), z.number().int().min(0).max(5000))
      .optional(),
    image: z
      .string()
      .trim()
      .max(350000)
      .refine(
        (value) =>
          value === '' ||
          /^https?:\/\//i.test(value) ||
          /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value),
        'Use an http(s) image URL or upload a PNG, JPEG, or WebP file.',
      )
      .optional(),
    gallery: z
      .array(
        z
          .string()
          .trim()
          .max(350000)
          .refine(
            (value) =>
              /^https?:\/\//i.test(value) ||
              /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value),
            'Use an http(s) image URL or upload a PNG, JPEG, or WebP file.',
          ),
      )
      .max(3)
      .optional(),
    delisted: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.memberPrice === undefined ||
      value.price === undefined ||
      value.memberPrice <= value.price,
    {
      message: 'Member price cannot exceed the regular price.',
      path: ['memberPrice'],
    },
  );

export const deleteProductSchema = z.object({
  productId: entityId,
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
export const pointRulesSchema = z.object({
  checkInEnabled: z.boolean(),
  checkInPoints: z.number().int().min(0).max(500),
  merchEnabled: z.boolean(),
  merchRupeesPerPoint: z.number().int().min(1).max(10000),
  taskEnabled: z.boolean(),
  taskDonePoints: z.number().int().min(0).max(500),
});
export const savePointRulesSchema = z.object({
  rules: pointRulesSchema,
});
const promoFields = {
  id: entityId.optional(),
  code: promoCodeSchema,
  active: z.boolean().default(false),
  maxRedemptions: z.number().int().min(1).max(100000).optional(),
  memberOnly: z.boolean().default(false),
  minSubtotal: z.number().nonnegative().default(0),
  description: z.string().max(300).default(''),
  productId: entityId.optional(),
};
export const savePromoSchema = z.object({
  promo: z.discriminatedUnion('type', [
    z.object({ ...promoFields, type: z.literal('percent'), value: z.number().positive().max(100) }),
    z.object({ ...promoFields, type: z.literal('fixed'), value: moneyAmount }),
  ]),
});
