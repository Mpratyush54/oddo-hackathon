import { actionRequestSchema } from './clubs.schemas.js';
import { parseRequest } from '../../shared/request-validation.js';
import { createHash } from 'node:crypto';
import { HttpError, clubKey, dateToday, timestamp, recordId } from '../../shared/records.js';
import { quotePromo } from '../commerce/commerce.domain.js';
import { accountKey } from '../auth/index.js';
import { requireRole } from '../../shared/authorization.js';
import { visibleState } from './club.views.js';

import { applyAction } from './actions.js';
export function paymentAmount(action, result) {
  const rupees =
    action.type === 'tickets.book'
      ? result.ticket.amount
      : action.type === 'orders'
        ? result.total
        : 500;
  const amount = Math.round(rupees * 100);
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new HttpError(400, 'Invalid checkout amount.');
  return amount;
}
export function createDomain({
  repo,
  clubs,
  paymentsRequired = false,
  receiptChecksRequired = false,
}) {
  async function load(clubId) {
    if (!clubs.some((c) => c.id === clubId)) throw new HttpError(404, 'Club not found.');
    const item = await repo.get(clubKey(clubId), 'STATE');
    if (!item) throw new HttpError(503, 'Club data has not been initialized.');
    return item;
  }
  async function roleFor(user, clubId) {
    return (await repo.get(`USER#${user.id}`, `ACCESS#${clubId}`))?.role || 'member';
  }
  async function execute(clubId, action, user, payment) {
    action = parseRequest(actionRequestSchema, action);
    const pk = clubKey(clubId),
      role = await roleFor(user, clubId);
    const sk = `REQUEST#${user.id}#${action.idempotencyKey}`;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ type: action.type, args: action.args || {} }))
      .digest('hex');
    const context = {};
    if (action.type === 'members.add') {
      requireRole(role, ['admin']);
      const account = await repo.get(accountKey(action.args?.member?.email || ''), 'ACCOUNT');
      if (account) context.targetUser = await repo.get(`USER#${account.id}`, 'PROFILE');
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const cached = await repo.get(pk, sk);
      if (cached) {
        if (cached.fingerprint !== fingerprint)
          throw new HttpError(409, 'This request key was used for another action.');
        return { ...cached.result, state: visibleState((await load(clubId)).data, user, role) };
      }
      const current = await load(clubId);
      if (
        receiptChecksRequired &&
        action.type === 'expenses.review' &&
        action.args.status === 'Completed'
      ) {
        const expense = current.data.transactions.find(
          (row) => row.id === action.args.transactionId,
        );
        const receipt = expense?.receiptCheckId
          ? await repo.get(pk, 'RECEIPT#' + expense.receiptCheckId)
          : null;
        if (
          !receipt ||
          receipt.status !== 'Consumed' ||
          receipt.transactionId !== expense.id ||
          receipt.receiptKey !== expense.receiptKey
        )
          throw new HttpError(
            409,
            'This request has no completed receipt checks. Ask the requester to resubmit through the receipt-check workflow.',
          );
      }
      const receiptOperations = [];
      if (receiptChecksRequired && action.type === 'expenses.create') {
        const receipt = await repo.get(pk, 'RECEIPT#' + action.args.receiptCheckId);
        if (
          !receipt ||
          receipt.userId !== user.id ||
          receipt.clubId !== clubId ||
          receipt.receiptKey !== action.args.receiptKey
        )
          throw new HttpError(400, 'Upload and check your receipt before submitting this expense.');
        if (receipt.status !== 'Ready')
          throw new HttpError(
            409,
            'Receipt checking or administrator clearance is required before submission.',
          );
        if (receipt.claimedAmount !== Math.round(action.args.amount * 100))
          throw new HttpError(
            409,
            'The amount changed. Check the receipt again before submitting.',
          );
        const useKeys = [
          'RECEIPT_USE#' + receipt.contentHash,
          ...(receipt.invoiceFingerprint ? ['RECEIPT_USE#' + receipt.invoiceFingerprint] : []),
        ];
        for (const useKey of useKeys)
          if (await repo.get(pk, useKey))
            throw new HttpError(409, 'This receipt or invoice was already used for an expense.');
        context.receipt = receipt;
        context.receiptUseKeys = [...new Set(useKeys)];
      }
      if (
        paymentsRequired &&
        action.type === 'members.add' &&
        action.args?.member?.status === 'Active'
      )
        throw new HttpError(409, 'Add a pending member, or use user management to waive dues.');
      const cancelled =
        action.type === 'tickets.cancel'
          ? current.data.tickets.find((t) => t.id === action.args.ticketId)
          : action.type === 'orders.update' && action.args.status === 'Cancelled'
            ? current.data.orders.find((o) => o.id === action.args.orderId)
            : null;
      if (cancelled?.paymentId)
        throw new HttpError(
          409,
          'Paid cancellations require a refund through the Razorpay test dashboard.',
        );
      const { data, result } = applyAction(
        current.data,
        { ...action, clubId },
        user,
        role,
        dateToday(),
        context,
      );
      const paidAction = ['tickets.book', 'orders', 'membership.demo-dues'].includes(action.type);
      if (paidAction && paymentsRequired) {
        const amount = paymentAmount(action, result);
        if (amount > 0 && !payment)
          throw new HttpError(402, 'Complete Razorpay test checkout first.');
        if (
          payment &&
          (payment.amount !== amount ||
            payment.userId !== user.id ||
            payment.clubId !== clubId ||
            payment.status !== 'Created')
        )
          throw new HttpError(409, 'Checkout price or payment state changed.');
        if (payment) {
          for (const field of ['tickets', 'orders', 'transactions']) {
            const previous = new Set(current.data[field].map((row) => row.id));
            for (const row of data[field])
              if (!previous.has(row.id)) {
                row.paymentId = payment.paymentId;
                if (field === 'transactions')
                  row.title = row.title.replace('(simulated payment)', '(Razorpay test payment)');
              }
          }
        }
      }
      const audit = {
        id: recordId('AUD'),
        actor: user.id,
        clubId,
        collegeId: 'skyline-campus',
        action: action.type,
        entity: action.type.split('.')[0],
        entityId:
          result.ticket?.id ||
          result.announcement?.id ||
          action.args?.transactionId ||
          action.args?.ticketId ||
          clubId,
        date: timestamp(),
        detail: `${user.name} · ${action.type}`,
      };
      data.audit = [audit, ...(data.audit || [])].slice(0, 100);
      if (context.receipt) {
        const receipt = context.receipt,
          transactionId = data.transactions[0].id;
        receiptOperations.push({
          item: {
            ...receipt,
            status: 'Consumed',
            version: receipt.version + 1,
            transactionId,
            consumedAt: timestamp(),
          },
          condition: '#version = :version',
          names: { '#version': 'version' },
          values: { ':version': receipt.version },
        });
        for (const useKey of context.receiptUseKeys)
          receiptOperations.push({
            item: { pk, sk: useKey, receiptId: receipt.id, transactionId, createdAt: timestamp() },
            condition: 'attribute_not_exists(pk)',
          });
      }
      const { patch, ...safeResult } = result;
      if (
        await repo.commit(
          pk,
          current.version,
          data,
          audit,
          { sk, fingerprint, result: safeResult },
          payment
            ? [
                {
                  item: {
                    ...payment,
                    status: 'Fulfilled',
                    version: payment.version + 1,
                    result: safeResult,
                  },
                  condition: '#version = :version',
                  names: { '#version': 'version' },
                  values: { ':version': payment.version },
                },
              ]
            : receiptOperations,
        )
      )
        return { ...safeResult, state: visibleState(data, user, role) };
    }
    throw new HttpError(
      409,
      'Another update is in progress. Reload and retry using the same request key.',
    );
  }
  return {
    load,
    roleFor,
    execute,
    quote: (data, args, user) =>
      quotePromo(data, { ...args, email: user.email, today: dateToday() }),
  };
}

export { applyAction } from './actions.js';
export { visibleState, publicState } from './club.views.js';
export { requireRole, allowedRoles } from '../../shared/authorization.js';
export { matchesAudience } from '../communications/audience.js';
