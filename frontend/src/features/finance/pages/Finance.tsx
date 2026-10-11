import { useCallback, useState } from 'react';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { Field } from '../../../shared/ui/Field';
import { Icon } from '../../../shared/ui/Icon';
import { Modal } from '../../../shared/ui/Modal';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { SearchField } from '../../../shared/ui/SearchField';
import { TablePager } from '../../../shared/ui/TablePager';
import { formValues } from '../../../shared/ui/formValues';
import { date, exportCSV, money, today, uid } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import { backendPost, backendRequest, cloudMode } from '../../../shared/api/client';
import { useServerTable } from '../../../shared/hooks/useServerTable';
import { Revealed } from '../../../shared/components/PageMotion';
import { FinanceAnalytics } from '../components/FinanceAnalytics';
import { ReceiptCheckPanel, type ReceiptCheck } from '../components/ReceiptCheckPanel';
import { ReceiptReviewQueue } from '../components/ReceiptReviewQueue';
import { FinanceExplanation } from '../components/FinanceExplanation';
import '../styles/finance.css';
import type { Transaction } from '../../../shared/types/domain';

export function FinancePage() {
  const { data, update, applyServerPatch, toast } = useStore();
  const { can, user, clubId } = useSession();
  const viewAll = can('view_finance');
  const [rejecting, setRejecting] = useState<Transaction | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<Transaction | null>(null);
  const [detail, setDetail] = useState<Transaction | null>(null);
  const canApprove = can('approve_expense');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [claimedAmount, setClaimedAmount] = useState('');
  const [receiptCheck, setReceiptCheck] = useState<ReceiptCheck | null>(null);
  const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
    .format(new Date())
    .slice(0, 7);
  const [adding, setAdding] = useState(false),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState('All categories'),
    [status, setStatus] = useState('All transactions'),
    [period, setPeriod] = useState('semester'),
    [kind, setKind] = useState('expense'),
    [receipt, setReceipt] = useState<File | null>(null),
    [descending, setDescending] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const close = useCallback(() => {
    setAdding(false);
    setReceipt(null);
    setReceiptCheck(null);
    setClaimedAmount('');
    setError('');
  }, []);
  const periodRows = data.transactions.filter(
    (t) =>
      (viewAll || t.createdBy === user.id) &&
      (period === 'semester' || t.date.startsWith(currentMonth)),
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
  const ledger = useServerTable<Transaction>({
    clubId,
    table: 'transactions',
    localRows: filtered,
    query: search,
    status: status === 'All transactions' ? '' : status === 'Pending review' ? 'Pending' : status,
    category: category === 'All categories' ? '' : category,
    limit: 5,
  });
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
  const reviewExpense = async (
    transaction: Transaction,
    status: 'Completed' | 'Rejected',
    reason?: string,
  ) => {
    if (!canApprove || transaction.createdBy === user.id || reviewingId) return false;
    setReviewingId(transaction.id);
    try {
      if (cloudMode) {
        const result = await backendPost<{ state: Partial<typeof data> }>(
          `/clubs/${clubId}/actions`,
          {
            type: 'expenses.review',
            args: { transactionId: transaction.id, status, reason },
            idempotencyKey: crypto.randomUUID(),
          },
        );
        applyServerPatch(clubId, result.state);
      } else {
        update((current) => ({
          ...current,
          transactions: current.transactions.map((entry) =>
            entry.id === transaction.id
              ? { ...entry, status, reviewedBy: user.id, rejectionReason: reason }
              : entry,
          ),
        }));
      }
      toast(
        status === 'Completed'
          ? 'Expense approved and recorded in the ledger.'
          : 'Request rejected with a reason.',
      );
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Expense review failed.');
      return false;
    } finally {
      setReviewingId(null);
    }
  };
  const receiptLink = (t: Transaction) => {
    setPreviewReceipt(t);
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
        eyebrow="FINANCES"
        title={viewAll ? 'Club ledger' : 'Your reimbursements'}
        description={
          viewAll
            ? canApprove
              ? 'Overall and event analytics, ledger review, and expense approvals.'
              : 'Overall and event analytics plus the ledger. Club admins approve pending expenses.'
            : 'Submit a receipt and track review status.'
        }
        action={
          <>
            <Button variant="secondary" icon="Download" onClick={exportLedger}>
              Export CSV
            </Button>
            {cloudMode && viewAll && (
              <FinanceExplanation
                key={`${clubId}:${period}`}
                clubId={clubId}
                month={period === 'month' ? currentMonth : undefined}
              />
            )}
            <Button icon="Plus" onClick={() => setAdding(true)}>
              {viewAll ? 'Add transaction' : 'Request reimbursement'}
            </Button>
          </>
        }
      />
      {viewAll && (
        <>
          <Revealed>
            <div className="finance-summary-strip">
              <div>
                <small>Balance</small>
                <strong>{money(balance)}</strong>
              </div>
              <div>
                <small>In · {period === 'month' ? 'this month' : 'all time'}</small>
                <strong className="amount-in">{money(income)}</strong>
              </div>
              <div>
                <small>Out · {period === 'month' ? 'this month' : 'all time'}</small>
                <strong className="amount-out">{money(expense)}</strong>
              </div>
              <div>
                <small>Pending review</small>
                <strong>{periodRows.filter((t) => t.status === 'Pending').length}</strong>
              </div>
              <label className="finance-period-select">
                <span className="sr-only">Period</span>
                <select
                  aria-label="Financial period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="semester">All time</option>
                  <option value="month">This month</option>
                </select>
              </label>
            </div>
          </Revealed>
          <Revealed delay={40}>
            <FinanceAnalytics data={data} periodRows={periodRows} period={period} />
          </Revealed>
          {cloudMode && (
            <ReceiptReviewQueue
              key={clubId}
              clubId={clubId}
              userId={user.id}
              canClear={canApprove}
            />
          )}
        </>
      )}
      <Revealed delay={80}>
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
              <SearchField value={search} onChange={setSearch} placeholder="Search ledger…" />
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
            </div>
          </div>

          <div className="table-scroll">
            <table>
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
                {ledger.rows.map((t) => (
                  <tr key={t.id} className={t.amount < 0 ? 'expense-row' : 'income-row'}>
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
                      <div className="ledger-row-actions">
                        <Button variant="secondary" onClick={() => setDetail(t)}>
                          View
                        </Button>
                        {t.status === 'Pending' && canApprove && (
                          <>
                            <Button
                              variant="secondary"
                              icon="Check"
                              disabled={
                                !!reviewingId ||
                                t.createdBy === user.id ||
                                (cloudMode && !t.receiptCheckId)
                              }
                              onClick={() => void reviewExpense(t, 'Completed')}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={!!reviewingId || t.createdBy === user.id}
                              onClick={() => setRejecting(t)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {t.status === 'Pending' && !canApprove && viewAll && (
                          <small className="cell-subtext">Awaiting club admin</small>
                        )}
                        {cloudMode && t.status === 'Pending' && !t.receiptCheckId && (
                          <small className="cell-subtext">
                            Requires resubmission after receipt checks
                          </small>
                        )}
                        {t.status === 'Pending' && t.createdBy === user.id && canApprove && (
                          <small className="cell-subtext">Awaiting another admin</small>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!ledger.rows.length && (
            <Empty title="No matching transactions" description="Try another filter or search." />
          )}
          <TablePager
            page={ledger.page}
            pages={ledger.pages}
            total={ledger.total}
            limit={ledger.limit}
            label="transactions"
            loading={ledger.loading}
            onPageChange={ledger.setPage}
          />
          <div className="table-footer">
            <span>
              Pending excluded from balance
              {!canApprove && viewAll ? ' · Approvals: club admin only' : ''}
            </span>
            <span className="ledger-total">
              Net:{' '}
              <strong>
                {money(
                  filtered
                    .filter((t) => t.status === 'Completed')
                    .reduce((s, t) => s + t.amount, 0),
                )}
              </strong>
            </span>
          </div>
        </section>
      </Revealed>
      {adding && (
        <Modal
          title={kind === 'expense' ? 'Request reimbursement' : 'Record income'}
          description={
            kind === 'expense'
              ? 'Check your receipt first, then submit for a separate expense approval.'
              : 'Completed income is added to the club balance immediately.'
          }
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
              if (
                cloudMode &&
                kind === 'expense' &&
                (receiptCheck?.status !== 'Ready' ||
                  !receiptCheck.receiptKey ||
                  receiptCheck.claimedAmount !== Math.round(Number(f.amount) * 100))
              ) {
                setError(
                  'Complete receipt checks and any administrator clearance before submitting for review.',
                );
                return;
              }
              setSaving(true);
              try {
                if (cloudMode) {
                  const receiptKey = kind === 'expense' ? receiptCheck?.receiptKey : undefined;
                  const result = await backendPost<{
                    state: Parameters<typeof applyServerPatch>[1];
                  }>(`/clubs/${clubId}/actions`, {
                    type: kind === 'expense' ? 'expenses.create' : 'income.create',
                    args: {
                      title: f.title.trim(),
                      amount: Number(f.amount),
                      category: f.category,
                      eventId: f.eventId || undefined,
                      receipt: kind === 'expense' ? receipt?.name : undefined,
                      receiptKey,
                      receiptCheckId: kind === 'expense' ? receiptCheck?.id : undefined,
                    },
                    idempotencyKey: crypto.randomUUID(),
                  });
                  applyServerPatch(clubId, result.state);
                  close();
                  toast('Saved to the shared club ledger.');
                  return;
                }
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
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not save this request.');
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
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  placeholder="0"
                  value={claimedAmount}
                  onChange={(e) => setClaimedAmount(e.target.value)}
                />
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
            {kind === 'expense' && (
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
            )}
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            {cloudMode && kind === 'expense' && (
              <ReceiptCheckPanel
                clubId={clubId}
                file={receipt}
                amount={claimedAmount}
                onChecked={setReceiptCheck}
              />
            )}
            <p className="form-note">
              {kind === 'expense'
                ? 'Pending until a club administrator approves. Treasurers can view, not approve.'
                : 'Income is included in the balance as soon as you save.'}
            </p>
            <div className="form-footer">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  saving || (cloudMode && kind === 'expense' && receiptCheck?.status !== 'Ready')
                }
                icon="Check"
              >
                {saving
                  ? 'Saving…'
                  : kind === 'expense'
                    ? 'Submit for expense review'
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
            onSubmit={async (e) => {
              const f = formValues(e);
              if (!f.reason.trim()) return;
              if (await reviewExpense(rejecting, 'Rejected', f.reason.trim())) setRejecting(null);
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
              <Button type="submit" disabled={!!reviewingId}>
                Reject request
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal
          title="Transaction details"
          description={`${detail.id} · ${date(detail.date)}`}
          onClose={() => setDetail(null)}
          wide
        >
          <div className="finance-tx-detail">
            <div className="finance-tx-detail-hero">
              <div>
                <small>{detail.category}</small>
                <h3>{detail.title}</h3>
              </div>
              <strong className={detail.amount < 0 ? 'amount-out' : 'amount-in'}>
                {detail.amount > 0 ? '+' : '−'}
                {money(Math.abs(detail.amount))}
              </strong>
            </div>
            <dl className="finance-tx-detail-grid">
              <div>
                <dt>Status</dt>
                <dd>
                  <Badge
                    tone={
                      detail.status === 'Completed'
                        ? 'green'
                        : detail.status === 'Rejected'
                          ? 'neutral'
                          : 'gold'
                    }
                  >
                    {detail.status}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{date(detail.date)}</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>
                  <code>{detail.id}</code>
                </dd>
              </div>
              <div>
                <dt>Created by</dt>
                <dd>
                  {detail.createdBy
                    ? data.members.find(
                        (m) => m.userId === detail.createdBy || m.id === detail.createdBy,
                      )?.name || detail.createdBy
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Reviewed by</dt>
                <dd>
                  {detail.reviewedBy
                    ? data.members.find(
                        (m) => m.userId === detail.reviewedBy || m.id === detail.reviewedBy,
                      )?.name || detail.reviewedBy
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Linked event</dt>
                <dd>
                  {detail.eventId
                    ? data.events.find((e) => e.id === detail.eventId)?.title || detail.eventId
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Receipt</dt>
                <dd>{detail.receipt || 'None attached'}</dd>
              </div>
              {detail.rejectionReason && (
                <div className="finance-tx-detail-wide">
                  <dt>Rejection reason</dt>
                  <dd className="rejection-note">{detail.rejectionReason}</dd>
                </div>
              )}
            </dl>
            <div className="finance-tx-detail-actions">
              {(detail.receipt || detail.receiptData || detail.receiptKey) && (
                <Button
                  variant="secondary"
                  icon="Paperclip"
                  onClick={() => {
                    setPreviewReceipt(detail);
                    setDetail(null);
                  }}
                >
                  Open receipt
                </Button>
              )}
              {detail.status === 'Pending' && canApprove && detail.createdBy !== user.id && (
                <>
                  <Button
                    icon="Check"
                    disabled={!!reviewingId || (cloudMode && !detail.receiptCheckId)}
                    onClick={async () => {
                      if (await reviewExpense(detail, 'Completed')) setDetail(null);
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRejecting(detail);
                      setDetail(null);
                    }}
                  >
                    Reject
                  </Button>
                </>
              )}
              <Button variant="secondary" onClick={() => setDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {previewReceipt && (
        <Modal
          title={`Receipt voucher: ${previewReceipt.receipt || previewReceipt.id}`}
          description={`Transaction ${previewReceipt.id} · ${date(previewReceipt.date)}`}
          onClose={() => setPreviewReceipt(null)}
        >
          <div className="receipt-voucher-preview">
            <div className="voucher-header">
              <span className="voucher-stamp">OFFICIALLY RECORDED</span>
              <h3>{previewReceipt.title}</h3>
              <p className="voucher-meta">
                Category: {previewReceipt.category} · Campus Community Ledger
              </p>
            </div>
            <div className="voucher-amount-row">
              <span>Recorded value:</span>
              <strong className={previewReceipt.amount < 0 ? 'amount-out' : 'amount-in'}>
                {previewReceipt.amount > 0 ? '+' : '−'}
                {money(Math.abs(previewReceipt.amount))}
              </strong>
            </div>
            <div className="voucher-details">
              <div className="voucher-detail-line">
                <span>Status:</span>
                <Badge tone={previewReceipt.status === 'Completed' ? 'green' : 'gold'}>
                  {previewReceipt.status}
                </Badge>
              </div>
              <div className="voucher-detail-line">
                <span>Reference ID:</span>
                <code>{previewReceipt.id}</code>
              </div>
              <div className="voucher-detail-line">
                <span>Receipt file:</span>
                <span>{previewReceipt.receipt || 'Standard digital invoice'}</span>
              </div>
            </div>
            <div className="voucher-mock-document">
              <Icon name="FileCheck2" size={36} />
              <div>
                <strong>Digital Proof of Expenditure & Voucher</strong>
                <p>
                  {cloudMode
                    ? 'Review the uploaded receipt before approving this expense.'
                    : 'Sample voucher for the local demonstration.'}
                </p>
              </div>
            </div>
            <div
              className="modal-actions"
              style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                marginTop: '16px',
              }}
            >
              <Button variant="secondary" onClick={() => setPreviewReceipt(null)}>
                Close
              </Button>
              <Button
                icon="Download"
                onClick={() => {
                  if (cloudMode) {
                    if (!previewReceipt.receiptKey) {
                      toast(
                        'This ledger entry has no uploaded receipt file — only a label from seed or older data.',
                      );
                      return;
                    }
                    void backendRequest<{ url: string }>(
                      `/clubs/${clubId}/receipts/${previewReceipt.id}`,
                    )
                      .then((result) => {
                        window.location.assign(result.url);
                      })
                      .catch((error) => toast(error.message));
                    return;
                  }
                  if (previewReceipt.receiptData) {
                    const a = document.createElement('a');
                    a.href = previewReceipt.receiptData;
                    a.download = previewReceipt.receipt || 'receipt';
                    a.click();
                  } else {
                    toast('This demo voucher has no attached receipt to download.');
                  }
                  setPreviewReceipt(null);
                }}
              >
                Download voucher copy
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
