import { z } from 'zod';
import {
  digitsSchema,
  graphVersionSchema,
  normalizePhone,
  sha256Schema,
} from '../../../../shared/schemas.js';
import { entityId, requiredText } from '../../shared/request-validation.js';

export const audienceSchema = z.enum([
  'All members',
  'Active members',
  'Volunteers',
  'Pending dues',
  'Renewing soon',
]);
export const publishAnnouncementSchema = z.object({
  title: requiredText(100),
  body: requiredText(3000),
  audience: audienceSchema,
  email: z.boolean().default(false),
  whatsapp: z.boolean().default(false),
});
export const prepareRemindersSchema = z.object({
  status: z.enum(['Pending', 'Expiring']),
  memberIds: z.array(entityId).min(1).max(100).optional(),
});
export const metaConfigurationSchema = z.object({
  META_WHATSAPP_TOKEN: z.string().min(1),
  META_PHONE_NUMBER_ID: digitsSchema,
  META_GRAPH_VERSION: graphVersionSchema,
});
export const sendWhatsAppSchema = z.object({
  retry: z.boolean().default(false),
  announcementId: entityId,
  channel: z.literal('WhatsApp'),
  recipients: z
    .array(z.string().transform(normalizePhone).pipe(digitsSchema.min(8).max(15)))
    .min(1)
    .max(5),
});
export const webhookSignatureSchema = z
  .string()
  .startsWith('sha256=')
  .length(71)
  .refine(
    (value) => sha256Schema.safeParse(value.slice(7)).success,
    'Use the signed SHA-256 webhook header.',
  );
export const draftRequestSchema = z.object({
  notes: requiredText(2000),
  audience: z.string().max(80).default('All members'),
  tone: z.enum(['hype', 'professional', 'reminder']).default('professional'),
});
export const draftResponseSchema = z.object({
  title: requiredText(10000).transform((value) => value.slice(0, 100)),
  body: requiredText(10000).transform((value) => value.slice(0, 3000)),
});
