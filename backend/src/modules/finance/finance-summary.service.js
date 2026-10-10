import { z } from 'zod';
import { parseRequest } from '../../shared/request-validation.js';
import { finance, requireRole } from '../../shared/authorization.js';
import { timestamp } from '../../shared/records.js';

export const financePeriodSchema = z
  .strictObject({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    'Start date must precede end date.',
  );

const paise = (amount) => Math.round(amount * 100);
export function summarizeLedger(transactions, period = {}) {
  const rows = transactions.filter(
    (row) => (!period.from || row.date >= period.from) && (!period.to || row.date <= period.to),
  );
  const completed = rows.filter((row) => row.status === 'Completed');
  const incoming = completed.filter((row) => row.amount > 0);
  const outgoing = completed.filter((row) => row.amount < 0);
  const total = (records) => records.reduce((sum, row) => sum + paise(row.amount), 0);
  const pending = rows.filter((row) => row.status === 'Pending' && row.amount < 0);
  const approvedExpenses = outgoing.filter((row) => row.category === 'Expenses');
  const categories = ['Membership', 'Tickets', 'Merchandise'];
  const testEntries = completed.filter((row) => row.simulated === true);
  return {
    currency: 'INR',
    unit: 'paise',
    income: total(incoming),
    outgoings: -total(outgoing),
    netMovement: total(completed),
    closingLedgerBalance: total(
      transactions.filter(
        (row) => row.status === 'Completed' && (!period.to || row.date <= period.to),
      ),
    ),
    openingLedgerBalance: period.from
      ? total(transactions.filter((row) => row.status === 'Completed' && row.date < period.from))
      : 0,
    incomeByCategory: Object.fromEntries(
      [...categories, 'Other'].map((category) => [
        category,
        total(
          incoming.filter((row) =>
            category === 'Other' ? !categories.includes(row.category) : row.category === category,
          ),
        ),
      ]),
    ),
    approvedExpenses: {
      count: approvedExpenses.length,
      amount: -total(approvedExpenses),
      missingReceiptCount: approvedExpenses.filter((row) => !row.receiptKey && !row.receiptData)
        .length,
    },
    pendingExpenses: { count: pending.length, amount: -total(pending) },
    rejectedCount: rows.filter((row) => row.status === 'Rejected').length,
    completedCount: completed.length,
    testEntries: { count: testEntries.length, netMovement: total(testEntries) },
  };
}

export class FinanceSummaryService {
  constructor({ repo, domain, explain }) {
    Object.assign(this, { repo, domain, explain });
  }
  async report(clubId, input, user) {
    requireRole(await this.domain.roleFor(user, clubId), finance);
    const period = parseRequest(financePeriodSchema, input);
    const current = await this.domain.load(clubId);
    const facts = summarizeLedger(current.data.transactions, period);
    await this.repo.limit('AI_FINANCE#' + clubId, 20, 86400);
    const explanation = await this.explain(facts);
    return {
      clubId,
      period,
      version: current.version,
      generatedAt: timestamp(),
      facts,
      ...explanation,
    };
  }
}
