import test from 'node:test';
import assert from 'node:assert/strict';
import {
  digitsSchema,
  promoCodeSchema,
  requestKeySchema,
  phoneSchema,
  graphVersionSchema,
  normalizePhone,
} from '../../../shared/schemas.js';
import { FinanceService } from '../../src/modules/finance/finance.service.js';

test('shared format schemas reject punctuation and malformed formats', () => {
  for (const [schema, accepted, rejected] of [
    [digitsSchema, '12345', ['1.2', '-12', '١٢', '']],
    [promoCodeSchema, 'WELCOME10', ['welcome10', 'SAVE!', 'A']],
    [requestKeySchema, 'request-123_abc', ['bad!request', 'short']],
    [phoneSchema, '+919876543210', ['919876543210', '+0123456789', '+123']],
    [graphVersionSchema, 'v25.0', ['v25x0', '25.0', 'v.0']],
  ]) {
    assert.equal(schema.safeParse(accepted).success, true);
    for (const value of rejected) assert.equal(schema.safeParse(value).success, false, value);
  }
  assert.equal(normalizePhone('+91 (98765) 43210'), '919876543210');
});

test('finance methods validate direct calls before mutating their supplied state', () => {
  const data = { transactions: [], events: [] };
  const service = new FinanceService({
    data,
    user: { id: 'USR-one' },
    role: 'treasurer',
    clubId: 'skyline',
    now: '2026-10-10',
  });
  assert.throws(
    () => service.createIncome({ title: 'Donation', category: 'Donations', amount: '100' }),
    (error) => error.status === 400 && error.details[0].field === 'amount',
  );
  assert.throws(
    () => service.reviewExpense({ transactionId: 'TX-one', status: 'Rejected' }),
    (error) => error.status === 400,
  );
  assert.deepEqual(data.transactions, []);
  data.transactions.push({
    id: 'TX-income',
    status: 'Pending',
    amount: 100,
    createdBy: 'USR-other',
  });
  assert.throws(
    () => service.reviewExpense({ transactionId: 'TX-income', status: 'Completed' }),
    (error) => error.status === 409,
  );
  assert.equal(data.transactions[0].status, 'Pending');
});
