import { z } from 'zod';
import { HttpError } from './records.js';

export const requiredText = (maximum = 100) => z.string().trim().min(1).max(maximum);
export const moneyAmount = z.number().positive().max(1000000);
export const entityId = requiredText(250);

/** Shared query contract for list endpoints: ?page=1&limit=8 */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

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

export function paginate(items, query, message = 'Check the page and limit values.') {
  const { page, limit } = parseRequest(pageQuerySchema, query, message);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(page, pages);
  const start = (current - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    page: current,
    limit,
    total,
    pages,
  };
}
