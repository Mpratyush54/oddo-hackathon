import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { MemoryRepository } from '../../src/database/repositories/memory.repository.js';
import { createDomain } from '../../src/modules/clubs/club.service.js';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { validSignature, RazorpayService } from '../../src/modules/payments/razorpay.service.js';
import { clubKey } from '../../src/shared/records.js';
import { readFileSync } from 'node:fs';
import { createApp } from '../../src/app.js';
import { once } from 'node:events';
import { hasActiveMembership } from '../../../shared/membership.js';
import { availablePoints } from '../../../shared/points.js';
import { DEFAULT_POINT_RULES } from '../../src/modules/commerce/commerce.domain.js';

test('member pricing requires active unexpired membership and survives every later purchase', async () => {
  for (const activation of ['paid', 'approved']) {
    const f = await fixture();
    await f.domain.execute(
      'skyline',
      {
        type: 'membership.join',
        args: {},
        idempotencyKey: crypto.randomUUID(),
      },
      user,
    );
    if (activation === 'paid') {
      await approveMember(f);
      const dues = await f.start('membership.demo-dues', {});
      await f.service.verify(dues.verify, user);
    } else {
      const state = await f.domain.load('skyline');
      Object.assign(state.data.members[0], {
        status: 'Active',
        expires: '2027-07-31',
        duesWaived: true,
      });
      await f.repo.put(state);
    }
    const first = await f.start();
    assert.equal(first.order.amount, 5000, activation);
    await f.service.verify(first.verify, user);
    const state = await f.domain.load('skyline');
    state.data.events.push({ ...state.data.events[0], id: 'second-event', sold: 0 });
    await f.repo.put(state);
    const second = await f.start('tickets.book', { eventId: 'second-event' });
    assert.equal(second.order.amount, 5000, activation);
    await f.service.verify(second.verify, user);
    const merch = await f.start('orders', {
      productId: 'product',
      size: 'M',
      quantity: 1,
      joinMembership: true,
    });
    assert.equal(
      merch.order.amount,
      40000,
      'existing members are never charged joining dues again',
    );
    const result = await f.service.verify(merch.verify, user);
    assert.equal(result.membershipFee, 0);
    assert.equal(result.memberPriceApplied, true);
  }
  assert.equal(
    hasActiveMembership({ status: 'Expiring', expires: '2026-10-11' }, '2026-10-11'),
    true,
  );
  for (const member of [
    { status: 'Pending', expires: '2027-07-31' },
    { status: 'Expired', expires: '2027-07-31' },
    { status: 'Active', expires: '2026-10-10' },
    { status: 'Active', expires: '2027-07-31', refundPending: true },
  ])
    assert.equal(hasActiveMembership(member, '2026-10-11'), false);
});

test('Razorpay refund retries send identical payload and provider idempotency header', async () => {
  const calls = [];
  const gateway = new RazorpayService({
    env,
    fetchImpl: async (url, request) => {
      calls.push({ url, request });
      return { ok: true, json: async () => ({ id: 'refund-fixture' }) };
    },
  });
  for (let attempt = 0; attempt < 2; attempt++)
    await gateway.refund('payment-fixture', 10000, 'RF-1234567890');
  assert.equal(calls[0].request.headers['X-Refund-Idempotency'], 'RF-1234567890');
  assert.equal(calls[1].request.body, calls[0].request.body);
  assert.equal(
    calls[1].request.headers['X-Refund-Idempotency'],
    calls[0].request.headers['X-Refund-Idempotency'],
  );
});

const user = { id: 'test-user', name: 'Test User', email: 'test@example.test' };
async function pointWallet(f, balance = 300, valuePaise = 100) {
  const state = await f.domain.load('skyline');
  state.data.members = [
    {
      ...user,
      userId: user.id,
      course: 'QA',
      joined: '2026-10-11',
      role: 'Volunteer',
      status: 'Active',
      expires: '2099-01-01',
      participationPoints: balance,
      volunteerPoints: 0,
      contributionPoints: 0,
    },
  ];
  state.data.pointLedger = [];
  state.data.products[0].stock.M = 5;
  state.data.pointRules = {
    ...DEFAULT_POINT_RULES,
    ...state.data.pointRules,
    redemptionEnabled: true,
    redemptionValuePaise: valuePaise,
  };
  await f.repo.put(state);
}

