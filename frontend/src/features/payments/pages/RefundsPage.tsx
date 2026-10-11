import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { backendPost, backendRequest, cloudMode } from '../../../shared/api/client';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Button } from '../../../shared/ui/Button';
import { Badge } from '../../../shared/ui/Badge';
import { Empty } from '../../../shared/ui/Empty';
import { Modal } from '../../../shared/ui/Modal';
import { Field } from '../../../shared/ui/Field';
import { money, date } from '../../../shared/utils/format';
import type { Store } from '../../../shared/types/domain';
import '../styles/refunds.css';

type Refund = {
  id: string;
  paymentId: string;
  userId: string;
  requesterName: string;
  amount: number;
  status: string;
  reason: string;
  createdAt: string;
  detail?: string;
  rejectionReason?: string;
  providerRefundId?: string;
  automatic?: boolean;
};
type Payment = {
  paymentId: string;
  amount: number;
  status: string;
  type: string;
  createdAt: string;
  membershipIncluded: boolean;
  eligibilityIssue: string;
};
type Listing = { canReview: boolean; requests: Refund[]; payments: Payment[] };
const labels: Record<string, string> = {
  Requested: 'Awaiting review',
  Processing: 'Processing',
  NeedsReview: 'Confirmation pending',
  Processed: 'Refunded',
  Rejected: 'Rejected',
  Failed: 'Failed',
  Fulfilled: 'Paid',
  RefundPending: 'Refund pending',
  Refunded: 'Refunded',
};
const purchase = (payment: Payment) =>
  payment.type === 'tickets.book'
    ? 'Event ticket'
    : payment.type === 'orders'
      ? payment.membershipIncluded
        ? 'Merchandise + membership'
        : 'Merchandise'
      : 'Annual membership';
const tone = (status: string) =>
  ['Processed', 'Refunded'].includes(status)
    ? ('green' as const)
    : ['Failed', 'Rejected', 'NeedsReview'].includes(status)
      ? ('neutral' as const)
      : ('gold' as const);

