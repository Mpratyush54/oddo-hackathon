import { z } from 'zod';
import { entityId, moneyAmount, requiredText } from '../../shared/request-validation.js';
export const startReceiptCheckSchema = z.strictObject({
  receiptKey: requiredText(500),
  amount: moneyAmount,
});
export const receiptClearanceSchema = z.strictObject({ reason: requiredText(500).min(10) });
export const receiptCheckIdSchema = entityId.startsWith('RECEIPT-');