test('paid points checkout uses admin rate after coupon, deducts once, refunds restore once', async () => {
  const f = await fixture();
  await pointWallet(f, 300, 50);
  const checkout = await f.start('orders', {
    productId: 'product',
    size: 'M',
    quantity: 1,
    promoCode: 'WELCOME10',
    pointsToRedeem: 200,
  });
  assert.equal(checkout.order.amount, 26000);
  let data = (await f.domain.load('skyline')).data;
  assert.equal(
    availablePoints(data.members[0], data.pointLedger),
    300,
    'opening checkout never spends points',
  );
  await f.service.verify(checkout.verify, user);
  await f.service.verify(checkout.verify, user);
  data = (await f.domain.load('skyline')).data;
  assert.equal(data.members[0].participationPoints, 300);
  assert.equal(availablePoints(data.members[0], data.pointLedger), 102);
  assert.equal(data.pointLedger.filter((p) => p.kind === 'redemption').length, 1);
  await allowReviewer(f);
  await f.service.refunds.request(
    'skyline',
    { paymentId: checkout.payment.id, reason: 'Return this merchandise please.' },
    user,
  );
  assert.equal(
    availablePoints(
      (await f.domain.load('skyline')).data.members[0],
      (await f.domain.load('skyline')).data.pointLedger,
    ),
    102,
  );
  await f.service.refunds.review('skyline', checkout.payment.id, { decision: 'approve' }, staff);
  await f.service.refunds.refresh('skyline', checkout.payment.id, user);
  data = (await f.domain.load('skyline')).data;
  assert.equal(availablePoints(data.members[0], data.pointLedger), 300);
  assert.equal(data.members[0].participationPoints, 300);
  assert.equal(data.members[0].contributionPoints, 0);
  assert.equal(f.refunds(), 1);
  assert.equal(data.products[0].stock.M, 5);
});

test('competing checkouts cannot double spend; captured loser is refunded', async () => {
  const f = await fixture();
  await pointWallet(f);
  const args = { productId: 'product', size: 'M', quantity: 1, pointsToRedeem: 300 };
  const first = await f.start('orders', args),
    second = await f.start('orders', args);
  await Promise.allSettled([
    f.service.verify(first.verify, user),
    f.service.verify(second.verify, user),
  ]);
  const data = (await f.domain.load('skyline')).data;
  assert.equal(data.orders.length, 1);
  assert.equal(data.pointLedger.filter((p) => p.kind === 'redemption').length, 1);
  assert.equal(availablePoints(data.members[0], data.pointLedger), 1);
  assert.equal(f.refunds(), 1);
});

test('points can cover all merchandise with no gateway charge and durable replay', async () => {
  const f = await fixture();
  await pointWallet(f, 500);
  const input = {
    clubId: 'skyline',
    action: {
      type: 'orders',
      args: { productId: 'product', size: 'M', quantity: 1, pointsToRedeem: 500 },
    },
    idempotencyKey: crypto.randomUUID(),
  };
  const first = await f.service.create(input, user);
  assert.equal(first.status, 'Fulfilled');
  assert.equal(first.total, 0);
  assert.equal(first.pointsRedeemed, 400);
  const repeat = await f.service.create(input, user);
  assert.equal(repeat.order.id, first.order.id);
  assert.equal(f.orders(), 0);
  const data = (await f.domain.load('skyline')).data;
  assert.equal(availablePoints(data.members[0], data.pointLedger), 100);
  assert.equal(data.orders.length, 1);
});

test('an admin rate change during payment cannot silently spend more points at the same cash price', async () => {
  const f = await fixture();
  await pointWallet(f, 1000);
  let state = await f.domain.load('skyline');
  state.data.members[0].status = 'Pending';
  await f.repo.put(state);
  const checkout = await f.start('orders', {
    productId: 'product',
    size: 'M',
    quantity: 1,
    joinMembership: true,
    pointsToRedeem: 1000,
  });
  assert.equal(checkout.order.amount, 50000);
  state = await f.domain.load('skyline');
  state.data.pointRules.redemptionValuePaise = 50;
  await f.repo.put(state);
  const result = await f.service.verify(checkout.verify, user);
  assert.equal(result.status, 'Refunded');
  state = await f.domain.load('skyline');
  assert.equal(state.data.orders.length, 0);
  assert.equal(availablePoints(state.data.members[0], state.data.pointLedger), 1000);
  assert.equal(f.refunds(), 1);
});
const env = {
  RAZORPAY_KEY_ID: 'rzp_test_fixture',
  RAZORPAY_KEY_SECRET: 'fixture-secret',
  RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
};
const sign = (body, secret = env.RAZORPAY_KEY_SECRET) =>
  createHmac('sha256', secret).update(body).digest('hex');
