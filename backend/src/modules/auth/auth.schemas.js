import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().max(128),
});
export const signupSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(80),
  password: z.string().min(12).max(128),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().max(128),
  password: z.string().min(12).max(128),
});
