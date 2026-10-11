import { createHash } from 'node:crypto';
import { HttpError, recordId, timestamp, dateToday, clubKey } from '../../shared/records.js';
import { parseRequest } from '../../shared/request-validation.js';
import { applyAction, paymentAmount, visibleState } from '../clubs/club.service.js';
import { createPaymentSchema, verifyPaymentSchema } from './payments.schemas.js';
import { RazorpayService, validSignature } from './razorpay.service.js';
import { RefundsService } from './refunds.service.js';
import { assertRefundUnlocked } from './refund-locks.js';

const compareVersion = (item, version) => ({
  item,
  condition: '#version = :version',
  names: { '#version': 'version' },
  values: { ':version': version },
});

export class PaymentsService {
  constructor({ repo, domain, env, fetchImpl }) {
    Object.assign(this, { repo, domain, env });
    this.gateway = new RazorpayService({ env, fetchImpl });
    this.refunds = new RefundsService({ repo, domain, gateway: this.gateway });
  }
  async own(key, user) {
    const payment = await this.repo.get('USER#' + user.id, 'PAYMENT#' + key);
    if (!payment) throw new HttpError(404, 'Payment attempt not found.');
    return payment;
  }
  async reply(payment, user) {
    if (payment.status === 'Fulfilled') {
      const role = await this.domain.roleFor(user, payment.clubId);
      return {
        status: payment.status,
        ...payment.result,
        state: visibleState((await this.domain.load(payment.clubId)).data, user, role),
      };
    }
    return {
      status: payment.status,
      key: this.env.RAZORPAY_KEY_ID,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: 'INR',
      mode: 'test',
    };
  }
  async create(input, user) {
    this.gateway.assertConfigured();
    const { clubId, action, idempotencyKey } = parseRequest(createPaymentSchema, input);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ clubId, action }))
      .digest('hex');
    const pk = 'USER#' + user.id,
      sk = 'PAYMENT#' + idempotencyKey;
    const cached = await this.repo.get(pk, sk);
    if (cached) {
      if (cached.fingerprint !== fingerprint)
        throw new HttpError(409, 'This checkout key belongs to another selection.');
      return this.reply(cached, user);
    }
    const role = await this.domain.roleFor(user, clubId);
    const current = await this.domain.load(clubId);
    assertRefundUnlocked(current.data, action, user);
    const freeRequest = await this.repo.get(
      clubKey(clubId),
      `REQUEST#${user.id}#${idempotencyKey}`,
    );
    if (freeRequest && (freeRequest.result.ticket?.amount === 0 || freeRequest.result.total === 0))
      return {
        status: 'Fulfilled',
        ...(await this.domain.execute(clubId, { ...action, idempotencyKey }, user)),
      };
    const { result } = applyAction(current.data, { ...action, clubId }, user, role, dateToday());
    const amount = paymentAmount(action, result);
    if (!amount)
      return {
        status: 'Fulfilled',
        ...(await this.domain.execute(clubId, { ...action, idempotencyKey }, user)),
      };
    await this.repo.limit('PAYMENT#' + user.id, 15, 3600);
    const payment = {
      pk,
      sk,
      id: recordId('PAY'),
      userId: user.id,
      clubId,
      action,
      fingerprint,
      amount,
      currency: 'INR',
      ...(result.pointsRedeemed > 0
        ? {
            pointsQuote: {
              pointsRedeemed: result.pointsRedeemed,
              valuePaise: result.redemptionValuePaise,
            },
          }
        : {}),
      mode: 'test',
      status: 'Creating',
      version: 0,
      createdAt: timestamp(),
    };
    if (!(await this.repo.put(payment, true))) return this.create(input, user);
    // Persist before the outbound request. An ambiguous timeout must never create a second order under this key.
    const order = await this.gateway.createOrder(amount, payment.id.slice(0, 40));
    if (typeof order.id !== 'string' || order.amount !== amount || order.currency !== 'INR')
      throw new HttpError(502, 'Unexpected Razorpay order response.');
    const created = { ...payment, orderId: order.id, status: 'Created', version: 1 };
    if (
      !(await this.repo.atomic([
        compareVersion(created, 0),
        {
          item: { pk: 'RAZORPAY#' + order.id, sk: 'PAYMENT_REF', paymentPk: pk, paymentSk: sk },
          condition: 'attribute_not_exists(pk)',
        },
      ]))
    )
      throw new HttpError(503, 'Checkout could not be saved. Contact your club administrator.');
    return this.reply(created, user);
  }
  async verify(input, user) {
    const args = parseRequest(verifyPaymentSchema, input);
    const payment = await this.own(args.idempotencyKey, user);
    if (
      payment.orderId !== args.razorpay_order_id ||
      !validSignature(
        payment.orderId + '|' + args.razorpay_payment_id,
        args.razorpay_signature,
        this.env.RAZORPAY_KEY_SECRET,
      )
    )
      throw new HttpError(400, 'Payment signature verification failed.');
    return this.finalize(payment, args.razorpay_payment_id, user);
  }
  async finalize(payment, paymentId, user) {
    payment = await this.repo.get(payment.pk, payment.sk);
    if (payment.status !== 'Created') return this.reply(payment, user);
    const remote = await this.gateway.fetchPayment(paymentId);
    if (
      remote.id !== paymentId ||
      remote.order_id !== payment.orderId ||
      remote.amount !== payment.amount ||
      remote.currency !== 'INR' ||
      (remote.amount_refunded || 0) !== 0
    )
      throw new HttpError(400, 'Payment details do not match this checkout.');
    if (remote.status !== 'captured' || remote.captured !== true) return this.reply(payment, user);
    try {
      const result = await this.domain.execute(
        payment.clubId,
        { ...payment.action, idempotencyKey: 'pay_' + payment.id },
        user,
        { ...payment, paymentId },
      );
      return { status: 'Fulfilled', ...result };
    } catch (error) {
      const latest = await this.repo.get(payment.pk, payment.sk);
      if (latest.status === 'Fulfilled') return this.reply(latest, user);
      // Availability and price can change while checkout is open. Claim a refund atomically so fulfillment and refund cannot both win.
      if ([400, 404, 409].includes(error.status) && !error.message.includes('Another update')) {
        const pending = {
          ...latest,
          paymentId,
          status: 'RefundPending',
          version: latest.version + 1,
        };
        if (
          latest.status === 'Created' &&
          (await this.repo.atomic([compareVersion(pending, latest.version)]))
        ) {
          await this.refunds.automatic(pending, user);
        }
        return this.reply(await this.repo.get(payment.pk, payment.sk), user);
      }
      throw error;
    }
  }
  async status(key, user) {
    const payment = await this.own(key, user);
    if (payment.status !== 'Created') return this.reply(payment, user);
    const { items = [] } = await this.gateway.orderPayments(payment.orderId);
    const captured = items.find((p) => p.status === 'captured' && p.captured === true);
    return captured ? this.finalize(payment, captured.id, user) : this.reply(payment, user);
  }
  async webhook(rawBody, signature, payload) {
    this.gateway.assertConfigured();
    if (
      !Buffer.isBuffer(rawBody) ||
      !validSignature(rawBody, signature, this.env.RAZORPAY_WEBHOOK_SECRET)
    )
      throw new HttpError(401, 'Invalid webhook signature.');
    if (['refund.created', 'refund.processed', 'refund.failed'].includes(payload.event)) {
      await this.refunds.webhook(payload.payload?.refund?.entity);
      return;
    }
    if (!['payment.captured', 'order.paid'].includes(payload.event)) return;
    const entity = payload.payload?.payment?.entity;
    if (!entity || typeof entity.id !== 'string' || typeof entity.order_id !== 'string')
      throw new HttpError(400, 'Missing payment entity.');
    const mapping = await this.repo.get('RAZORPAY#' + entity.order_id, 'PAYMENT_REF');
    if (!mapping)
      throw new HttpError(503, 'Order mapping is not available yet. Retry this webhook.');
    const payment = await this.repo.get(mapping.paymentPk, mapping.paymentSk);
    const user = await this.repo.get('USER#' + payment.userId, 'PROFILE');
    if (!user) throw new HttpError(409, 'Payment owner is unavailable.');
    await this.finalize(payment, entity.id, user);
  }
}