async function fixture() {
  const repo = new MemoryRepository();
  const seed = JSON.parse(readFileSync(new URL('../../data/seed.json', import.meta.url), 'utf8'))
    .clubs.skyline;
  seed.members = [];
  seed.tickets = [];
  seed.orders = [];
  seed.transactions = [];
  seed.events = [
    {
      id: 'event',
      title: 'Test event',
      date: '2099-10-10',
      time: '18:00',
      capacity: 1,
      sold: 0,
      price: 100,
      memberPrice: 50,
    },
  ];
  seed.products = [
    {
      id: 'product',
      name: 'Test tee',
      type: 'T-shirt',
      price: 600,
      memberPrice: 400,
      stock: { M: 1 },
    },
  ];
  await repo.put({ pk: clubKey('skyline'), sk: 'STATE', version: 1, data: seed });
  await repo.put({
    ...user,
    pk: 'USER#' + user.id,
    sk: 'PROFILE',
    emailVerified: true,
    sessionVersion: 1,
    createdAt: new Date().toISOString(),
  });
  const domain = createDomain({ repo, clubs: [{ id: 'skyline' }], paymentsRequired: true });
  const service = new PaymentsService({ repo, domain, env });
  let orders = 0,
    refunds = 0;
  const payments = new Map();
  const refundRecords = new Map();
  service.gateway.createOrder = async (amount) => ({
    id: 'order_' + ++orders,
    amount,
    currency: 'INR',
  });
  service.gateway.fetchPayment = async (id) => payments.get(id);
  service.gateway.orderPayments = async (id) => ({
    items: [...payments.values()].filter((p) => p.order_id === id),
  });
  service.gateway.refund = async (id, amount, receipt) => {
    if (refundRecords.has(receipt)) return refundRecords.get(receipt);
    const refund = {
      id: 'refund_' + ++refunds,
      amount,
      payment_id: id,
      currency: 'INR',
      receipt,
      status: 'processed',
    };
    refundRecords.set(receipt, refund);
    payments.get(id).amount_refunded = amount;
    return refund;
  };
  service.gateway.fetchRefund = async (id) => [...refundRecords.values()].find((r) => r.id === id);
  service.gateway.paymentRefunds = async (id) =>
    [...refundRecords.values()].filter((r) => r.payment_id === id);
  const start = async (type = 'tickets.book', args = { eventId: 'event' }) => {
    const input = {
      clubId: 'skyline',
      action: { type, args },
      idempotencyKey: crypto.randomUUID(),
    };
    const order = await service.create(input, user);
    const paymentId = 'payment_' + orders;
    payments.set(paymentId, {
      id: paymentId,
      order_id: order.orderId,
      amount: order.amount,
      currency: 'INR',
      status: 'captured',
      captured: true,
      amount_refunded: 0,
    });
    const verify = {
      idempotencyKey: input.idempotencyKey,
      razorpay_order_id: order.orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(order.orderId + '|' + paymentId),
    };
    return { input, order, verify, payment: payments.get(paymentId) };
  };
  return {
    repo,
    domain,
    service,
    start,
    refundRecords,
    payments,
    orders: () => orders,
    refunds: () => refunds,
  };
}
test('test credentials only, constant time signature rejects malformed and forged input', () => {
  assert.throws(
    () =>
      new RazorpayService({
        env: { ...env, RAZORPAY_KEY_ID: 'rzp_live_forbidden' },
      }).assertConfigured(),
    /test payments/,
  );
  assert.equal(validSignature('body', sign('body'), env.RAZORPAY_KEY_SECRET), true);
  for (const bad of [undefined, 'f'.repeat(64), 'é'.repeat(64), 'abc'])
    assert.equal(validSignature('body', bad, env.RAZORPAY_KEY_SECRET), false);
});
test('server prices cannot be bypassed; duplicate create reuses one order', async () => {
  const f = await fixture();
  await assert.rejects(
    f.domain.execute(
      'skyline',
      {
        type: 'tickets.book',
        args: { eventId: 'event', amount: 0 },
        idempotencyKey: crypto.randomUUID(),
      },
      user,
    ),
    (error) => error.status === 402,
  );
  const { input, order } = await f.start();
  assert.equal(order.amount, 10000);
  await f.service.create(input, user);
  assert.equal(f.orders(), 1);
  assert.equal((await f.domain.load('skyline')).data.tickets.length, 0);
  await assert.rejects(
    f.service.create(
      {
        ...input,
        action: { type: 'orders', args: { productId: 'product', size: 'M', quantity: 1 } },
      },
      user,
    ),
    (error) => error.status === 409,
  );
});
test('forged callback, another user, incorrect amount and authorized payment never issue tickets', async () => {
  const f = await fixture(),
    { verify, payment } = await f.start();
  await assert.rejects(
    f.service.verify({ ...verify, razorpay_signature: '0'.repeat(64) }, user),
    (error) => error.status === 400,
  );
  await assert.rejects(
    f.service.verify(verify, { ...user, id: 'other' }),
    (error) => error.status === 404,
  );
  payment.amount = 1;
  await assert.rejects(f.service.verify(verify, user), (error) => error.status === 400);
  payment.amount = 10000;
  payment.status = 'authorized';
  payment.captured = false;
  assert.equal((await f.service.verify(verify, user)).status, 'Created');
  assert.equal((await f.domain.load('skyline')).data.tickets.length, 0);
});
test('concurrent callback and signed webhook fulfill atomically once, including persistent retries', async () => {
  const f = await fixture(),
    { verify, payment } = await f.start();
  const payload = { event: 'payment.captured', payload: { payment: { entity: payment } } };
  const raw = Buffer.from(JSON.stringify(payload));
  await assert.rejects(
    f.service.webhook(raw, '0'.repeat(64), payload),
    (error) => error.status === 401,
  );
  await Promise.all([
    f.service.verify(verify, user),
    f.service.webhook(raw, sign(raw, env.RAZORPAY_WEBHOOK_SECRET), payload),
    f.service.verify(verify, user),
  ]);
  const state = (await f.domain.load('skyline')).data;
  assert.equal(state.tickets.length, 1);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.tickets[0].paymentId, payment.id);
  assert.equal((await f.service.status(verify.idempotencyKey, user)).status, 'Fulfilled');
  await f.service.verify(verify, user);
  assert.equal(f.refunds(), 0);
  await assert.rejects(
    f.domain.execute(
      'skyline',
      {
        type: 'tickets.cancel',
        args: { ticketId: state.tickets[0].id },
        idempotencyKey: crypto.randomUUID(),
      },
      user,
    ),
    /refund/,
  );
});
test('merchandise including membership bundle records captured test payment and server discount', async () => {
  const f = await fixture();
  await approveMember(f);
  const { verify } = await f.start('orders', {
    productId: 'product',
    size: 'M',
    quantity: 1,
    joinMembership: true,
  });
  const result = await f.service.verify(verify, user);
  assert.equal(result.total, 900);
  assert.equal(result.state.products[0].stock.M, 0);
  assert.equal(result.state.members[0].status, 'Active');
  assert.ok(result.state.orders[0].paymentId);
});
test('membership checkout only pays the current member and blocks direct simulated dues', async () => {
  const f = await fixture();
  await f.domain.execute(
    'skyline',
    { type: 'membership.join', args: {}, idempotencyKey: crypto.randomUUID() },
    user,
  );
  await assert.rejects(f.start('membership.demo-dues', {}), (error) => error.status === 403);
  await approveMember(f);
  await assert.rejects(
    f.domain.execute(
      'skyline',
      { type: 'membership.demo-dues', args: {}, idempotencyKey: crypto.randomUUID() },
      user,
    ),
    (error) => error.status === 402,
  );
  const { verify } = await f.start('membership.demo-dues', {});
  assert.equal((await f.service.verify(verify, user)).state.members[0].status, 'Active');

  // Renewal > 7 days before expiry is blocked
  await assert.rejects(f.start('membership.demo-dues', {}), (error) => error.status === 409);

  // Renewal within 1 week of expiry is allowed and extends membership
  const clubState = await f.repo.get(clubKey('skyline'), 'STATE');
  clubState.data.members[0].expires = '2026-10-15';
  await f.repo.put(clubState);

  const renew = await f.start('membership.demo-dues', {});
  const renewedResult = await f.service.verify(renew.verify, user);
  assert.equal(renewedResult.state.members[0].status, 'Active');
  assert.equal(renewedResult.state.members[0].expires, '2027-07-31');
});

