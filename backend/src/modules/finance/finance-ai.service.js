import { z } from 'zod';
import { removeMarkdownFence } from '../communications/openrouter.service.js';

const explanationSchema = z.strictObject({
  summary: z.string().trim().min(1).max(2400),
  nextSteps: z.array(z.string().trim().min(1).max(350)).max(4),
});
const rupees = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value / 100);
export function ledgerExplanation(facts) {
  return {
    source: 'Ledger summary',
    summary: `The recorded ledger shows ${rupees(facts.income)} coming in and ${rupees(facts.outgoings)} going out in this period. The closing ledger balance is ${rupees(facts.closingLedgerBalance)}. There are ${facts.pendingExpenses.count} expenses awaiting review, totaling ${rupees(facts.pendingExpenses.amount)}; these are excluded from completed outgoings. Approved expenses are ledger records, not proof that a volunteer received a bank payout.${facts.testEntries.count ? ` This includes ${facts.testEntries.count} simulated or Razorpay test entries; those entries do not represent real money movement.` : ''}`,
    nextSteps: [
      ...(facts.pendingExpenses.count
        ? ['Review the outstanding expense requests and their receipts.']
        : []),
      ...(facts.approvedExpenses.missingReceiptCount
        ? ['Check approved expenses whose receipt file is missing.']
        : []),
      'Use the ledger transaction details to check each expense, submitter and supporting receipt.',
    ],
  };
}

export class FinanceAiService {
  constructor({ env, fetchImpl = fetch }) {
    Object.assign(this, { env, fetchImpl });
  }
  async explain(facts) {
    const fallback = ledgerExplanation(facts);
    const model = this.env.OPENROUTER_MODEL || 'openrouter/free';
    if (!this.env.OPENROUTER_API_KEY || (model !== 'openrouter/free' && !model.endsWith(':free')))
      return { ...fallback, aiAvailable: false };
    try {
      const response = await this.fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + this.env.OPENROUTER_API_KEY,
          'Content-Type': 'application/json',
          'X-OpenRouter-Title': 'Skyline Finance',
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 850,
          messages: [
            {
              role: 'system',
              content:
                'Explain this club ledger in plain language, using only supplied aggregate facts. All monetary values are INR paise: divide by 100 when describing rupees. Explain dues, tickets, merchandise, other income, outgoings, pending review and closing ledger balance. Opening balance plus net movement equals closing balance. Pending and rejected entries are not completed spending. Approved expenses do not prove a volunteer has received a bank payout. Simulated/test entries do not represent actual money; explicitly mention them when count is positive. Do not claim bank reconciliation, settlement, authenticity, fraud, or handover completion. Suggest checking receipts and pending requests where applicable. Return only a JSON object with summary (maximum 2400 characters) and nextSteps (up to four strings, maximum 350 characters each). Do not invent transactions, dates, people or policies.',
            },
            { role: 'user', content: JSON.stringify(facts) },
          ],
        }),
        signal: AbortSignal.timeout(18000),
      });
      if (!response.ok) return { ...fallback, aiAvailable: false };
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      if (typeof content !== 'string') return { ...fallback, aiAvailable: false };
      const parsed = explanationSchema.safeParse(JSON.parse(removeMarkdownFence(content)));
      if (!parsed.success) return { ...fallback, aiAvailable: false };
      return { ...parsed.data, source: 'OpenRouter AI explanation', aiAvailable: true };
    } catch {
      return { ...fallback, aiAvailable: false };
    }
  }
}
