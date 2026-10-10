import { z } from 'zod';
import { requestKeySchema } from '../../../../shared/schemas.js';

export const actionRequestSchema = z.object({
  type: z.string().min(1).max(100),
  args: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: requestKeySchema,
});