test('a product delisted during checkout is refunded rather than fulfilled', async () => {
  const f = await fixture(),
    { verify } = await f.start('orders', { productId: 'product', size: 'M', quantity: 1 });
  const state = await f.repo.get(clubKey('skyline'), 'STATE');
  state.data.products[0].delisted = true;
  await f.repo.put(state);
  assert.equal((await f.service.verify(verify, user)).status, 'Refunded');
  assert.equal((await f.domain.load('skyline')).data.orders.length, 0);
  assert.equal(f.refunds(), 1);
});
test('lost browser callback recovers through status; last-seat race refunds the loser once', async () => {
  const f = await fixture();
  const first = await f.start(),
    second = await f.start();
  assert.equal((await f.service.status(first.input.idempotencyKey, user)).status, 'Fulfilled');
  assert.equal((await f.service.verify(second.verify, user)).status, 'Refunded');
  await f.service.verify(second.verify, user);
  assert.equal(f.refunds(), 1);
  assert.equal((await f.domain.load('skyline')).data.tickets.length, 1);
});
test('ambiguous refund response remains pending and is never blindly retried', async () => {
  const f = await fixture(),
    first = await f.start(),
    second = await f.start();
  await f.service.verify(first.verify, user);
  let calls = 0;
  f.service.gateway.refund = async () => {
    calls++;
    throw new Error('timeout');
  };
  assert.equal((await f.service.verify(second.verify, user)).status, 'RefundPending');
  assert.equal((await f.service.verify(second.verify, user)).status, 'RefundPending');
  assert.equal(calls, 1);
});

