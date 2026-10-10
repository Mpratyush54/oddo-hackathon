import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizeLedger,
  FinanceSummaryService,
} from '../../src/modules/finance/finance-summary.service.js';
import { FinanceAiService } from '../../src/modules/finance/finance-ai.service.js';
const row = (amount, category, status = 'Completed', date = '2026-10-01') => ({
  amount,
  category,
  status,
  date,
});
test('free AI explanations accept valid fenced JSON and reject truncated output', async () => {
  const facts = summarizeLedger([row(100, 'Membership')]);
  const ai = new FinanceAiService({
    env: { OPENROUTER_API_KEY: 'fixture' },
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.reasoning.effort, 'none');
      return Response.json({
        choices: [
          {
            message: {
              content:
                '```json\n{"summary":"The ledger records ₹100 of dues.","nextSteps":[]}\n```',
            },
          },
        ],
      });
    },
  });
  assert.equal((await ai.explain(facts)).aiAvailable, true);
  ai.fetchImpl = async () => Response.json({ choices: [{ message: { content: '{"summary":' } }] });
  assert.equal((await ai.explain(facts)).aiAvailable, false);
});
test('financial totals are calculated in paise, exclude pending/rejected and preserve opening balance', () => {
  const facts = summarizeLedger(
    [
      row(100, 'Membership', 'Completed', '2026-09-01'),
      row(0.1, 'Tickets'),
      row(0.2, 'Merchandise'),
      row(-50, 'Expenses'),
      row(-999, 'Expenses', 'Pending'),
      row(-999, 'Expenses', 'Rejected'),
    ],
    { from: '2026-10-01', to: '2026-10-31' },
  );
  assert.equal(facts.income, 30);
  assert.equal(facts.outgoings, 5000);
  assert.equal(facts.openingLedgerBalance, 10000);
  assert.equal(facts.closingLedgerBalance, 5030);
  assert.equal(facts.pendingExpenses.amount, 99900);
});
test('AI receives aggregates only and provider errors return a labelled ledger fallback', async () => {
  const facts = summarizeLedger([
    {
      ...row(500, 'Tickets'),
      title: 'Private name',
      receiptKey: 'private-s3-key',
      simulated: true,
    },
  ]);
  let body;
  const ai = new FinanceAiService({
    env: { OPENROUTER_API_KEY: 'fixture' },
    fetchImpl: async (url, options) => {
      body = options.body;
      return { ok: false };
    },
  });
  const result = await ai.explain(facts);
  assert.equal(result.aiAvailable, false);
  assert.ok(result.summary.includes('simulated'));
  assert.ok(!body.includes('Private name'));
  assert.ok(!body.includes('private-s3-key'));
  const live = new FinanceAiService({
    env: { OPENROUTER_API_KEY: 'fixture', OPENROUTER_MODEL: 'paid-model' },
    fetchImpl: () => {
      throw Error('Must not call paid model');
    },
  });
  assert.equal((await live.explain(facts)).aiAvailable, false);
});
test('finance explanations enforce club role before reading data or calling AI', async () => {
  let called = false;
  const service = new FinanceSummaryService({
    repo: {},
    domain: {
      roleFor: async () => 'member',
      load: async () => {
        called = true;
      },
    },
    explain: async () => {
      called = true;
    },
  });
  await assert.rejects(
    service.report('skyline', {}, { id: 'one' }),
    (error) => error.status === 403,
  );
  assert.equal(called, false);
});
