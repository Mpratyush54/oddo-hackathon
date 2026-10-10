import { useEffect, useState } from 'react';
import { backendPost, backendRequest } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { Field } from '../../../shared/ui/Field';
import { money } from '../../../shared/utils/format';
import type { ReceiptCheck } from './ReceiptCheckPanel';

export function ReceiptReviewQueue({
  clubId,
  userId,
  canClear,
}: {
  clubId: string;
  userId: string;
  canClear: boolean;
}) {
  const [rows, setRows] = useState<ReceiptCheck[]>([]),
    [selected, setSelected] = useState<ReceiptCheck | null>(null);
  const [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const result = await backendRequest<{ receipts: ReceiptCheck[] }>(
        `/clubs/${clubId}/receipts/checks`,
      );
      setRows(result.receipts);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Receipt queue unavailable.');
    }
  };
  useEffect(() => {
    setRows([]);
    setSelected(null);
    let active = true;
    backendRequest<{ receipts: ReceiptCheck[] }>(`/clubs/${clubId}/receipts/checks`)
      .then((result) => {
        if (active) setRows(result.receipts);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [clubId]);
  const openFile = async (receipt: ReceiptCheck) => {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const { url } = await backendRequest<{ url: string }>(
        `/clubs/${clubId}/receipts/checks/${receipt.id}/file`,
      );
      if (popup) popup.location.href = url;
      else throw new Error('Allow a new tab to view the receipt.');
    } catch (error) {
      popup?.close();
      setError(error instanceof Error ? error.message : 'Receipt unavailable.');
    }
  };
  return (
    <section className="card receipt-review-queue">
      <div className="table-toolbar">
        <h3>Receipts awaiting clearance ({rows.length})</h3>
        <Button variant="secondary" onClick={load}>
          Refresh checks
        </Button>
      </div>
      <p className="form-note">
        These documents have not been submitted as expenses. Clearance allows submission; expense
        approval happens later.
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {rows.map((receipt) => (
        <div className="receipt-review-row" key={receipt.id}>
          <div>
            <strong>{receipt.extracted?.vendor || receipt.id}</strong>
            <p>
              {money(receipt.claimedAmount / 100)} · {receipt.issues.join(' ')}
            </p>
          </div>
          <Button variant="secondary" onClick={() => openFile(receipt)}>
            View receipt
          </Button>
          {canClear && (
            <Button
              disabled={receipt.userId === userId}
              onClick={() => {
                setSelected(receipt);
                setReason('');
                setError('');
              }}
            >
              Review document
            </Button>
          )}
        </div>
      ))}
      {selected && (
        <Modal
          title="Receipt clearance"
          description="Inspect the receipt and resolve each flag before allowing an expense submission."
          onClose={() => setSelected(null)}
        >
          <ul>
            {selected.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => openFile(selected)}>
            View uploaded receipt
          </Button>
          <Field label="Why can this receipt proceed?">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={10}
              maxLength={500}
              required
            />
          </Field>
          <p className="form-note">
            This records document clearance. It does not approve reimbursement or verify a bank
            payout.
          </p>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <Button
            disabled={busy || reason.trim().length < 10}
            onClick={async () => {
              setBusy(true);
              try {
                await backendPost(`/clubs/${clubId}/receipts/checks/${selected.id}/clear`, {
                  reason,
                });
                setSelected(null);
                await load();
              } catch (error) {
                setError(error instanceof Error ? error.message : 'Clearance failed.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Clear for submission
          </Button>
        </Modal>
      )}
    </section>
  );
}
