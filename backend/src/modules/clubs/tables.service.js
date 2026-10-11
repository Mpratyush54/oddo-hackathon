import { paginate, parseRequest } from '../../shared/request-validation.js';
import { HttpError } from '../../shared/records.js';
import { visibleState } from './club.views.js';
import { z } from 'zod';

const tableNames = [
  'transactions',
  'members',
  'audit',
  'events',
  'tickets',
  'orders',
  'announcements',
  'waitlist',
  'products',
  'tasks',
  'deliveries',
];

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(5),
  q: z.string().trim().max(120).optional().default(''),
  status: z.string().trim().max(40).optional().default(''),
  category: z.string().trim().max(40).optional().default(''),
  action: z.string().trim().max(80).optional().default(''),
  entity: z.string().trim().max(80).optional().default(''),
});

function searchable(row) {
  return JSON.stringify(row).toLowerCase();
}

export class ClubTablesService {
  constructor({ domain }) {
    this.domain = domain;
  }

  async list(clubId, table, user, query) {
    if (!tableNames.includes(table)) throw new HttpError(404, 'Unknown table.');
    const role = await this.domain.roleFor(user, clubId);
    const current = await this.domain.load(clubId);
    const visible = visibleState(structuredClone(current.data), user, role);
    const { page, limit, q, status, category, action, entity } = parseRequest(
      listQuerySchema,
      query,
    );
    let rows = Array.isArray(visible[table]) ? [...visible[table]] : [];
    if (status && status !== 'All') rows = rows.filter((row) => row.status === status);
    if (category && category !== 'All') rows = rows.filter((row) => row.category === category);
    if (action && action !== 'All') rows = rows.filter((row) => row.action === action);
    if (entity && entity !== 'All') rows = rows.filter((row) => row.entity === entity);
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((row) => searchable(row).includes(needle));
    }
    if (['transactions', 'audit', 'orders', 'tickets', 'announcements'].includes(table)) {
      rows.sort((a, b) =>
        String(b.date || b.joined || b.createdAt || b.id).localeCompare(
          String(a.date || a.joined || a.createdAt || a.id),
        ),
      );
    }
    const sliced = paginate(rows, { page, limit });
    return {
      rows: sliced.items,
      page: sliced.page,
      limit: sliced.limit,
      total: sliced.total,
      pages: sliced.pages,
      table,
    };
  }
}
