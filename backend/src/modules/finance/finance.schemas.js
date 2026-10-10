import { z } from 'zod';
import { entityId, requiredText, moneyAmount } from '../../shared/request-validation.js';

export const createExpenseSchema = z.object({
  title: requiredText(160),
  amount: moneyAmount,
  receipt: requiredText(120),
  receiptKey: requiredText(250),
  receiptCheckId: entityId.optional(),
  eventId: entityId.optional(),
});
export const reviewExpenseSchema = z.discriminatedUnion('status', [
  z.object({ transactionId: entityId, status: z.literal('Completed') }),
  z.object({ transactionId: entityId, status: z.literal('Rejected'), reason: requiredText(500) }),
]);
export const pendingExpenseSchema = z.object({
  status: z.literal('Pending'),
  amount: z.number().negative(),
});
export const receiptUploadSchema = z.object({
  contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
});
export const createIncomeSchema = z.object({
  title: requiredText(160),
  category: requiredText(40),
  amount: moneyAmount,
});
