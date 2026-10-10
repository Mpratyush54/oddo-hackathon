import { useCallback, useState } from 'react';
import {
  Badge,
  Button,
  CardHeader,
  Empty,
  Field,
  FinanceChart,
  Icon,
  Modal,
  PageHeader,
  SearchField,
  formValues,
} from '../components';
import { date, exportCSV, money, today, uid, useStore } from '../store';
import { useSession } from '../session';
import '../commerce-finance.css';
import type { Transaction } from '../store';

export function FinancePage() {
  const { data, update, toast } = useStore();
  const { can, user } = useSession();
  const viewAll = can('view_finance');
  const [rejecting, setRejecting] = useState<Transaction | null>(null);
  const [adding, setAdding] = useState(false),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState('All categories'),
    [status, setStatus] = useState('All transactions'),
    [period, setPeriod] = useState('semester'),
    [kind, setKind] = useState('expense'),
    [receipt, setReceipt] = useState<File | null>(null),
    [compact, setCompact] = useState(false),
    [ledgerLayout, setLedgerLayout] = useState<'statement' | 'table'>('statement'),
    [descending, setDescending] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const close = useCallback(() => {
    setAdding(false);
    setReceipt(null);
    setError('');
  }, []);
  const periodRows = data.transactions.filter(
    (t) =>
      (viewAll || t.createdBy === user.id) &&
      (period === 'semester' || t.date.startsWith('2026-10')),
  );
  const approved = periodRows.filter((t) => t.status === 'Completed');
  const income = approved.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = -approved.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const balance = data.transactions
    .filter((t) => t.status === 'Completed')
    .reduce((s, t) => s + t.amount, 0);
  const filtered = periodRows
    .filter(
      (t) =>
        `${t.title} ${t.id}`.toLowerCase().includes(search.toLowerCase()) &&
        (category === 'All categories' || t.category === category) &&
        (status === 'All transactions' ||
          (status === 'Pending review' ? t.status === 'Pending' : t.status === status)),
    )
    .sort((a, b) => (descending ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  const sources = [
    ['Membership', 'teal'],
    ['Tickets', 'purple'],
    ['Merchandise', 'gold'],
    ['Fundraiser', 'green'],
  ].map(([name, tone]) => ({
    name,
    tone,
    amount: approved
      .filter((t) => t.category === name && t.amount > 0)
      .reduce((s, t) => s + t.amount, 0),
  }));
  const months = ['Aug', 'Sep', 'Oct']
    .map((label, i) => {
      const rows = approved.filter((t) => Number(t.date.slice(5, 7)) === i + 8);
      return {
        label,
        income: rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
        expense: -rows.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0),
      };
    })
    .filter((m) => period !== 'month' || m.label === 'Oct');
  const exportLedger = () =>
    exportCSV('skyline-ledger.csv', [
      ['ID', 'Description', 'Category', 'Amount (INR)', 'Date', 'Status', 'Receipt'],
      ...filtered.map((t) => [
        t.id,
        t.title,
        t.category,
        t.amount,
        t.date,
        t.status,
        t.receipt || '',
      ]),
    ]);
  const receiptLink = (t: Transaction) => {
    if (t.receiptData) {
      const a = document.createElement('a');
      a.href = t.receiptData;
      a.download = t.receipt || 'receipt';
      a.click();
    } else
      toast(
        'This seeded record has a sample receipt name. New expense requests can include a downloadable receipt.',
      );
  };
  const readFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  return (
    <>
      <PageHeader
        eyebrow="CLARITY FOR YOUR COMMUNITY"
        title={viewAll ? 'Every rupee, accounted for' : 'Your reimbursement requests'}
        description={
          viewAll
            ? 'A connected ledger, accountable approvals, and a clear balance.'
            : 'Submit your receipt and follow the review, without chasing the treasurer.'
        }
        action={
          <>
            <Button variant="secondary" icon="Download" onClick={exportLedger}>
              Export ledger
            </Button>
            <Button icon="Plus" onClick={() => setAdding(true)}>
              {viewAll ? 'Add transaction' : 'Request reimbursement'}
            </Button>
          </>
        }
      />
      {viewAll && (
        <>
          <section className="finance-hero dark-card">
            <div>
              <div className="hero-eyebrow">YOUR CLUB’S BIGGER PICTURE</div>
              <h2>Good plans start with a clear balance.</h2>
              <p>A healthy little foundation for your next big idea.</p>
            </div>
            <div className="finance-hero-stats">
              <div>
                <span className="hero-icon">
                  <Icon name="Wallet" size={24} />
                </span>
                <span>
                  <small>Available balance · all time</small>
                  <strong>{money(balance)}</strong>
                </span>
              </div>
              <div>
                <span className="hero-icon">
                  <Icon name="ArrowDownLeft" size={24} />
                </span>
                <span>
                  <small>Money in · {period === 'month' ? 'October' : 'semester'}</small>
                  <strong>{money(income)}</strong>
                </span>
              </div>
              <div>
                <span className="hero-icon">
                  <Icon name="ArrowUpRight" size={24} />
                </span>
                <span>
                  <small>Money out · {period === 'month' ? 'October' : 'semester'}</small>
                  <strong>{money(expense)}</strong>
                </span>
              </div>
            </div>
          </section>
          <div className="finance-charts">
            <section className="card income-chart-card">
              <CardHeader
                title="The flow of things"
                subtitle="Income and expenses, side by side."
                action={
                  <select
                    aria-label="Financial period"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option value="semester">This semester</option>
                    <option value="month">October 2026</option>
                  </select>
                }
              />
              <div className="light-chart-legend">
                <span>
                  <i className="legend-dot teal" />
                  Money in
                </span>
                <span>
                  <i className="legend-dot gold" />
                  Money out
                </span>
              </div>
              <FinanceChart values={months} dark={false} />
            </section>
            <section className="card income-breakdown">
              <CardHeader title="Where it comes from" subtitle="Every contribution counts." />
              <div className="source-list">
                {sources.map((s) => (
                  <div key={s.name}>
                    <div>
                      <span className={`legend-dot ${s.tone}`} />
                      <span>{s.name}</span>
                      <strong>{money(s.amount)}</strong>
                    </div>
                    <div className={`source-bar ${s.tone}`}>
                      <span style={{ width: `${(s.amount / Math.max(income, 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
      <section className="card table-card ledger-card">
        <div className="table-toolbar">
          <div className="segmented">
            {['All transactions', 'Completed', 'Pending review', 'Rejected'].map((s) => (
              <button
                key={s}
                className={status === s ? 'selected' : ''}
                onClick={() => setStatus(s)}
              >
                {s}
                {s === 'Pending review' && (
                  <span>{periodRows.filter((t) => t.status === 'Pending').length}</span>
                )}
              </button>
            ))}
          </div>
          <div className="table-tools">
            <SearchField value={search} onChange={setSearch} placeholder="Search the ledger..." />
            <select
              aria-label="Transaction category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                'All categories',
                'Membership',
                'Tickets',
                'Merchandise',
                'Fundraiser',
                'Expenses',
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button
              className={`icon-button ${ledgerLayout === 'statement' ? 'selected' : ''}`}
              title="Statement timeline artifact"
              aria-label="Statement timeline artifact"
              onClick={() => setLedgerLayout('statement')}
            >
              <Icon name="FileText" size={18} />
            </button>
            <button
              className={`icon-button ${ledgerLayout === 'table' ? 'selected' : ''}`}
              title="Table grid view"
              aria-label="Table grid view"
              onClick={() => setLedgerLayout('table')}
            >
              <Icon name="Columns3" size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Toggle table density"
              onClick={() => setCompact(!compact)}
            >
              <Icon name="Rows3" size={18} />
            </button>
          </div>
        </div>

        {ledgerLayout === 'statement' ? (
          <div className="statement-artifact">
            <div className="statement-artifact-header">
              <div className="statement-club-stamp">
                <span className="statement-stamp-badge">OFFICIAL STATEMENT</span>
                <h3>Campus Treasury · Activity Statement</h3>
                <small>Generated for {period === 'month' ? 'October 2026' : 'Academic Semester 2026–27'}</small>
              </div>
              <div className="statement-net-summary">
                <small>Net Activity</small>
                <strong className={income - expense >= 0 ? 'amount-in' : 'amount-out'}>
                  {money(income - expense)}
                </strong>
              </div>
            </div>

            <div className="statement-timeline">
              {filtered.map((t, idx) => (
                <article className="statement-item" key={t.id}>
                  <div className="statement-item-date">
                    <strong>{new Date(`${t.date}T12:00:00`).getDate()}</strong>
                    <small>{date(t.date, { month: 'short' }).toUpperCase()}</small>
                  </div>
                  <div className="statement-item-bullet">
                    <span className={`statement-dot ${t.amount < 0 ? 'out' : 'in'}`} />
                    {idx !== filtered.length - 1 && <span className="statement-line" />}
                  </div>
                  <div className="statement-item-body">
                    <div className="statement-item-main">
                      <div className="statement-item-title-row">
                        <h4>{t.title}</h4>
                        <Badge
                          tone={
                            t.category === 'Tickets'
                              ? 'purple'
                              : t.category === 'Merchandise'
                                ? 'gold'
                                : t.category === 'Fundraiser'
                                  ? 'green'
                                  : t.category === 'Expenses'
                                    ? 'neutral'
                                    : 'teal'
                          }
                        >
                          {t.category}
                        </Badge>
                      </div>
                      <div className="statement-item-meta">
                        <span>Ref: {t.id}</span>
                        {t.eventId && (
                          <span>
                            Event: {data.events.find((e) => e.id === t.eventId)?.title || 'Linked event'}
                          </span>
                        )}
                        {t.receipt && (
                          <button
                            type="button"
                            className="statement-receipt-tag"
                            onClick={() => receiptLink(t)}
                          >
                            <Icon name="Paperclip" size={13} /> {t.receipt}
                          </button>
                        )}
                        {t.rejectionReason && (
                          <span className="rejection-note">Note: {t.rejectionReason}</span>
                        )}
                      </div>
                    </div>
                    <div className="statement-item-side">
                      <strong className={`statement-amount ${t.amount < 0 ? 'amount-out' : 'amount-in'}`}>
                        {t.amount > 0 ? '+' : '−'}{money(Math.abs(t.amount))}
                      </strong>
                      <Badge
                        tone={
                          t.status === 'Completed'
                            ? 'green'
                            : t.status === 'Rejected'
                              ? 'neutral'
                              : 'gold'
                        }
                      >
                        {t.status}
                      </Badge>
                      {t.status === 'Pending' && can('approve_expense') && (
                        <div className="review-actions" style={{ marginTop: '8px' }}>
                          <Button
                            variant="secondary"
                            icon="Check"
                            disabled={t.createdBy === user.id}
                            onClick={() => {
                              if (!can('approve_expense') || t.createdBy === user.id) {
                                toast('A different treasurer must review your own request.');
                                return;
                              }
                              update((d) => ({
                                ...d,
                                transactions: d.transactions.map((tx) =>
                                  tx.id === t.id &&
                                  tx.status === 'Pending' &&
                                  tx.createdBy !== user.id
                                    ? { ...tx, status: 'Completed', reviewedBy: user.id }
                                    : tx,
                                ),
                              }));
                              toast('Expense approved and recorded in the balance.');
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={t.createdBy === user.id}
                            onClick={() => setRejecting(t)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className={compact ? 'compact' : ''}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>
                    <button className="table-sort" onClick={() => setDescending(!descending)}>
                      Date
                      <Icon name="ArrowDownUp" size={12} />
                    </button>
                  </th>
                  <th className="numeric">Amount</th>
                  <th>Receipt</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="transaction-cell">
                        <span className={`transaction-icon ${t.amount < 0 ? 'expense' : 'income'}`}>
                          <Icon name={t.amount < 0 ? 'ArrowUpRight' : 'ArrowDownLeft'} size={18} />
                        </span>
                        <span>
                          <strong>{t.title}</strong>
                          <small>
                            {t.id}
                            {t.eventId
                              ? ` · ${data.events.find((e) => e.id === t.eventId)?.title || 'Linked event'}`
                              : ''}
                          </small>
                          {t.rejectionReason && (
                            <small className="rejection-note">Reason: {t.rejectionReason}</small>
                          )}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge
                        tone={
                          t.category === 'Tickets'
                            ? 'purple'
                            : t.category === 'Merchandise'
                              ? 'gold'
                              : t.category === 'Fundraiser'
                                ? 'green'
                                : t.category === 'Expenses'
                                  ? 'neutral'
                                  : 'teal'
                        }
                      >
                        {t.category}
                      </Badge>
                    </td>
                    <td>{date(t.date, { day: 'numeric', month: 'short' })}</td>
                    <td className={`numeric ${t.amount < 0 ? 'amount-out' : 'amount-in'}`}>
                      {t.amount > 0 ? '+' : '−'}
                      {money(Math.abs(t.amount))}
                    </td>
                    <td>
                      {t.receipt ? (
                        <button
                          className="plain-icon receipt-button"
                          onClick={() => receiptLink(t)}
                          title={t.receipt}
                          aria-label={`Download receipt for ${t.title}`}
                        >
                          <Icon name="Paperclip" size={18} />
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <Badge
                        tone={
                          t.status === 'Completed'
                            ? 'green'
                            : t.status === 'Rejected'
                              ? 'neutral'
                              : 'gold'
                        }
                      >
                        {t.status}
                      </Badge>
                    </td>
                    <td>
                      {t.status === 'Pending' && can('approve_expense') && (
                        <div className="review-actions">
                          <Button
                            variant="secondary"
                            icon="Check"
                            disabled={t.createdBy === user.id}
                            onClick={() => {
                              if (!can('approve_expense') || t.createdBy === user.id) {
                                toast('A different treasurer must review your own request.');
                                return;
                              }
                              update((d) => ({
                                ...d,
                                transactions: d.transactions.map((tx) =>
                                  tx.id === t.id &&
                                  tx.status === 'Pending' &&
                                  tx.createdBy !== user.id
                                    ? { ...tx, status: 'Completed', reviewedBy: user.id }
                                    : tx,
                                ),
                              }));
                              toast('Expense approved and recorded in the balance.');
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={t.createdBy === user.id}
                            onClick={() => setRejecting(t)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {t.status === 'Pending' && t.createdBy === user.id && (
                        <small className="cell-subtext">Awaiting another reviewer</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!filtered.length && (
          <Empty
            title="The books are quiet here"
            description="No transactions match these filters."
          />
        )}
        <div className="table-footer">
          <span>
            {filtered.length} transactions · Pending expenses are excluded from the balance
          </span>
          <span className="ledger-total">
            Filtered net:{' '}
            <strong>
              {money(
                filtered.filter((t) => t.status === 'Completed').reduce((s, t) => s + t.amount, 0),
              )}
            </strong>
          </span>
        </div>
      </section>
      <div className="info-banner">
        <Icon name="ShieldCheck" size={25} />
        <div>
          <strong>A little transparency goes a long way.</strong>
          <p>
            Every ticket, membership, and merchandise payment is recorded here. Reimbursements
            affect your balance once approved.
          </p>
        </div>
      </div>
      {adding && (
        <Modal
          title="Keep the books connected"
          description="A little record today saves a lot of chasing later."
          onClose={close}
          wide
        >
          <form
            onSubmit={async (e) => {
              const f = formValues(e);
              if (kind === 'income' && !can('record_income')) {
                setError('Your role cannot record income.');
                return;
              }
              if (kind === 'expense' && !receipt) {
                setError('Attach a receipt for this reimbursement request.');
                return;
              }
              setSaving(true);
              try {
                const receiptData = receipt ? await readFile(receipt) : undefined;
                const tx: Transaction = {
                  id: uid('TX'),
                  title: f.title.trim(),
                  category: kind === 'expense' ? 'Expenses' : f.category,
                  amount: Number(f.amount) * (kind === 'expense' ? -1 : 1),
                  date: f.date,
                  status: kind === 'expense' ? 'Pending' : 'Completed',
                  receipt: receipt?.name,
                  receiptData,
                  eventId: f.eventId || undefined,
                  createdBy: user.id,
                };
                update((d) => ({ ...d, transactions: [tx, ...d.transactions] }));
                close();
                toast(
                  kind === 'expense'
                    ? 'Expense request added. Ready for the treasurer’s review.'
                    : 'Income recorded. A little more clarity.',
                );
              } catch {
                setError('Could not read this receipt. Please try another file.');
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="segmented transaction-type">
              <button
                type="button"
                className={kind === 'expense' ? 'selected' : ''}
                onClick={() => setKind('expense')}
              >
                <Icon name="ArrowUpRight" size={16} />
                Request reimbursement
              </button>
              {can('record_income') && (
                <button
                  type="button"
                  className={kind === 'income' ? 'selected' : ''}
                  onClick={() => setKind('income')}
                >
                  <Icon name="ArrowDownLeft" size={16} />
                  Record income
                </button>
              )}
            </div>
            <Field label={kind === 'expense' ? 'What was the expense for?' : 'What came in?'}>
              <input
                name="title"
                required
                placeholder={
                  kind === 'expense'
                    ? 'e.g. Bake sale ingredients · Aisha'
                    : 'e.g. Bake sale proceeds'
                }
                maxLength={130}
              />
            </Field>
            <div className="form-two">
              <Field label="Amount (₹)">
                <input name="amount" type="number" min="1" step="1" required placeholder="0" />
              </Field>
              <Field label="Date">
                <input name="date" type="date" required defaultValue={today} max={today} />
              </Field>
            </div>
            {kind === 'income' && (
              <Field label="Category">
                <select name="category">
                  <option>Fundraiser</option>
                  <option>Membership</option>
                  <option>Tickets</option>
                  <option>Merchandise</option>
                </select>
              </Field>
            )}
            <Field
              label="Link to event (optional)"
              hint="Connects this entry to the event budget and actual report."
            >
              <select name="eventId">
                <option value="">General club finances</option>
                {data.events.map((e) => (
                  <option value={e.id} key={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={`Receipt ${kind === 'expense' ? '(required)' : '(optional)'}`}
              hint="PDF, PNG, or JPEG · up to 2 MB"
            >
              <div className="upload-zone">
                <Icon name={receipt ? 'FileCheck2' : 'CloudUpload'} size={29} />
                <strong>{receipt ? receipt.name : 'Choose a receipt to attach'}</strong>
                <span>
                  {receipt
                    ? `${Math.round(receipt.size / 1024)} KB · ready to attach`
                    : 'Click to browse your files'}
                </span>
                <input
                  aria-label="Upload receipt"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                      setError('Please choose a receipt smaller than 2 MB.');
                      setReceipt(null);
                      return;
                    }
                    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) {
                      setError('Please upload a PDF, PNG, or JPEG receipt.');
                      setReceipt(null);
                      return;
                    }
                    setReceipt(file);
                    setError('');
                  }}
                />
              </div>
            </Field>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <p className="form-note">
              {kind === 'expense'
                ? 'Reimbursement requests are marked pending until approved by the treasurer.'
                : 'Completed income is immediately included in the club balance.'}
            </p>
            <div className="form-footer">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} icon="Check">
                {saving
                  ? 'Saving…'
                  : kind === 'expense'
                    ? 'Create expense request'
                    : 'Record income'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {rejecting && (
        <Modal
          title="Reject reimbursement"
          description="Give the requester a clear reason and a way to correct it."
          onClose={() => setRejecting(null)}
        >
          <form
            onSubmit={(e) => {
              const f = formValues(e);
              if (!can('approve_expense') || rejecting.createdBy === user.id || !f.reason.trim())
                return;
              update((d) => ({
                ...d,
                transactions: d.transactions.map((t) =>
                  t.id === rejecting.id && t.status === 'Pending'
                    ? {
                        ...t,
                        status: 'Rejected',
                        reviewedBy: user.id,
                        rejectionReason: f.reason.trim(),
                      }
                    : t,
                ),
              }));
              setRejecting(null);
              toast('Request rejected with a reason. The balance is unchanged.');
            }}
          >
            <p>
              <strong>{rejecting.title}</strong> · {money(Math.abs(rejecting.amount))}
            </p>
            <Field label="Reason for rejection">
              <textarea
                name="reason"
                required
                minLength={5}
                rows={4}
                maxLength={400}
                placeholder="For example, the receipt amount does not match the request."
              />
            </Field>
            <div className="form-footer">
              <Button variant="secondary" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button type="submit">Reject request</Button>
            </div>
          </form>
        </Modal>
      )}
      {viewAll && (
        <section className="card audit-section">
          <CardHeader title="Review & activity history" subtitle="Who changed what, and when." />
          {data.audit.length ? (
            <div className="audit-list">
              {data.audit.slice(0, 12).map((a) => (
                <div key={a.id}>
                  <span className="icon-tile">
                    <Icon name="ShieldCheck" size={17} />
                  </span>
                  <span>
                    <strong>
                      {a.action} · {a.entity}
                    </strong>
                    <small>{a.detail}</small>
                    <small>
                      {a.actor} · {new Date(a.date).toLocaleString('en-IN')}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="History starts with your next action"
              description="Reviews and record changes appear here."
            />
          )}
        </section>
      )}
    </>
  );
}
