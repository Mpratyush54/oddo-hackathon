import { useState } from 'react';
import { backendPost } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { money } from '../../../shared/utils/format';
type Report = {
  summary: string;
  nextSteps: string[];
  aiAvailable: boolean;
  generatedAt: string;
  facts: {
    income: number;
    outgoings: number;
    closingLedgerBalance: number;
    incomeByCategory: Record<string, number>;
    testEntries: { count: number };
    pendingExpenses: { count: number; amount: number };
  };
};
export function FinanceExplanation({ clubId, month }: { clubId: string; month?: string }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState('');
  const explain = async () => {
    setOpen(true);
    setBusy(true);
    setReport(null);
    setError('');
    const period = month
      ? {
          from: month + '-01',
          to: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
            .toISOString()
            .slice(0, 10),
        }
      : {};
    try {
      setReport(await backendPost<Report>(`/clubs/${clubId}/finance/explain`, period));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Explanation unavailable.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="secondary" onClick={explain} disabled={busy}>
        Explain finances with AI
      </Button>
      {open && (
        <Modal title="Where the club’s money went" onClose={() => setOpen(false)} wide>
          {busy && <p role="status">Reading the club ledger and preparing an explanation…</p>}
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {report && (
            <>
              <div className="finance-tx-detail-grid">
                {Object.entries(report.facts.incomeByCategory).map(([category, value]) => (
                  <div key={category}>
                    <small>
                      {category === 'Membership'
                        ? 'Dues collected'
                        : category === 'Tickets'
                          ? 'Ticket income'
                          : category === 'Merchandise'
                            ? 'Merchandise income'
                            : 'Other income'}
                    </small>
                    <strong>{money(value / 100)}</strong>
                  </div>
                ))}
                <div>
                  <small>Total in</small>
                  <strong>{money(report.facts.income / 100)}</strong>
                </div>
                <div>
                  <small>Total out</small>
                  <strong>{money(report.facts.outgoings / 100)}</strong>
                </div>
                <div>
                  <small>Closing ledger balance</small>
                  <strong>{money(report.facts.closingLedgerBalance / 100)}</strong>
                </div>
              </div>
              <p className="form-note">
                Amounts come from the recorded ledger. Pending and rejected requests are excluded
                from completed totals.
              </p>
              {report.facts.testEntries.count > 0 && (
                <p className="form-note">
                  Includes {report.facts.testEntries.count} simulated/test entries. Those entries
                  represent no real funds.
                </p>
              )}
              <h3>
                {report.aiAvailable ? 'AI explanation' : 'Ledger explanation · AI unavailable'}
              </h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{report.summary}</p>
              <ul>
                {report.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p className="form-note">
                AI commentary is advisory; verify it against the figures and ledger. Expense
                approval alone does not confirm that a volunteer received a payout. Snapshot:{' '}
                {new Date(report.generatedAt).toLocaleString()}.
              </p>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
