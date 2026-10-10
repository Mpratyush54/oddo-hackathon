import { parseRequest } from '../../shared/request-validation.js';
import {
  createExpenseSchema,
  reviewExpenseSchema,
  createIncomeSchema,
  pendingExpenseSchema,
} from './finance.schemas.js';
import { HttpError, timestamp, recordId } from '../../shared/records.js';
import { finance, requireRole } from '../../shared/authorization.js';
import { amount, eventFor } from '../../shared/validation.js';
import { ClubActionService } from '../clubs/club-action.service.js';

export class FinanceService extends ClubActionService {
  createExpense(input) {
    input = parseRequest(createExpenseSchema, input);

    const value = amount(input.amount),
      receiptKey = input.receiptKey;
    if (!receiptKey.startsWith(`skyline-campus/${this.clubId}/${this.user.id}/`))
      throw new HttpError(403, 'Receipt does not belong to this account and club.');
    if (input.eventId) eventFor(this.data, input.eventId);
    this.data.transactions.unshift({
      id: recordId('TX'),
      title: input.title,
      category: 'Expenses',
      amount: -value,
      date: this.now,
      status: 'Pending',
      receipt: input.receipt,
      receiptKey,
      receiptCheckId: input.receiptCheckId,
      eventId: input.eventId,
      createdBy: this.user.id,
    });

    return {};
  }

  reviewExpense(input) {
    input = parseRequest(reviewExpenseSchema, input);

    requireRole(this.role, ['admin']);
    const expense = this.data.transactions.find((t) => t.id === input.transactionId);
    if (!expense) throw new HttpError(404, 'Expense not found.');
    if (!pendingExpenseSchema.safeParse(expense).success)
      throw new HttpError(409, 'Only pending expenses can be reviewed.');
    if (expense.createdBy === this.user.id)
      throw new HttpError(403, 'Another club administrator must review your expense.');

    expense.status = input.status;
    expense.reviewedBy = this.user.id;
    expense.reviewedAt = timestamp();
    if (input.status === 'Rejected') expense.rejectionReason = input.reason;

    return {};
  }

  createIncome(input) {
    input = parseRequest(createIncomeSchema, input);

    requireRole(this.role, finance);
    this.data.transactions.unshift({
      id: recordId('TX'),
      title: input.title,
      category: input.category,
      amount: amount(input.amount),
      date: this.now,
      status: 'Completed',
      createdBy: this.user.id,
    });

    return {};
  }
}
