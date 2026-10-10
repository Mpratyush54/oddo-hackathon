import { z } from 'zod';
import { optionalPhoneSchema } from '../../../../shared/schemas.js';
import { entityId } from '../../shared/request-validation.js';

export const preferencesRequestSchema = z.object({
  phone: optionalPhoneSchema.optional(),
  whatsappOptIn: z.boolean().optional(),
  preferences: z
    .object({
      email: z.boolean(),
      renewals: z.boolean(),
      weekly: z.boolean(),
      events: z.boolean().optional(),
    })
    .optional(),
});
export const readNotificationsSchema = z.object({ ids: z.array(entityId).max(100) });
