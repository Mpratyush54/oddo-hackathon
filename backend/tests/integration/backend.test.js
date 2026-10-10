import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { MemoryRepository, clubKey } from '../../src/database/repositories/index.js';
import { createDomain, visibleState } from '../../src/modules/clubs/club.service.js';
import { createProviders } from '../../src/modules/communications/providers.service.js';

const clubs = [
  { id: 'skyline', name: 'Skyline' },
  { id: 'canvas', name: 'Canvas' },
];
const user = { id: 'USR-one', name: 'One', email: 'one@example.test' },
  other = { id: 'USR-two', name: 'Two', email: 'two@example.test' };
const initial = () => ({
  members: [],
  events: [
    {
      id: 'E1',
      title: 'Future',
      date: '2099-10-10',
      time: '16:00',
      capacity: 1,
      sold: 0,
      price: 100,
      memberPrice: 50,
    },
  ],
  products: [
    { id: 'P1', name: 'Hoodie', type: 'Hoodie', price: 500, memberPrice: 400, stock: { M: 1 } },
  ],
  orders: [],
  tickets: [],
  transactions: [],
  announcements: [],
  tasks: [],
  notifications: [],
  deliveries: [],
  audit: [],
  waitlist: [],
  pointLedger: [],
  promos: [],
});
async function fixture() {
  const repo = new MemoryRepository();
  for (const club of clubs)
    await repo.put({ pk: clubKey(club.id), sk: 'STATE', version: 1, data: initial() });
  return { repo, domain: createDomain({ repo, clubs }) };
}
const action = (type, args = {}, idempotencyKey = crypto.randomUUID()) => ({
  type,
  args,
  idempotencyKey,
});

