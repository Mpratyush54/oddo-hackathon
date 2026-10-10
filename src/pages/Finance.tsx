import { useCallback, useState } from 'react';
import { Badge, Button, CardHeader, Empty, Field, FinanceChart, FormFooter, Icon, Modal, PageHeader, SearchField, formValues } from '../components';
import { date, exportCSV, money, today, uid, useStore } from '../store';
import type { Transaction } from '../store';

export function FinancePage() {
  const { data, update, toast } = useStore();
  const [adding, setAdding] = useState(false),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState('All categories'),
    [status, setStatus] = useState('All transactions'),
    [period, setPeriod] = useState('semester'),
    [kind, setKind] = useState('expense'),
    [receipt, setReceipt] = useState<File | null>(null),
    [compact, setCompact] = useState(false),
    [descending, setDescending] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const close = useCallback(() => { setAdding(false); setReceipt(null); setError(''); }, []);
  const periodRows = data.transactions.filter(t => period === 'semester' || t.date.startsWith('2026-10'));
  const approved = periodRows.filter(t => t.status === 'Completed');
  const income = approved.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = -approved.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const balance = data.transactions.filter(t => t.status === 'Completed').reduce((s, t) => s + t.amount, 0);
  const filtered = periodRows.filter(t => `${t.title} ${t.id}`.toLowerCase().includes(search.toLowerCase()) && (category === 'All categories' || t.category === category) && (status === 'All transactions' || (status === 'Pending review' ? t.status === 'Pending' : t.status === 'Completed'))).sort((a, b) => descending ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  const sources = [['Membership', 'teal'], ['Tickets', 'purple'], ['Merchandise', 'gold'], ['Fundraiser', 'green']].map(([name, tone]) => ({ name, tone, amount: approved.filter(t => t.category === name && t.amount > 0).reduce((s, t) => s + t.amount, 0) }));
  const months = ['Aug', 'Sep', 'Oct'].map((label, i) => {
    const rows = approved.filter(t => Number(t.date.slice(5, 7)) === i + 8);
    return { label, income: rows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), expense: -rows.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0) };
  }).filter(m => period !== 'month' || m.label === 'Oct');
  const exportLedger = () => exportCSV('skyline-ledger.csv', [['ID', 'Description', 'Category', 'Amount (INR)', 'Date', 'Status', 'Receipt'], ...filtered.map(t => [t.id, t.title, t.category, t.amount, t.date, t.status, t.receipt || ''])]);
  const receiptLink = (t: Transaction) => { if (t.receiptData) { const a = document.createElement('a'); a.href = t.receiptData; a.download = t.receipt || 'receipt'; a.click(); } else toast('This seeded record has a sample receipt name. New expense requests can include a downloadable receipt.'); };
  const readFile = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
  return <>
    <PageHeader eyebrow="CLARITY FOR YOUR COMMUNITY"
      title="Every rupee, accounted for"
      description="Know what came in, what went out, and what’s possible next."
      action={<>
        <Button variant="secondary" icon="Download" onClick={exportLedger}>Export ledger</Button>
        <Button icon="Plus" onClick={() => setAdding(true)}>Add transaction</Button></>} />
    <section className="finance-hero dark-card">
      <div><div className="hero-eyebrow">YOUR CLUB’S BIGGER PICTURE</div>
        <h2>Good plans start with a clear balance.</h2>
        <p>A healthy little foundation for your next big idea.</p>
      </div><div className="finance-hero-stats"><div>
        <span className="hero-icon"><Icon name="Wallet" size={24} /></span>
        <span><small>Available balance · all time</small>
          <strong>{money(balance)}</strong></span>
      </div><div><span className="hero-icon">
        <Icon name="ArrowDownLeft" size={24} /></span><span>
            <small>Money in · {period === 'month' ? 'October' : 'semester'}</small>
            <strong>{money(income)}</strong></span></div>
        <div><span className="hero-icon">
          <Icon name="ArrowUpRight" size={24} /></span><span>
            <small>Money out · {period === 'month' ? 'October' : 'semester'}</small>
            <strong>{money(expense)}</strong></span></div></div>
    </section><div className="finance-charts">
      <section className="card income-chart-card">
        <CardHeader title="The flow of things" subtitle="Income and expenses, side by side."
          action={<select aria-label="Financial period" value={period}
            onChange={e => setPeriod(e.target.value)}><option value="semester">This semester</option>
            <option value="month">October 2026</option></select>} />
        <div className="light-chart-legend"><span><i className="legend-dot teal" />Money in</span>
          <span><i className="legend-dot gold" />Money out</span>
        </div><FinanceChart values={months} dark={false} /></section>
      <section className="card income-breakdown">
        <CardHeader title="Where it comes from" subtitle="Every contribution counts." />
        <div className="source-list">{sources.map(s => <div key={s.name}><div>
          <span className={`legend-dot ${s.tone}`} /><span>{s.name}</span><strong>{money(s.amount)}</strong></div>
          <div className={`source-bar ${s.tone}`}><span style={{ width: `${s.amount / Math.max(income, 1) * 100}%` }} />
          </div></div>)}</div></section></div><section className="card table-card ledger-card">
      <div className="table-toolbar">
        <div className="segmented">{['All transactions', 'Completed', 'Pending review'].map(s =>
          <button key={s} className={status === s ? 'selected' : ''} onClick={() => setStatus(s)}>{s}{s === 'Pending review' &&
            <span>{periodRows.filter(t => t.status === 'Pending').length}</span>}</button>)}</div>
        <div className="table-tools"><SearchField value={search} onChange={setSearch} placeholder="Search the ledger..." />
          <select aria-label="Transaction category"
            value={category} onChange={e => setCategory(e.target.value)}>{['All categories', 'Membership', 'Tickets', 'Merchandise', 'Fundraiser', 'Expenses'].map(c => <option key={c}>{c}</option>)}</select><button className="icon-button" aria-label="Toggle table density" onClick={() => setCompact(!compact)}><Icon name="Rows3" size={18} /></button></div></div><div className="table-scroll">
        <table className={compact ? 'compact' : ''}><thead><tr><th>Description</th><th>Category</th><th><button className="table-sort" onClick={() => setDescending(!descending)}>Date<Icon name="ArrowDownUp" size={12} /></button></th><th className="numeric">Amount</th><th>Receipt</th><th>Status</th><th /></tr></thead><tbody>{filtered.map(t => <tr key={t.id}><td><div className="transaction-cell"><span className={`transaction-icon ${t.amount < 0 ? 'expense' : 'income'}`}><Icon name={t.amount < 0 ? 'ArrowUpRight' : 'ArrowDownLeft'} size={18} /></span><span><strong>{t.title}</strong><small>{t.id}</small></span></div></td><td><Badge tone={t.category === 'Tickets' ? 'purple' : t.category === 'Merchandise' ? 'gold' : t.category === 'Fundraiser' ? 'green' : t.category === 'Expenses' ? 'neutral' : 'teal'}>{t.category}</Badge></td><td>{date(t.date, { day: 'numeric', month: 'short' })}</td><td className={`numeric ${t.amount < 0 ? 'amount-out' : 'amount-in'}`}>{t.amount > 0 ? '+' : '−'}{money(Math.abs(t.amount))}</td><td>{t.receipt ? <button className="plain-icon receipt-button"
          onClick={() => receiptLink(t)} title={t.receipt} aria-label={`Download receipt for ${t.title}`}><Icon name="Paperclip" size={18} /></button> : <span className="muted">—</span>}</td><td><Badge tone={t.status === 'Completed' ? 'green' : 'gold'}>{t.status === 'Completed' ? 'Completed' : 'Pending'}</Badge></td><td>{t.status === 'Pending' && <Button variant="secondary" icon="Check" onClick={() => {
            update(d => ({ ...d, transactions: d.transactions.map(tx => tx.id === t.id ? { ...tx, status: 'Completed' } : tx) }));
            toast('Expense approved and recorded in your balance.');
          }}>Approve</Button>}</td></tr>)}</tbody></table></div>{!filtered.length && <Empty title="The books are quiet here" description="No transactions match these filters." />}
      <div className="table-footer"><span>{filtered.length} transactions · Pending expenses are excluded from the balance</span><span className="ledger-total">Filtered net: <strong>{money(filtered.filter(t => t.status === 'Completed').reduce((s, t) => s + t.amount, 0))}</strong></span></div></section><div className="info-banner"><Icon name="ShieldCheck" size={25} /><div><strong>A little transparency goes a long way.</strong><p>Every ticket, membership, and merchandise payment is recorded here. Reimbursements affect your balance once approved.</p></div></div>{adding && <Modal title="Keep the books connected" description="A little record today saves a lot of chasing later." onClose={close} wide><form onSubmit={async e => {
        const f = formValues(e); if (kind === 'expense' && !receipt) { setError('Attach a receipt for this reimbursement request.'); return; } setSaving(true); try {
          const receiptData = receipt ? await readFile(receipt) : undefined; const tx: Transaction = { id: uid('TX'), title: f.title.trim(), category: kind === 'expense' ? 'Expenses' : f.category, amount: Number(f.amount) * (kind === 'expense' ? -1 : 1), date: f.date, status: kind === 'expense' ? 'Pending' : 'Completed', receipt: receipt?.name, receiptData };
          update(d => ({ ...d, transactions: [tx, ...d.transactions] })); close(); toast(kind === 'expense' ? 'Expense request added. Ready for the treasurer’s review.' : 'Income recorded. A little more clarity.');
        } catch { setError('Could not read this receipt. Please try another file.'); } finally { setSaving(false); }
      }}><div className="segmented transaction-type"><button type="button" className={kind === 'expense' ? 'selected' : ''} onClick={() => setKind('expense')}><Icon name="ArrowUpRight" size={16} />Request reimbursement</button><button type="button" className={kind === 'income' ? 'selected' : ''} onClick={() => setKind('income')}><Icon name="ArrowDownLeft" size={16} />Record income</button></div><Field label={kind === 'expense' ? 'What was the expense for?' : 'What came in?'}><input name="title" required placeholder={kind === 'expense' ? 'e.g. Bake sale ingredients · Aisha' : 'e.g. Bake sale proceeds'} maxLength={130} /></Field><div className="form-two"><Field label="Amount (₹)"><input name="amount" type="number" min="1" step="1" required placeholder="0" /></Field><Field label="Date"><input name="date" type="date" required defaultValue={today} max={today} /></Field></div>{kind === 'income' && <Field label="Category"><select name="category"><option>Fundraiser</option><option>Membership</option><option>Tickets</option><option>Merchandise</option></select></Field>}<Field label={`Receipt ${kind === 'expense' ? '(required)' : '(optional)'}`} hint="PDF, PNG, or JPEG · up to 2 MB"><div className="upload-zone"><Icon name={receipt ? 'FileCheck2' : 'CloudUpload'} size={29} /><strong>{receipt ? receipt.name : 'Choose a receipt to attach'}</strong>
        <span>{receipt ? `${Math.round(receipt.size / 1024)} KB · ready to attach` : 'Click to browse your files'}</span><input aria-label="Upload receipt" type="file" accept="application/pdf,image/png,image/jpeg"
          onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { setError('Please choose a receipt smaller than 2 MB.'); setReceipt(null); return; } if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) { setError('Please upload a PDF, PNG, or JPEG receipt.'); setReceipt(null); return; } setReceipt(file); setError(''); }} /></div></Field>{error && <p className="inline-error" role="alert">{error}</p>}<p className="form-note">{kind === 'expense' ? 'Reimbursement requests are marked pending until approved by the treasurer.' : 'Completed income is immediately included in the club balance.'}</p><div className="form-footer"><Button variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" disabled={saving}
            icon="Check">{saving ? 'Saving…' : kind === 'expense' ? 'Create expense request' : 'Record income'}
          </Button></div></form></Modal>}</>;
}
