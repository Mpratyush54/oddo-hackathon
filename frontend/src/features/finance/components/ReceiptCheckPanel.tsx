import { useEffect, useRef, useState } from 'react';
import { backendPost, backendRequest } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { money } from '../../../shared/utils/format';

export type ReceiptCheck = {
  id: string;
  clubId: string;
  userId: string;
  status: 'Uploading' | 'Processing' | 'Ready' | 'NeedsReview' | 'Failed' | 'Consumed';
  claimedAmount: number;
  receiptKey?: string;
  issues: string[];
  extracted?: { total?: number; vendor?: string; dateText?: string; totalConfidence?: number };
  clearedBy?: string;
  clearanceReason?: string;
};
export function ReceiptCheckPanel({
  clubId,
  file,
  amount,
  onChecked,
}: {
  clubId: string;
  file: File | null;
  amount: string;
  onChecked: (value: ReceiptCheck | null) => void;
}) {
  const [result, setResult] = useState<ReceiptCheck | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setResult(null);
    setBusy(false);
    setError('');
    onChecked(null);
    return () => {
      generation.current++;
    };
  }, [clubId, file, amount, onChecked]);
  const check = async () => {
    if (!file || busy || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return;
    const current = generation.current;
    setBusy(true);
    setError('');
    try {
      let receipt = result;
      if (!receipt) {
        const upload = await backendPost<{
          url: string;
          fields: Record<string, string>;
          key: string;
        }>(`/clubs/${clubId}/receipts/upload`, { contentType: file.type });
        const form = new FormData();
        for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
        form.append('file', file);
        const response = await fetch(upload.url, { method: 'POST', body: form });
        if (!response.ok) throw new Error('Receipt upload failed.');
        if (current !== generation.current) return;
        receipt = await backendPost<ReceiptCheck>(`/clubs/${clubId}/receipts/check`, {
          receiptKey: upload.key,
          amount: Number(amount),
        });
      }
      for (let attempt = 0; attempt < 60; attempt++) {
        if (current !== generation.current) return;
        setResult(receipt);
        onChecked(receipt);
        if (!['Processing', 'Uploading'].includes(receipt.status)) break;
        await new Promise((done) => setTimeout(done, 3000));
        if (current !== generation.current) return;
        receipt = await backendRequest<ReceiptCheck>(
          `/clubs/${clubId}/receipts/checks/${receipt.id}`,
        );
      }
      if (current === generation.current) {
        setResult(receipt);
        onChecked(receipt);
      }
    } catch (error) {
      if (current === generation.current)
        setError(error instanceof Error ? error.message : 'Receipt checking failed.');
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  const refresh = async () => {
    if (!result || busy) return;
    setBusy(true);
    setError('');
    const current = generation.current;
    try {
      const receipt = await backendRequest<ReceiptCheck>(
        `/clubs/${clubId}/receipts/checks/${result.id}`,
      );
      if (current === generation.current) {
        setResult(receipt);
        onChecked(receipt);
      }
    } catch (error) {
      if (current === generation.current)
        setError(error instanceof Error ? error.message : 'Status could not be refreshed.');
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  return (
    <section className="receipt-check-panel" aria-label="Receipt checks" aria-live="polite">
      <strong>
        {result?.status === 'Ready'
          ? 'Receipt cleared for submission'
          : result?.status === 'NeedsReview'
            ? 'Administrator receipt clearance needed'
            : busy
              ? 'Checking your receipt…'
              : 'Check your receipt before submitting'}
      </strong>
      <p className="form-note">
        OCR checks the amount and receipt details. Flagged receipts need a separate administrator
        check before expense review.
      </p>
      {result?.extracted && (
        <p>
          {result.extracted.vendor || 'Vendor not read'} · Receipt total:{' '}
          {result.extracted.total === undefined ? 'Not read' : money(result.extracted.total / 100)}
        </p>
      )}
      {result?.issues.length ? (
        <ul>
          {result.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      {result?.clearedBy && (
        <p className="form-note">Administrator clearance: {result.clearanceReason}</p>
      )}
      {result?.status === 'Failed' && (
        <p className="form-note">Choose a clearer receipt and run the checks again.</p>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {result ? (
        <Button variant="secondary" disabled={busy} onClick={refresh}>
          Refresh receipt status
        </Button>
      ) : (
        <Button variant="secondary" disabled={!file || Number(amount) <= 0 || busy} onClick={check}>
          {busy ? 'Checking receipt…' : 'Upload & check receipt'}
        </Button>
      )}
    </section>
  );
}
