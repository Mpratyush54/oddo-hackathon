import { z } from 'zod';
import { sha256Schema } from '../../../../shared/schemas.js';

export const id = z.string().min(1).max(250);
export const text = z.string().max(10000);
export const email = z.email().max(254);
export const date = z.iso.date();
export const time = z.iso.time({ precision: -1 });
export const hash256 = sha256Schema;
export const prefixedKey = (prefix) => id.startsWith(prefix).min(prefix.length + 1);
export const instant = z.iso.datetime({ offset: true });
export const nonnegative = z.number().finite().nonnegative();
export const count = z.number().int().nonnegative();
export const role = z.enum(['member', 'organizer', 'treasurer', 'admin', 'college']);
export const ttl = z.number().int().positive();
export const preferences = z.object({
  email: z.boolean(),
  renewals: z.boolean(),
  weekly: z.boolean(),
});
export const recordKeys = { pk: id, sk: id, schemaVersion: z.literal(1).optional() };