export function RefundsPage() {
  const { clubId } = useSession();
  const activeClub = useRef(clubId);
  activeClub.current = clubId;
  const { applyServerPatch, toast } = useStore();
  const [params, setParams] = useSearchParams();
  const [listing, setListing] = useState<Listing>({ canReview: false, requests: [], payments: [] });
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [requestPayment, setRequestPayment] = useState<Payment | null>(null),
    [rejectRefund, setRejectRefund] = useState<Refund | null>(null),
    [reason, setReason] = useState('');
  const reload = useCallback(async () => {
    if (!cloudMode) {
      setLoading(false);
      return;
    }
    const result = await backendRequest<Listing>(`/clubs/${encodeURIComponent(clubId)}/refunds`);
    if (activeClub.current === clubId) setListing(result);
  }, [clubId]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setRequestPayment(null);
    setRejectRefund(null);
    if (!cloudMode) {
      setLoading(false);
      return;
    }
    backendRequest<Listing>(`/clubs/${encodeURIComponent(clubId)}/refunds`)
      .then((result) => {
        if (!cancelled) setListing(result);
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId]);
  useEffect(() => {
    const paymentId = params.get('payment');
    if (!paymentId || loading) return;
    const payment = listing.payments.find(
      (p) => p.paymentId === paymentId && p.status === 'Fulfilled',
    );
    const existing = listing.requests.find((r) => r.paymentId === paymentId);
    if (payment && (!existing || ['Rejected', 'Failed'].includes(existing.status))) {
      setRequestPayment(payment);
      setReason('');
    }
    setParams({}, { replace: true });
  }, [params, loading, listing, setParams]);
  async function mutate(path: string, body: object, message: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const reply = await backendPost<{ refund: Refund; state: Store }>(path, body);
      if (activeClub.current !== clubId) return;
      applyServerPatch(clubId, reply.state);
      setRequestPayment(null);
      setRejectRefund(null);
      await reload();
      toast(
        reply.refund.status === 'Processed'
          ? 'Razorpay confirmed the test refund.'
          : reply.refund.status === 'NeedsReview'
            ? 'Confirmation is pending. Use Check status to reconcile safely.'
            : message,
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Refund update failed.');
    } finally {
      setBusy(false);
    }
  }
  const base = `/clubs/${encodeURIComponent(clubId)}/refunds`;
  if (!cloudMode)
    return (
      <Empty
        title="Refunds require the connected backend"
        description="Razorpay test refunds are available in the AWS workspace."
      />
    );
  return (
    <>
      <PageHeader
        title="Payments & refunds"
        description={
          listing.canReview
            ? 'Review requests and track Razorpay test refunds. Only processed refunds update the ledger.'
            : 'Request and track full refunds for your Razorpay test purchases.'
        }
      />
      <p className="form-note">
        Test mode · Full payment refunds only. A bundled purchase includes every item and its
        membership fee.
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading refunds…</p>
      ) : (
        <>
          <section className="card refunds-section">
            <h2>{listing.canReview ? 'Refund requests' : 'Your requests'}</h2>
            {!listing.requests.length && <p>No refund requests yet.</p>}
            {listing.requests.map((refund) => (
              <article className="refund-row" key={refund.id}>
                <div className="refund-details">
                  <strong>
                    {money(refund.amount / 100)} ·{' '}
                    {listing.canReview ? refund.requesterName : 'Your payment'}
                  </strong>
                  <Badge tone={tone(refund.status)}>{labels[refund.status] || refund.status}</Badge>
                  <p>{refund.reason}</p>
                  <small>
                    {date(refund.createdAt.slice(0, 10))} · {refund.paymentId}
                  </small>
                  {refund.providerRefundId && (
                    <small>Refund reference: {refund.providerRefundId}</small>
                  )}
                  {refund.detail && <p>{refund.detail}</p>}
                  {refund.rejectionReason && <p>Review reason: {refund.rejectionReason}</p>}
                </div>
                <div className="refund-actions">
                  {listing.canReview && ['Requested', 'Failed'].includes(refund.status) && (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          `${base}/${encodeURIComponent(refund.paymentId)}/review`,
                          { decision: 'approve' },
                          'Refund approved. Track its processing status here.',
                        )
                      }
                    >
                      {refund.status === 'Failed' ? 'Retry refund' : 'Approve refund'}
                    </Button>
                  )}
                  {listing.canReview && refund.status === 'Requested' && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setRejectRefund(refund);
                        setReason('');
                      }}
                    >
                      Reject
                    </Button>
                  )}
                  {['Processing', 'NeedsReview'].includes(refund.status) && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          `${base}/${encodeURIComponent(refund.paymentId)}/refresh`,
                          {},
                          'Refund status refreshed.',
                        )
                      }
                    >
                      Check status
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </section>
          <section className="card refunds-section">
            <h2>Your payments</h2>
            {!listing.payments.length && <p>No Razorpay purchases in this club yet.</p>}
            {listing.payments.map((payment) => {
              const request = listing.requests.find((r) => r.paymentId === payment.paymentId);
              return (
                <article className="refund-row" key={payment.paymentId}>
                  <div className="refund-details">
                    <strong>
                      {purchase(payment)} · {money(payment.amount / 100)}
                    </strong>
                    <Badge tone={tone(payment.status)}>
                      {labels[payment.status] || payment.status}
                    </Badge>
                    <small>
                      {date(payment.createdAt.slice(0, 10))} · {payment.paymentId}
                    </small>
                    {payment.eligibilityIssue && <p>{payment.eligibilityIssue}</p>}
                  </div>
                  <div className="refund-actions">
                    {payment.status === 'Fulfilled' &&
                      (!request || ['Rejected', 'Failed'].includes(request.status)) && (
                        <Button
                          variant="secondary"
                          disabled={busy || !!payment.eligibilityIssue}
                          onClick={() => {
                            setRequestPayment(payment);
                            setReason('');
                          }}
                        >
                          Request refund
                        </Button>
                      )}
                    {payment.status === 'RefundPending' && !request && (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void mutate(
                            base,
                            {
                              paymentId: payment.paymentId,
                              reason: 'Check the earlier automatic refund.',
                            },
                            'Refund recovered.',
                          )
                        }
                      >
                        Check status
                      </Button>
                    )}
                    {request && <span>{labels[request.status] || request.status}</span>}
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
      {requestPayment && (
        <Modal
          title="Request a full test refund"
          onClose={() => {
            if (!busy) setRequestPayment(null);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void mutate(
                base,
                { paymentId: requestPayment.paymentId, reason: reason.trim() },
                'Refund request submitted for review.',
              );
            }}
          >
            <p>
              {purchase(requestPayment)} · <strong>{money(requestPayment.amount / 100)}</strong>
            </p>
            <p>
              After approval and provider confirmation, the purchase will be cancelled. Membership
              included in this payment will be reverted where applicable.
            </p>
            <Field label="Reason">
              <textarea
                required
                minLength={5}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            {requestPayment.eligibilityIssue && (
              <p role="alert">{requestPayment.eligibilityIssue}</p>
            )}
            <Button
              type="submit"
              disabled={busy || reason.trim().length < 5 || !!requestPayment.eligibilityIssue}
            >
              {busy ? 'Submitting…' : 'Submit refund request'}
            </Button>
          </form>
        </Modal>
      )}
      {rejectRefund && (
        <Modal
          title="Reject refund request"
          onClose={() => {
            if (!busy) setRejectRefund(null);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void mutate(
                `${base}/${encodeURIComponent(rejectRefund.paymentId)}/review`,
                { decision: 'reject', reason: reason.trim() },
                'Refund request rejected.',
              );
            }}
          >
            <Field label="Review reason">
              <textarea
                required
                minLength={5}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || reason.trim().length < 5}>
              Reject request
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