test('concurrent last-seat and stock requests commit once; duplicate request does not charge again', async () => {
  const { repo, domain } = await fixture();
  const booking = action('tickets.book', { eventId: 'E1', amount: 0, actor: other });
  const outcomes = await Promise.allSettled([
    domain.execute('skyline', booking, user),
    domain.execute('skyline', action('tickets.book', { eventId: 'E1' }), other),
  ]);
  assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1);
  const accepted = outcomes.find((x) => x.status === 'fulfilled').value;
  assert.equal(accepted.ticket.amount, 100);
  await domain.execute('skyline', booking, user);
  let state = (await domain.load('skyline')).data;
  assert.equal(state.tickets.length, 1);
  assert.equal(state.transactions.length, 1);
  const orders = await Promise.allSettled(
    [user, other].map((u) =>
      domain.execute('skyline', action('orders', { productId: 'P1', size: 'M', quantity: 1 }), u),
    ),
  );
  assert.equal(
    orders.filter((x) => x.status === 'fulfilled').length,
    1,
    orders
      .filter((x) => x.status === 'rejected')
      .map((x) => x.reason.message)
      .join('; '),
  );
  state = (await domain.load('skyline')).data;
  assert.equal(state.products[0].stock.M, 0);
  assert.equal((await repo.list(clubKey('skyline'), 'AUDIT#')).length, 2);
});
test('roles, cross-club scope, private data and duplicate check-in are enforced', async () => {
  const { repo, domain } = await fixture();
  await repo.put({
    pk: `USER#${user.id}`,
    sk: 'ACCESS#skyline',
    role: 'organizer',
    clubId: 'skyline',
  });
  const booked = await domain.execute('skyline', action('tickets.book', { eventId: 'E1' }), other);
  await assert.rejects(
    domain.execute('canvas', action('check-in', { ticketId: booked.ticket.id }), user),
    (e) => e.status === 403,
  );
  await domain.execute('skyline', action('check-in', { ticketId: booked.ticket.id }), user);
  await assert.rejects(
    domain.execute('skyline', action('check-in', { ticketId: booked.ticket.id }), user),
    (e) => e.status === 409,
  );
  const state = visibleState((await domain.load('skyline')).data, user, 'member');
  assert.equal(state.tickets.length, 0);
  assert.equal(state.transactions.length, 0);
  await assert.rejects(
    domain.execute(
      'skyline',
      action('inventory', { productId: 'P1', size: 'M', delta: 100, reason: 'Spoof' }),
      other,
    ),
    (e) => e.status === 403,
  );
});
test('a promoted waitlist member can claim the reserved last seat without overselling', async () => {
  const { domain } = await fixture();
  const ticket = (await domain.execute('skyline', action('tickets.book', { eventId: 'E1' }), user))
    .ticket;
  await domain.execute('skyline', action('waitlist.join', { eventId: 'E1' }), other);
  await domain.execute('skyline', action('tickets.cancel', { ticketId: ticket.id }), user);
  const booked = await domain.execute('skyline', action('tickets.book', { eventId: 'E1' }), other);
  assert.equal(booked.state.events[0].sold, 1);
  assert.equal(
    (await domain.load('skyline')).data.tickets.filter((t) => t.status !== 'Cancelled').length,
    1,
  );
  assert.equal(
    visibleState((await domain.load('skyline')).data, user, 'member').notifications.length,
    0,
  );
});
test('expense approval requires finance role, pending state, and another reviewer', async () => {
  const { repo, domain } = await fixture();
  await domain.execute(
    'skyline',
    action('expenses.create', {
      title: 'Supplies',
      amount: 99,
      receipt: 'receipt.pdf',
      receiptKey: `skyline-campus/skyline/${other.id}/RECEIPT`,
    }),
    other,
  );
  const tx = (await domain.load('skyline')).data.transactions[0];
  await assert.rejects(
    domain.execute(
      'skyline',
      action('expenses.review', { transactionId: tx.id, status: 'Completed' }),
      user,
    ),
    (e) => e.status === 403,
  );
  await repo.put({
    pk: `USER#${user.id}`,
    sk: 'ACCESS#skyline',
    role: 'treasurer',
    clubId: 'skyline',
  });
  await domain.execute(
    'skyline',
    action('expenses.review', { transactionId: tx.id, status: 'Completed' }),
    user,
  );
  await assert.rejects(
    domain.execute(
      'skyline',
      action('expenses.review', { transactionId: tx.id, status: 'Rejected', reason: 'No' }),
      user,
    ),
    (e) => e.status === 409,
  );
});
test('JWT cookies, forged tokens, CSRF, refresh rotation, logout and password revocation', async (t) => {
  const { repo } = await fixture();
  const app = createApp({
    env: { JWT_SECRET: 'a'.repeat(128), APP_ORIGIN: 'http://localhost:5174' },
    repo,
    clubs,
    fetchImpl: () => {
      throw new Error('No provider calls expected');
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const jar = new Map();
  let csrf;
  async function request(route, body, extra = {}) {
    const response = await fetch(base + route, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-skyline-client': 'web',
        origin: 'http://localhost:5174',
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const value of response.headers.getSetCookie()) {
      const [name, token] = value.split(';')[0].split('=');
      jar.set(name, token);
    }
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await request('/auth/me')).status, 401);
  const invalidSignup = await request('/auth/signup', {
    name: 'Student',
    email: 'invalid',
    password: 'short',
  });
  assert.equal(invalidSignup.status, 400);
  assert.ok(invalidSignup.body.details.some((item) => item.field === 'email'));
  assert.ok(invalidSignup.body.details.some((item) => item.field === 'password'));
  assert.ok(!JSON.stringify(invalidSignup.body).includes('short'));
  const signup = await request('/auth/signup', {
    name: 'Student',
    email: 'student@example.test',
    password: 'long-enough-password',
    role: 'admin',
  });
  assert.equal(signup.status, 201);
  csrf = signup.body.csrfToken;
  assert.equal(jar.get('skyline-access').split('.').length, 3);
  assert.deepEqual((await request('/auth/me')).body.roles, {});
  assert.equal((await request('/cl clubs', {})).status, 404);
  assert.equal((await request('/cl clubs', {}, { origin: 'https://evil.test' })).status, 403);
  assert.equal(
    (
      await request('/clubs/skyline/actions', action('membership.join'), {
        'x-csrf-token': 'wrong',
      })
    ).status,
    403,
  );
  assert.equal((await request('/clubs/skyline/actions', action('membership.join'))).status, 200);
  const invalidPreferences = await request(
    '/clubs/skyline/actions',
    action('profile.preferences', {
      phone: 'not-a-phone',
      whatsappOptIn: true,
    }),
  );
  assert.equal(invalidPreferences.status, 400);
  assert.equal(invalidPreferences.body.details[0].field, 'phone');
  const oldRefresh = jar.get('skyline-access-refresh');
  const refreshed = await request('/auth/refresh', {});
  assert.equal(refreshed.status, 200);
  csrf = refreshed.body.csrfToken;
  assert.notEqual(jar.get('skyline-access-refresh'), oldRefresh);
  const oldAccess = jar.get('skyline-access');
  const changed = await request('/auth/password', {
    currentPassword: 'long-enough-password',
    password: 'another-long-password',
  });
  assert.equal(changed.status, 200);
  csrf = changed.body.csrfToken;
  assert.equal(
    (await request('/auth/me', undefined, { cookie: `skyline-access=${oldAccess}` })).status,
    401,
  );
  assert.equal((await request('/auth/logout', {})).status, 200);
  assert.equal((await request('/auth/me')).status, 401);
  assert.equal(
    (await request('/auth/login', { email: 'student@example.test', password: 'wrong' })).status,
    401,
  );
  const login = await request('/auth/login', {
    email: 'student@example.test',
    password: 'another-long-password',
  });
  assert.equal(login.status, 200);
  assert.equal(
    (await request('/auth/refresh', {}, { cookie: `skyline-access-refresh=${oldRefresh}` })).status,
    401,
  );
  assert.equal((await request('/auth/me')).status, 200);
  assert.equal(
    (await request('/auth/me', undefined, { cookie: 'skyline-access=forged.jwt.token' })).status,
    401,
  );
  const activeRefresh = jar.get('skyline-access-refresh');
  assert.equal((await request('/auth/refresh', {})).status, 200);
  assert.equal(
    (await request('/auth/refresh', {}, { cookie: `skyline-access-refresh=${activeRefresh}` }))
      .status,
    401,
  );
  assert.equal((await request('/auth/me')).status, 401);
});

test('invalid action payloads leave state, audit and idempotency records unchanged', async () => {
  const { repo, domain } = await fixture();
  await repo.put({ pk: `USER#${user.id}`, sk: 'ACCESS#skyline', clubId: 'skyline', role: 'admin' });
  const before = await domain.load('skyline');
  const invalidActions = [
    action('expenses.create', {
      title: 'Supplies',
      amount: -2,
      receipt: 'a.pdf',
      receiptKey: `skyline-campus/skyline/${user.id}/R`,
    }),
    action('expenses.review', { transactionId: 'TX-missing', status: 'Pending' }),
    action('expenses.review', { transactionId: 'TX-missing', status: 'Rejected', reason: '   ' }),
    action('inventory', { productId: 'P1', size: 'M', delta: 501, reason: 'Restock' }),
    action('promos.save', { promo: { code: 'SAVE10', type: 'percent', value: 101 } }),
    action('tasks.save', { task: { title: 'Task', due: '2026-02-30', status: 'Done' } }),
    { ...action('membership.join'), idempotencyKey: 'bad!request' },
    { ...action('membership.join'), args: [] },
  ];
  for (const request of invalidActions) {
    await assert.rejects(domain.execute('skyline', request, user), (error) => {
      assert.equal(error.status, 400);
      assert.ok(error.details.length > 0);
      return true;
    });
  }
  assert.deepEqual(await domain.load('skyline'), before);
  assert.equal((await repo.list(clubKey('skyline'), 'AUDIT#')).length, 0);
  assert.equal((await repo.list(clubKey('skyline'), 'REQUEST#')).length, 0);
});

test('expense rejection requires a reason, a different treasurer, and a pending negative transaction', async () => {
  const { repo, domain } = await fixture();
  for (const person of [user, other])
    await repo.put({
      pk: `USER#${person.id}`,
      sk: 'ACCESS#skyline',
      clubId: 'skyline',
      role: 'treasurer',
    });
  await domain.execute(
    'skyline',
    action('expenses.create', {
      title: 'Supplies',
      amount: 99,
      receipt: 'a.pdf',
      receiptKey: `skyline-campus/skyline/${other.id}/R`,
    }),
    other,
  );
  const expense = (await domain.load('skyline')).data.transactions[0];
  const review = (args) =>
    action('expenses.review', { transactionId: expense.id, status: 'Rejected', ...args });
  await assert.rejects(
    domain.execute('skyline', review({}), user),
    (error) => error.status === 400,
  );
  await assert.rejects(
    domain.execute('skyline', review({ reason: 'Missing invoice' }), other),
    (error) => error.status === 403,
  );
  assert.equal((await domain.load('skyline')).data.transactions[0].status, 'Pending');
  await domain.execute(
    'skyline',
    review({ reason: '  Missing invoice  ', reviewedBy: other.id }),
    user,
  );
  const reviewed = (await domain.load('skyline')).data.transactions[0];
  assert.equal(reviewed.status, 'Rejected');
  assert.equal(reviewed.rejectionReason, 'Missing invoice');
  assert.equal(reviewed.reviewedBy, user.id);
  await assert.rejects(
    domain.execute('skyline', review({ reason: 'Again' }), user),
    (error) => error.status === 409,
  );
});

test('parallel feature actions keep users and club state independent', async () => {
  const { domain } = await fixture();
  await Promise.all([
    domain.execute(
      'skyline',
      action('membership.join', { course: 'Science', userId: other.id, role: 'admin' }),
      user,
    ),
    domain.execute(
      'canvas',
      action('membership.join', { course: 'Design', userId: user.id, role: 'admin' }),
      other,
    ),
  ]);
  const skyline = (await domain.load('skyline')).data;
  const canvas = (await domain.load('canvas')).data;
  assert.equal(skyline.members.length, 1);
  assert.equal(canvas.members.length, 1);
  assert.equal(skyline.members[0].userId, user.id);
  assert.equal(canvas.members[0].userId, other.id);
  assert.equal(skyline.members[0].course, 'Science');
  assert.equal(canvas.members[0].course, 'Design');
  assert.equal(skyline.members[0].role, 'Member');
});
test('WhatsApp reads consent from DynamoDB, persists timeout deduplication, and verifies webhook signatures', async () => {
  const { repo, domain } = await fixture();
  await repo.put({ pk: `USER#${user.id}`, sk: 'ACCESS#skyline', clubId: 'skyline', role: 'admin' });
  let data = (await domain.load('skyline')).data;
  data.members = [
    {
      ...other,
      userId: other.id,
      course: 'Campus community',
      status: 'Active',
      joined: '2026-10-10',
      expires: '2099-07-31',
      role: 'Member',
      phone: '+919876543210',
      whatsappOptIn: true,
    },
  ];
  data.announcements = [
    {
      id: 'ANN-one',
      title: 'Test announcement',
      body: 'Connectivity test',
      author: user.name,
      audience: 'All members',
      date: '2026-10-10',
      read: 0,
      email: false,
    },
  ];
  await repo.put({ pk: clubKey('skyline'), sk: 'STATE', version: 1, data });
  const env = {
    META_WHATSAPP_TOKEN: 'test-token',
    META_PHONE_NUMBER_ID: '123',
    META_GRAPH_VERSION: 'v25.0',
    META_TEST_RECIPIENTS: '919876543210',
    META_APP_SECRET: 'app-secret',
  };
  let calls = 0;
  const options = {
    env,
    repo,
    domain,
    fetchImpl: async () => {
      calls++;
      throw new Error('Uncertain timeout');
    },
  };
  const body = { announcementId: 'ANN-one', channel: 'WhatsApp', recipients: ['919876543210'] };
  assert.equal(
    (await createProviders(options).send('skyline', user, body)).deliveries[0].status,
    'Unknown',
  );
  await createProviders(options).send('skyline', user, body);
  assert.equal(calls, 1);
  data.members[0].whatsappOptIn = false;
  await repo.put({ pk: clubKey('skyline'), sk: 'STATE', version: 2, data });
  await assert.rejects(
    createProviders(options).send('skyline', user, body),
    (e) => e.status === 403,
  );
  const providers = createProviders(options),
    rawBody = Buffer.from('{"object":"whatsapp_business_account"}');
  assert.throws(
    () => providers.verifyWebhook({ headers: {}, rawBody }),
    (e) => e.status === 401,
  );
  providers.verifyWebhook({
    rawBody,
    headers: {
      'x-hub-signature-256':
        'sha256=' + createHmac('sha256', env.META_APP_SECRET).update(rawBody).digest('hex'),
    },
  });
});
