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

const user = { id: 'test-user', name: 'Test User', email: 'test@example.test' };
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
  service.gateway.createOrder = async (amount) => ({
    id: 'order_' + ++orders,
    amount,
    currency: 'INR',
  });
  service.gateway.fetchPayment = async (id) => payments.get(id);
  service.gateway.orderPayments = async (id) => ({
    items: [...payments.values()].filter((p) => p.order_id === id),
  });
  service.gateway.refund = async (id, amount) => ({ id: 'refund_' + ++refunds, amount });
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
  return { repo, domain, service, start, orders: () => orders, refunds: () => refunds };
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
  const f = await fixture(),
    { verify } = await f.start('orders', {
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
  await assert.rejects(f.service.verify(second.verify, user), /timeout/);
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
