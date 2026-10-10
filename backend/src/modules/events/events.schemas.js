import { z } from 'zod';
import { entityId, requiredText } from '../../shared/request-validation.js';

const httpsUrl = z.url().refine((value) => value.startsWith('https://'), 'Use an HTTPS URL.');

export const saveEventSchema = z.object({
  event: z.object({
    id: entityId.optional(),
    title: requiredText(100),
    description: requiredText(5000),
    venue: requiredText(120),
    category: requiredText(40),
    date: z.iso.date(),
    time: z.iso.time({ precision: -1 }),
    endDate: z.iso.date().optional(),
    endTime: z.iso.time({ precision: -1 }).optional(),
    capacity: z.number().int().min(1).max(10000),
    price: z.number().nonnegative(),
    memberPrice: z.number().nonnegative(),
    image: z.union([httpsUrl, z.literal('')]).optional(),
    gallery: z.array(httpsUrl).max(3).optional(),
    budget: z.number().nonnegative().optional(),
    recap: z.string().max(2500).optional(),
  }),
});
export const createReviewSchema = z.object({
  eventId: entityId,
  rating: z.number().int().min(1).max(5),
  comment: requiredText(1500),
});
