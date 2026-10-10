import { HttpError, timestamp, recordId } from '../../shared/records.js';
import { finance, requireRole } from '../../shared/authorization.js';
import { text, amount, eventFor } from '../../shared/validation.js';

export function handleFinance({ data, action, user, role, now, context, actor, args }) {
  let result = {};
  switch (action.type) {
    case 'expenses.create': {
      const value = amount(args.amount),
        receiptKey = text(args.receiptKey, 250);
      if (!receiptKey.startsWith(`skyline-campus/${action.clubId}/${user.id}/`))
        throw new HttpError(403, 'Receipt does not belong to this account and club.');
      if (args.eventId) eventFor(data, args.eventId);
      data.transactions.unshift({
        id: recordId('TX'),
        title: text(args.title, 160),
        category: 'Expenses',
        amount: -value,
        date: now,
        status: 'Pending',
        receipt: text(args.receipt, 120),
        receiptKey,
        eventId: args.eventId,
        createdBy: user.id,
      });
      break;
    }
    case 'expenses.review': {
      requireRole(role, finance);
      const tx = data.transactions.find((t) => t.id === args.transactionId);
      if (!tx) throw new HttpError(404, 'Expense not found.');
      if (tx.status !== 'Pending' || tx.amount >= 0)
        throw new HttpError(409, 'Only pending expenses can be reviewed.');
      if (tx.createdBy === user.id)
        throw new HttpError(403, 'Another treasurer must review your expense.');
      if (!['Completed', 'Rejected'].includes(args.status))
        throw new HttpError(400, 'Choose approve or reject.');
      tx.status = args.status;
      tx.reviewedBy = user.id;
      tx.reviewedAt = timestamp();
      if (args.status === 'Rejected') tx.rejectionReason = text(args.reason, 500);
      break;
    }
    case 'income.create': {
      requireRole(role, finance);
      data.transactions.unshift({
        id: recordId('TX'),
        title: text(args.title, 160),
        category: text(args.category, 40),
        amount: amount(args.amount),
        date: now,
        status: 'Completed',
        createdBy: user.id,
      });
      break;
    }
  }
  return { data, result };
}
