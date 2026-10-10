import { z } from 'zod';
import { entityId } from '../../shared/request-validation.js';

export const addMemberSchema = z.object({
  member: z.object({
    email: z.email().max(254),
    course: z.string().max(100).optional(),
    status: z.enum(['Active', 'Pending', 'Expiring', 'Expired']).optional(),
    role: z.enum(['Member', 'Volunteer']).optional(),
  }),
});
export const joinMembershipSchema = z.object({ course: z.string().max(100).optional() });
export const payDemoDuesSchema = z.object({ memberId: entityId.optional() });
