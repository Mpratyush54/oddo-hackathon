import { z } from 'zod';
import { HttpError, clubKey, timestamp, recordId } from '../../shared/records.js';
import { parseRequest } from '../../shared/request-validation.js';
import { requireRole } from '../../shared/authorization.js';
import { visibleState } from '../clubs/club.views.js';
import { requestRefundSchema, reviewRefundSchema } from './refunds.schemas.js';
import { RefundEffectsService } from './refund-effects.service.js';

const versioned = (item, version) => ({
  item,
  condition: '#version = :version',
  names: { '#version': 'version' },
  values: { ':version': version },
});
const providerRefundSchema = z.object({
  id: z.string().min(1),
  payment_id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.literal('INR'),
  status: z.enum(['pending', 'processed', 'failed']),
  receipt: z.string().nullable().optional(),
});

export class RefundsService {
  constructor({ repo, domain, gateway }) {
    Object.assign(this, { repo, domain, gateway });
    this.effects = new RefundEffectsService();
  }
  publicRecord(record) {
    const { pk, sk, paymentPk, paymentSk, membershipLocked, version, ...publicFields } = record;
    return publicFields;
  }
  async record(clubId, paymentId) {
    await this.domain.load(clubId);
    const record = await this.repo.get(clubKey(clubId), 'REFUND#' + paymentId);
    if (!record) throw new HttpError(404, 'Refund request not found.');
    return record;
  }
  async authorize(clubId, user, record) {
    const role = await this.domain.roleFor(user, clubId);
    if (record?.userId !== user.id) requireRole(role, ['admin', 'treasurer']);
    return role;
  }
  async list(clubId, user) {
    const role = await this.domain.roleFor(user, clubId),
      current = await this.domain.load(clubId);
    const reviewer = ['admin', 'treasurer'].includes(role);
    const [records, payments] = await Promise.all([
      this.repo.list(clubKey(clubId), 'REFUND#'),
      this.repo.list('USER#' + user.id, 'PAYMENT#'),
    ]);
    const requests = records
      .filter((r) => reviewer || r.userId === user.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      canReview: reviewer,
      requests: requests.map((r) => this.publicRecord(r)),
      payments: payments
        .filter(
          (p) =>
            p.clubId === clubId &&
            p.paymentId &&
            ['Fulfilled', 'RefundPending', 'Refunded'].includes(p.status),
        )
        .map((p) => {
          let eligibilityIssue = '';
          if (p.status === 'Fulfilled')
            try {
              this.effects.eligible(current.data, p);
            } catch (error) {
              eligibilityIssue = error.message;
            }
          return {
            paymentId: p.paymentId,
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            type: p.action.type,
            createdAt: p.createdAt,
            membershipIncluded: (p.result?.membershipFee || 0) > 0,
            eligibilityIssue,
          };
        }),
    };
  }
  async response(record, user) {
    const role = await this.authorize(record.clubId, user, record);
    return {
      refund: this.publicRecord(record),
      state: visibleState((await this.domain.load(record.clubId)).data, user, role),
    };
  }
  async write(current, data, record, oldRecord, payment, oldPayment, actor, action, access) {
    if (Buffer.byteLength(JSON.stringify(data)) > 300000)
      throw new HttpError(409, 'Club data limit reached.');
    const audit = {
      id: recordId('AUD'),
      actor: actor.id,
      clubId: record.clubId,
      collegeId: 'skyline-campus',
      action,
      entity: 'refunds',
      entityId: record.id,
      date: timestamp(),
      detail: `${actor.name} · ${action} · ${record.paymentId} · ₹${(record.amount / 100).toFixed(2)}`,
    };
    data.audit = [audit, ...(data.audit || [])].slice(0, 100);
    return this.repo.atomic([
      versioned(
        { pk: clubKey(record.clubId), sk: 'STATE', version: current.version + 1, data },
        current.version,
      ),
      oldRecord
        ? versioned(record, oldRecord.version)
        : { item: record, condition: 'attribute_not_exists(pk)' },
      versioned(payment, oldPayment.version),
      {
        item: { pk: clubKey(record.clubId), sk: `AUDIT#${audit.date}#${audit.id}`, ...audit },
        condition: 'attribute_not_exists(pk)',
      },
      ...(access
        ? [
            {
              item: access,
              condition: '#role = :role',
              names: { '#role': 'role' },
              values: { ':role': access.role },
            },
          ]
        : []),
    ]);
  }
  async request(clubId, input, user) {
    const { paymentId, reason } = parseRequest(requestRefundSchema, input);
    const payments = await this.repo.list('USER#' + user.id, 'PAYMENT#');
    const source = payments.find((p) => p.clubId === clubId && p.paymentId === paymentId);
    if (!source) throw new HttpError(404, 'Your payment was not found in this club.');
    if (source.status === 'RefundPending' && !source.result)
      return this.recoverAutomatic(source, user);
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await this.domain.load(clubId),
        payment = await this.repo.get(source.pk, source.sk);
      const old = await this.repo.get(clubKey(clubId), 'REFUND#' + paymentId);
      if (old && !['Rejected', 'Failed'].includes(old.status)) return this.response(old, user);
      if (payment.status !== 'Fulfilled')
        throw new HttpError(409, 'Only completed purchases can be requested for refund.');
      this.effects.eligible(current.data, payment);
      const record = {
        pk: clubKey(clubId),
        sk: 'REFUND#' + paymentId,
        id: recordId('RF'),
        clubId,
        userId: user.id,
        requesterName: user.name,
        paymentId,
        paymentPk: payment.pk,
        paymentSk: payment.sk,
        amount: payment.amount,
        currency: 'INR',
        mode: 'test',
        status: 'Requested',
        reason,
        createdAt: timestamp(),
        updatedAt: timestamp(),
        version: old ? old.version + 1 : 0,
      };
      if (
        await this.write(
          current,
          structuredClone(current.data),
          record,
          old,
          payment,
          payment,
          user,
          'refunds.request',
        )
      )
        return this.response(record, user);
    }
    throw new HttpError(409, 'Another refund update is in progress. Retry your request.');
  }
  async review(clubId, paymentId, input, user) {
    const args = parseRequest(reviewRefundSchema, input);
    for (let attempt = 0; attempt < 5; attempt++) {
      const access = await this.repo.get('USER#' + user.id, 'ACCESS#' + clubId);
      requireRole(access?.role, ['admin', 'treasurer']);
      const old = await this.record(clubId, paymentId);
      if (['Processing', 'NeedsReview', 'Processed'].includes(old.status))
        return this.response(old, user);
      if (!['Requested', 'Failed'].includes(old.status))
        throw new HttpError(409, 'This refund has already been reviewed.');
      if (old.status === 'Failed' && args.decision !== 'approve')
        throw new HttpError(409, 'A failed refund can only be retried.');
      const payment = await this.repo.get(old.paymentPk, old.paymentSk),
        current = await this.domain.load(clubId),
        data = structuredClone(current.data);
      if (payment.status !== 'Fulfilled' && !(old.automatic && payment.status === 'RefundPending'))
        throw new HttpError(409, 'Payment is already being refunded.');
      let record = {
        ...old,
        ...(old.status === 'Failed' ? { id: recordId('RF'), providerRefundId: undefined } : {}),
        status: args.decision === 'approve' ? 'Processing' : 'Rejected',
        reviewedBy: user.id,
        reviewedAt: timestamp(),
        updatedAt: timestamp(),
        version: old.version + 1,
        detail: undefined,
        rejectionReason: args.decision === 'reject' ? args.reason : undefined,
      };
      if (args.decision === 'approve') {
        const remote = await this.gateway.fetchPayment(payment.paymentId);
        if (
          remote.id !== payment.paymentId ||
          remote.order_id !== payment.orderId ||
          remote.amount !== payment.amount ||
          remote.currency !== 'INR' ||
          !remote.captured ||
          remote.status !== 'captured' ||
          (remote.amount_refunded || 0) > 0
        )
          throw new HttpError(
            409,
            'Razorpay payment is not fully refundable. Refresh its status first.',
          );
        if (!old.automatic) record = { ...record, ...this.effects.lock(data, payment) };
      }
      const nextPayment =
        args.decision === 'approve'
          ? { ...payment, status: 'RefundPending', version: payment.version + 1 }
          : payment;
      if (
        await this.write(
          current,
          data,
          record,
          old,
          nextPayment,
          payment,
          user,
          'refunds.' + args.decision,
          access,
        )
      ) {
        if (args.decision === 'approve') record = await this.process(record);
        return this.response(record, user);
      }
    }
    throw new HttpError(409, 'Another refund update is in progress. Refresh and retry.');
  }
  async process(record) {
    try {
      const remote = await this.gateway.refund(
        record.paymentId,
        record.amount,
        record.id,
        record.id,
      );
      return await this.applyProvider(record, remote);
    } catch {
      const latest = await this.record(record.clubId, record.paymentId);
      if (!['Processing', 'NeedsReview'].includes(latest.status)) return latest;
      const uncertain = {
        ...latest,
        status: 'NeedsReview',
        detail:
          'Provider confirmation is pending. Use Check status to safely reconcile this refund.',
        updatedAt: timestamp(),
        version: latest.version + 1,
      };
      await this.repo.atomic([versioned(uncertain, latest.version)]);
      return this.record(record.clubId, record.paymentId);
    }
  }
  async applyProvider(record, input) {
    const remote = parseRequest(providerRefundSchema, input, 'Unexpected refund response.');
    if (
      remote.payment_id !== record.paymentId ||
      remote.amount !== record.amount ||
      (record.providerRefundId
        ? remote.id !== record.providerRefundId
        : remote.receipt !== record.id)
    )
      throw new HttpError(409, 'Refund details do not match this request.');
    for (let attempt = 0; attempt < 5; attempt++) {
      const old = await this.record(record.clubId, record.paymentId);
      if (old.id !== record.id || ['Processed', 'Failed'].includes(old.status)) return old;
      if (!['Processing', 'NeedsReview'].includes(old.status))
        throw new HttpError(409, 'Refund has not been approved.');
      const payment = await this.repo.get(old.paymentPk, old.paymentSk),
        current = await this.domain.load(record.clubId),
        data = structuredClone(current.data);
      const status =
        remote.status === 'processed'
          ? 'Processed'
          : remote.status === 'failed'
            ? 'Failed'
            : 'Processing';
      const next = {
        ...old,
        status,
        providerRefundId: remote.id,
        updatedAt: timestamp(),
        version: old.version + 1,
        detail:
          status === 'Failed'
            ? 'Razorpay reported that this refund failed. Staff can retry after checking the payment.'
            : status === 'Processing'
              ? 'Razorpay accepted the refund. Processing is not yet complete.'
              : 'Razorpay confirmed that the test refund was processed.',
      };
      if (status === 'Processed') this.effects.processed(data, payment, next);
      if (status === 'Failed' && !old.automatic) this.effects.failed(data, payment, old);
      const nextPayment = {
        ...payment,
        status:
          status === 'Processed'
            ? 'Refunded'
            : status === 'Failed' && !old.automatic
              ? 'Fulfilled'
              : 'RefundPending',
        refundId: remote.id,
        version: payment.version + 1,
      };
      if (
        await this.write(
          current,
          data,
          next,
          old,
          nextPayment,
          payment,
          { id: 'SYSTEM', name: 'Razorpay' },
          'refunds.' + status.toLowerCase(),
        )
      )
        return next;
    }
    throw new HttpError(
      409,
      'Refund confirmation is awaiting database reconciliation. Check status again.',
    );
  }
  async refresh(clubId, paymentId, user) {
    const record = await this.record(clubId, paymentId);
    await this.authorize(clubId, user, record);
    if (!['Processing', 'NeedsReview'].includes(record.status)) return this.response(record, user);
    try {
      const remote = record.providerRefundId
        ? await this.gateway.fetchRefund(record.providerRefundId)
        : (await this.gateway.paymentRefunds(paymentId)).find((r) => r.receipt === record.id);
      const next = remote ? await this.applyProvider(record, remote) : await this.process(record);
      return this.response(next, user);
    } catch {
      throw new HttpError(
        503,
        'Refund status is temporarily unavailable. Try again using this saved refund reference.',
      );
    }
  }
  async automatic(payment, user) {
    const existing = await this.repo.get(clubKey(payment.clubId), 'REFUND#' + payment.paymentId);
    if (existing) return existing;
    const record = {
      pk: clubKey(payment.clubId),
      sk: 'REFUND#' + payment.paymentId,
      id: recordId('RF'),
      clubId: payment.clubId,
      userId: payment.userId,
      requesterName: user.name,
      paymentId: payment.paymentId,
      paymentPk: payment.pk,
      paymentSk: payment.sk,
      amount: payment.amount,
      currency: 'INR',
      mode: 'test',
      status: 'Processing',
      reason: 'Checkout availability or price changed.',
      automatic: true,
      reviewedBy: 'SYSTEM',
      reviewedAt: timestamp(),
      createdAt: timestamp(),
      updatedAt: timestamp(),
      version: 0,
    };
    if (!(await this.repo.put(record, true))) return this.record(payment.clubId, payment.paymentId);
    return this.process(record);
  }
  async recoverAutomatic(payment, user) {
    // Older automatic refunds had no club-indexed request. Discover the provider result without issuing another refund.
    const existing = await this.repo.get(clubKey(payment.clubId), 'REFUND#' + payment.paymentId);
    if (existing) return this.response(existing, user);
    const refunds = await this.gateway.paymentRefunds(payment.paymentId);
    const found = refunds.find(
      (r) =>
        r.amount === payment.amount &&
        r.currency === 'INR' &&
        r.receipt === payment.id.slice(0, 40),
    );
    if (!found)
      throw new HttpError(
        409,
        'An older refund cannot yet be confirmed by Razorpay. Check again later; no duplicate refund was sent.',
      );
    const record = {
      pk: clubKey(payment.clubId),
      sk: 'REFUND#' + payment.paymentId,
      id: found.receipt,
      clubId: payment.clubId,
      userId: payment.userId,
      requesterName: user.name,
      paymentId: payment.paymentId,
      paymentPk: payment.pk,
      paymentSk: payment.sk,
      amount: payment.amount,
      currency: 'INR',
      mode: 'test',
      status: 'Processing',
      reason: 'Recovery of an earlier automatic refund.',
      automatic: true,
      providerRefundId: found.id,
      reviewedBy: 'SYSTEM',
      reviewedAt: timestamp(),
      createdAt: timestamp(),
      updatedAt: timestamp(),
      version: 0,
    };
    await this.repo.put(record, true);
    return this.response(await this.applyProvider(record, found), user);
  }
  async webhook(entity) {
    if (!entity || typeof entity.id !== 'string' || typeof entity.payment_id !== 'string')
      throw new HttpError(400, 'Missing refund entity.');
    const remote = await this.gateway.fetchRefund(entity.id),
      paymentInfo = await this.gateway.fetchPayment(remote.payment_id);
    const mapping = await this.repo.get('RAZORPAY#' + paymentInfo.order_id, 'PAYMENT_REF');
    if (!mapping) return;
    const payment = await this.repo.get(mapping.paymentPk, mapping.paymentSk);
    const record = await this.repo.get(clubKey(payment.clubId), 'REFUND#' + remote.payment_id);
    if (record && (record.providerRefundId === remote.id || remote.receipt === record.id))
      await this.applyProvider(record, remote);
  }
}