test('free ticket requires no gateway order and remains idempotent', async () => {
  const f = await fixture();
  const state = await f.repo.get(clubKey('skyline'), 'STATE');
  state.data.events[0].price = 0;
  await f.repo.put(state);
  const input = {
    clubId: 'skyline',
    action: { type: 'tickets.book', args: { eventId: 'event' } },
    idempotencyKey: crypto.randomUUID(),
  };
  assert.equal((await f.service.create(input, user)).status, 'Fulfilled');
  assert.equal((await f.service.create(input, user)).status, 'Fulfilled');
  // Retry a free booking directly with the durable business request key.
  const result = await f.domain.execute(
    'skyline',
    { ...input.action, idempotencyKey: input.idempotencyKey },
    user,
  );
  assert.equal(result.ticket.amount, 0);
  assert.equal(f.orders(), 0);
});

test('HTTP webhook accepts only correctly signed raw JSON without browser headers; payments require auth', async () => {
  const f = await fixture();
  const app = createApp({
    repo: f.repo,
    clubs: [{ id: 'skyline' }],
    env: { ...env, NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(64) },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const body = '{ "event": "unsupported.event" }';
    const send = (signature) =>
      fetch(base + '/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(signature ? { 'x-razorpay-signature': signature } : {}),
        },
        body,
      });
    assert.equal((await send()).status, 401);
    assert.equal((await send(sign(body, env.RAZORPAY_WEBHOOK_SECRET))).status, 200);
    assert.equal((await fetch(base + '/api/payments/test-key')).status, 401);
    assert.equal(
      (
        await fetch(base + '/api/payments/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
      403,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

const staff = { id: 'refund-admin', name: 'Refund Admin', email: 'refund-admin@example.test' };
async function allowReviewer(f, clubId = 'skyline', role = 'admin') {
  await f.repo.put({ pk: 'USER#' + staff.id, sk: 'ACCESS#' + clubId, clubId, role });
}
async function approveMember(f) {
  if (!(await f.domain.load('skyline')).data.members.some((member) => member.userId === user.id))
    await f.domain.execute(
      'skyline',
      { type: 'membership.join', args: {}, idempotencyKey: crypto.randomUUID() },
      user,
    );
  await allowReviewer(f);
  await f.domain.execute(
    'skyline',
    {
      type: 'membership.approve',
      args: { memberId: user.id },
      idempotencyKey: crypto.randomUUID(),
    },
    staff,
  );
}
async function purchased(f, type, args) {
  const checkout = await f.start(type, args);
  await f.service.verify(checkout.verify, user);
  return checkout;
}
test('members request only their own paid purchases; refund review is club-scoped and role-protected', async () => {
  const f = await fixture(),
    checkout = await purchased(f);
  const input = { paymentId: checkout.payment.id, reason: 'I cannot attend this event.' };
  await assert.rejects(
    f.service.refunds.request('skyline', input, { ...user, id: 'other' }),
    (error) => error.status === 404,
  );
  await assert.rejects(
    f.service.refunds.request('skyline', { ...input, amount: 1 }, user),
    (error) => error.status === 400,
  );
  const requested = await f.service.refunds.request('skyline', input, user);
  assert.equal(requested.refund.status, 'Requested');
  assert.equal(
    (await f.service.refunds.request('skyline', input, user)).refund.id,
    requested.refund.id,
  );
  await assert.rejects(
    f.service.refunds.review('skyline', checkout.payment.id, { decision: 'approve' }, user),
    (error) => error.status === 403,
  );
  await allowReviewer(f, 'other-club');
  await assert.rejects(
    f.service.refunds.review('skyline', checkout.payment.id, { decision: 'approve' }, staff),
    (error) => error.status === 403,
  );
  const otherList = await f.service.refunds.list('skyline', { ...user, id: 'other' });
  assert.equal(otherList.requests.length, 0);
  assert.equal(otherList.payments.length, 0);
  assert.equal((await f.domain.load('skyline')).data.tickets[0].status, 'Confirmed');
  assert.equal(f.refunds(), 0);
});
test('pending refunds lock entry; processed confirmation cancels once, credits ledger and promotes waitlist', async () => {
  const f = await fixture(),
    checkout = await purchased(f);
  await allowReviewer(f);
  await f.domain.execute(
    'skyline',
    { type: 'waitlist.join', args: { eventId: 'event' }, idempotencyKey: crypto.randomUUID() },
    { id: 'waiting', name: 'Waiting Guest', email: 'waiting@example.test' },
  );
  await f.service.refunds.request(
    'skyline',
    { paymentId: checkout.payment.id, reason: 'I cannot attend this event.' },
    user,
  );
  let remote;
  f.service.gateway.refund = async (id, amount, receipt) =>
    (remote ||= {
      id: 'pending-refund',
      payment_id: id,
      amount,
      receipt,
      currency: 'INR',
      status: 'pending',
    });
  f.service.gateway.fetchRefund = async () => remote;
  const approved = await f.service.refunds.review(
    'skyline',
    checkout.payment.id,
    { decision: 'approve' },
    staff,
  );
  assert.equal(approved.refund.status, 'Processing');
  let data = (await f.domain.load('skyline')).data;
  assert.equal(data.tickets[0].refundPending, true);
  assert.equal(data.events[0].sold, 1);
  assert.equal(data.transactions.length, 1);
  await assert.rejects(
    f.domain.execute(
      'skyline',
      {
        type: 'check-in',
        args: { ticketId: data.tickets[0].id },
        idempotencyKey: crypto.randomUUID(),
      },
      staff,
    ),
    /locked/,
  );
  remote.status = 'processed';
  await Promise.all([
    f.service.refunds.refresh('skyline', checkout.payment.id, user),
    f.service.refunds.refresh('skyline', checkout.payment.id, staff),
  ]);
  data = (await f.domain.load('skyline')).data;
  assert.equal(data.tickets[0].status, 'Cancelled');
  assert.equal(data.waitlist[0].status, 'Promoted');
  assert.equal(data.events[0].sold, 1);
  assert.equal(data.transactions.filter((t) => t.amount < 0).length, 1);
  assert.equal(
    data.transactions.reduce((sum, t) => sum + t.amount, 0),
    0,
  );
  await f.service.refunds.refresh('skyline', checkout.payment.id, user);
  assert.equal((await f.domain.load('skyline')).data.transactions.length, 2);
});
test('refund rejection requires explanation and leaves purchase unchanged; resubmission is audited', async () => {
  const f = await fixture(),
    checkout = await purchased(f);
  await allowReviewer(f);
  await f.service.refunds.request(
    'skyline',
    { paymentId: checkout.payment.id, reason: 'Please refund my ticket.' },
    user,
  );
  await assert.rejects(
    f.service.refunds.review('skyline', checkout.payment.id, { decision: 'reject' }, staff),
    (error) => error.status === 400,
  );
  const rejected = await f.service.refunds.review(
    'skyline',
    checkout.payment.id,
    { decision: 'reject', reason: 'Please provide a clearer reason.' },
    staff,
  );
  assert.equal(rejected.refund.status, 'Rejected');
  assert.equal(f.refunds(), 0);
  const next = await f.service.refunds.request(
    'skyline',
    { paymentId: checkout.payment.id, reason: 'I have a conflicting exam.' },
    user,
  );
  assert.notEqual(next.refund.id, rejected.refund.id);
  assert.equal((await f.domain.load('skyline')).data.tickets[0].refundPending, undefined);
});
test('bundle refund restores stock, membership and contribution points without partial cancellation', async () => {
  const f = await fixture();
  await approveMember(f);
  const checkout = await purchased(f, 'orders', {
    productId: 'product',
    size: 'M',
    quantity: 1,
    joinMembership: true,
  });
  await allowReviewer(f);
  let data = (await f.domain.load('skyline')).data;
  assert.equal(data.members[0].membershipPaymentId, checkout.payment.id);
  assert.ok(data.members[0].contributionPoints > 0);
  await f.service.refunds.request(
    'skyline',
    { paymentId: checkout.payment.id, reason: 'Please cancel my entire bundle.' },
    user,
  );
  const result = await f.service.refunds.review(
    'skyline',
    checkout.payment.id,
    { decision: 'approve' },
    staff,
  );
  assert.equal(result.refund.status, 'Processed');
  data = (await f.domain.load('skyline')).data;
  assert.equal(data.products[0].stock.M, 1);
  assert.equal(data.orders[0].status, 'Cancelled');
  assert.equal(data.members[0].status, 'Pending');
  assert.equal(data.members[0].contributionPoints, 0);
  assert.ok(data.pointLedger.some((entry) => entry.reversed));
  assert.equal(
    data.pointLedger.reduce((sum, entry) => sum + entry.points, 0),
    0,
  );
  assert.equal(
    data.transactions.reduce((sum, t) => sum + t.amount, 0),
    0,
  );
});
test('membership refund failure restores entitlement; staff retry uses a new key only after confirmed failure', async () => {
  const f = await fixture();
  await allowReviewer(f);
  await f.domain.execute(
    'skyline',
    { type: 'membership.join', args: {}, idempotencyKey: crypto.randomUUID() },
    user,
  );
  await approveMember(f);
  const checkout = await purchased(f, 'membership.demo-dues', {});
  await f.service.refunds.request(
    'skyline',
    { paymentId: checkout.payment.id, reason: 'Please cancel my unused membership.' },
    user,
  );
  const keys = [];
  f.service.gateway.refund = async (id, amount, receipt) => {
    keys.push(receipt);
    return {
      id: 'refund-' + keys.length,
      payment_id: id,
      amount,
      receipt,
      currency: 'INR',
      status: keys.length === 1 ? 'failed' : 'processed',
    };
  };
  assert.equal(
    (await f.service.refunds.review('skyline', checkout.payment.id, { decision: 'approve' }, staff))
      .refund.status,
    'Failed',
  );
  let member = (await f.domain.load('skyline')).data.members[0];
  assert.equal(member.status, 'Active');
  assert.equal(member.refundPending, undefined);
  assert.equal(
    (await f.service.refunds.review('skyline', checkout.payment.id, { decision: 'approve' }, staff))
      .refund.status,
    'Processed',
  );
  assert.notEqual(keys[0], keys[1]);
  member = (await f.domain.load('skyline')).data.members[0];
  assert.equal(member.status, 'Pending');
});
test('ambiguous provider response reconciles with the same refund key and never credits before confirmation', async () => {
  const f = await fixture(),
    checkout = await purchased(f);
  await allowReviewer(f);
  await f.service.refunds.request(
    'skyline',
    { paymentId: checkout.payment.id, reason: 'Please cancel my ticket.' },
    user,
  );
  const keys = [];
  let calls = 0;
  f.service.gateway.refund = async (id, amount, receipt) => {
    keys.push(receipt);
    calls++;
    if (calls === 1) throw Error('timeout');
    return {
      id: 'recovered-refund',
      payment_id: id,
      amount,
      receipt,
      currency: 'INR',
      status: 'processed',
    };
  };
  f.service.gateway.paymentRefunds = async () => [];
  assert.equal(
    (await f.service.refunds.review('skyline', checkout.payment.id, { decision: 'approve' }, staff))
      .refund.status,
    'NeedsReview',
  );
  assert.equal((await f.domain.load('skyline')).data.transactions.length, 1);
  assert.equal(
    (await f.service.refunds.refresh('skyline', checkout.payment.id, user)).refund.status,
    'Processed',
  );
  assert.equal(keys[0], keys[1]);
});
test('checked-in tickets and picked-up orders cannot be requested or approved for refund', async () => {
  const f = await fixture(),
    checkout = await purchased(f);
  await allowReviewer(f, 'skyline', 'treasurer');
  await f.service.refunds.request(
    'skyline',
    { paymentId: checkout.payment.id, reason: 'Please cancel my ticket.' },
    user,
  );
  const state = await f.repo.get(clubKey('skyline'), 'STATE');
  state.data.tickets[0].checkedIn = true;
  await f.repo.put(state);
  await assert.rejects(
    f.service.refunds.review('skyline', checkout.payment.id, { decision: 'approve' }, staff),
    /Checked-in/,
  );
  const g = await fixture(),
    order = await purchased(g, 'orders', { productId: 'product', size: 'M', quantity: 1 });
  const orderState = await g.repo.get(clubKey('skyline'), 'STATE');
  orderState.data.orders[0].status = 'Picked up';
  await g.repo.put(orderState);
  await assert.rejects(
    g.service.refunds.request(
      'skyline',
      { paymentId: order.payment.id, reason: 'Please cancel this purchase.' },
      user,
    ),
    /Picked-up/,
  );
  assert.equal(f.refunds(), 0);
  assert.equal(g.refunds(), 0);
});
test('signed refund webhook fetches provider truth and remains idempotent', async () => {
  const f = await fixture(),
    checkout = await purchased(f);
  await allowReviewer(f);
  await f.service.refunds.request(
    'skyline',
    { paymentId: checkout.payment.id, reason: 'Please cancel my ticket.' },
    user,
  );
  let remote;
  f.service.gateway.refund = async (id, amount, receipt) =>
    (remote = {
      id: 'webhook-refund',
      payment_id: id,
      amount,
      receipt,
      currency: 'INR',
      status: 'pending',
    });
  f.service.gateway.fetchRefund = async () => remote;
  await f.service.refunds.review('skyline', checkout.payment.id, { decision: 'approve' }, staff);
  const payload = {
    event: 'refund.processed',
    payload: {
      refund: {
        entity: { id: remote.id, payment_id: remote.payment_id, status: 'processed', amount: 1 },
      },
    },
  };
  const raw = Buffer.from(JSON.stringify(payload));
  await f.service.webhook(raw, sign(raw, env.RAZORPAY_WEBHOOK_SECRET), payload);
  assert.equal(
    (await f.service.refunds.record('skyline', checkout.payment.id)).status,
    'Processing',
  );
  remote.status = 'processed';
  await Promise.all([
    f.service.webhook(raw, sign(raw, env.RAZORPAY_WEBHOOK_SECRET), payload),
    f.service.webhook(raw, sign(raw, env.RAZORPAY_WEBHOOK_SECRET), payload),
  ]);
  assert.equal(
    (await f.service.refunds.record('skyline', checkout.payment.id)).status,
    'Processed',
  );
  assert.equal(
    (await f.domain.load('skyline')).data.transactions.filter((t) => t.amount < 0).length,
    1,
  );
});
