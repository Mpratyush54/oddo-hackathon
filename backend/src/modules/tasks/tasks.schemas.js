import { z } from 'zod';
import { entityId, requiredText } from '../../shared/request-validation.js';

export const taskStatusSchema = z.enum(['To do', 'In progress', 'Done']);
export const updateOwnTaskSchema = z.object({
  task: z.object({ id: entityId, status: taskStatusSchema }),
});
export const saveTaskSchema = z.object({
  task: z.object({
    id: entityId.optional(),
    title: requiredText(160),
    description: z.string().max(2000).default(''),
    assignee: z.string().max(100).default(''),
    due: z.iso.date(),
    priority: z.enum(['Low', 'Medium', 'High']).default('Medium'),
    status: taskStatusSchema,
  }),
});
