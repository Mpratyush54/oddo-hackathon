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
    projectId: entityId.optional(),
    eventId: entityId.optional(),
    due: z.iso.date(),
    priority: z.enum(['Low', 'Medium', 'High']).default('Medium'),
    status: taskStatusSchema,
  }),
});
export const claimTaskSchema = z.object({
  taskId: entityId,
});
export const saveProjectSchema = z.object({
  project: z.object({
    id: entityId.optional(),
    title: requiredText(120),
    description: z.string().max(2000).default(''),
    date: z.iso.date().optional(),
    icon: z.string().trim().max(40).optional(),
  }),
});
