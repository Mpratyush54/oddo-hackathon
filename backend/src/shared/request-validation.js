import { z } from 'zod';
import { HttpError } from './records.js';

export const requiredText = (maximum = 100) => z.string().trim().min(1).max(maximum);
export const moneyAmount = z.number().positive().max(1000000);
export const entityId = requiredText(250);

export function parseRequest(schema, value, message = 'Check the submitted fields.') {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const error = new HttpError(400, message);
  error.details = parsed.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
  throw error;
}
