import { z } from 'zod';
export const userLookupSchema = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase().trim()),
});
export const userUpdateSchema = z.strictObject({
  userId: z.string().min(1).max(250),
  role: z.enum(['member', 'organizer', 'treasurer', 'admin']),
  status: z.enum(['Active', 'Pending', 'Expiring', 'Expired']),
  course: z.string().trim().min(1).max(120),
  expires: z.iso.date(),
  memberRole: z.enum(['Member', 'Volunteer', 'Events lead', 'Treasurer', 'President']),
});
export const userRemoveSchema = z.strictObject({ userId: z.string().min(1).max(250) });
