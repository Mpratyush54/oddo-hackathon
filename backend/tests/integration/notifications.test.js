import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createECDH, randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { MemoryRepository } from '../../src/database/repositories/memory.repository.js';
import { createDomain } from '../../src/modules/clubs/club.service.js';
import { clubKey } from '../../src/shared/records.js';
import { DeliveryWorker } from '../../src/modules/notifications/delivery-worker.service.js';
import { RemindersService } from '../../src/modules/notifications/reminders.service.js';
import { WhatsAppService } from '../../src/modules/notifications/whatsapp.service.js';
import { MailService } from '../../src/modules/notifications/mail.service.js';
import { PushService, pushKey } from '../../src/modules/notifications/push.service.js';
import {
  membershipReminder,
  eventReminders,
  weeklyReminders,
} from '../../src/modules/notifications/reminder-planner.js';
import { createProviders } from '../../src/modules/communications/providers.service.js';
import { createApp } from '../../src/app.js';
import { once } from 'node:events';
import { hashPassword, accountKey } from '../../src/modules/auth/password.js';
const now = new Date('2026-10-11T04:30:00Z');
const user = { id: 'member-a', name: 'Member A', email: 'member-a@example.test' };
async function fixture() {
  const repo = new MemoryRepository();
  const data = JSON.parse(readFileSync(new URL('../../data/seed.json', import.meta.url))).clubs
    .skyline;
  for (const key of [
    'notifications',
    'deliveries',
    'announcements',
    'tickets',
    'orders',
    'pointLedger',
    'transactions',
    'audit',
    'waitlist',
  ])
    data[key] = [];
  const member = {
    id: 'member-a',
    userId: user.id,
    name: user.name,
    email: user.email,
    course: 'CS',
    role: 'Volunteer',
    status: 'Active',
    joined: '2026-10-08',
    expires: '2026-10-12',
    phone: '+919000000001',
    whatsappOptIn: true,
  };
  data.members = [
    member,
    {
      ...member,
      id: 'member-b',
      userId: 'member-b',
      email: 'member-b@example.test',
      status: 'Pending',
      whatsappOptIn: false,
    },
    {
      ...member,
      id: 'member-c',
      userId: 'member-c',
      email: 'member-c@example.test',
      preferences: { email: false, renewals: false, weekly: false, events: false },
    },
  ];
  data.events = [
    {
      id: 'event',
      title: 'Reminder event',
      date: '2026-10-12',
      time: '09:00',
      capacity: 10,
      sold: 1,
      price: 100,
      memberPrice: 50,
    },
  ];
  data.tickets = [
    {
      id: 'ticket',
      eventId: 'event',
      userId: user.id,
      name: user.name,
      email: user.email,
      member: true,
      amount: 50,
      checkedIn: false,
      status: 'Confirmed',
    },
  ];
  await repo.put({ pk: clubKey('skyline'), sk: 'STATE', data, version: 1 });
  for (const m of data.members)
    await repo.put({
      pk: 'USER#' + m.userId,
      sk: 'PROFILE',
      id: m.userId,
      name: m.name,
      email: m.email,
      emailVerified: true,
      sessionVersion: 1,
      createdAt: now.toISOString(),
    });
  await repo.put({ pk: 'USER#' + user.id, sk: 'ACCESS#skyline', clubId: 'skyline', role: 'admin' });
  const domain = createDomain({ repo, clubs: [{ id: 'skyline' }] });
  const env = {
    META_WHATSAPP_TOKEN: 'fixture-token',
    META_PHONE_NUMBER_ID: '1234567890',
    META_GRAPH_VERSION: 'v25.0',
    META_TEST_RECIPIENTS: '919000000001',
    META_WHATSAPP_TEMPLATE: 'msg',
    META_TEMPLATE_PARAMETER_COUNT: '3',
    APP_ORIGIN: 'https://skyline.example.test',
  };
  const calls = [];
  const mail = {
    send: async (member, message) => {
      calls.push({ channel: 'Email', member, message });
      return { status: 'Sent', providerStatus: 'accepted', detail: 'accepted' };
    },
  };
  const whatsapp = {
    send: async (member, message) => {
      calls.push({ channel: 'WhatsApp', member, message });
      return {
        status: 'Sent',
        providerStatus: 'accepted',
        providerMessageId: 'message-' + calls.length,
        detail: 'accepted',
      };
    },
  };
  const worker = new DeliveryWorker({
    repo,
    domain,
    env,
    clubs: [{ id: 'skyline' }],
    mail,
    whatsapp,
  });
  return { repo, domain, env, calls, worker };
}
test('scheduled reminders use expiry dates, weekly pending dues and booked event boundaries', async () => {
  const f = await fixture(),
    data = (await f.domain.load('skyline')).data;
  assert.ok(membershipReminder(data.members[0], '2026-10-11'));
  assert.equal(membershipReminder(data.members[0], '2026-10-10'), null);
  assert.equal(membershipReminder(data.members[2], '2026-10-11'), null);
  const pending = data.members[1];
  assert.equal(
    membershipReminder(pending, '2026-10-11').key,
    membershipReminder(pending, '2026-10-12').key,
  );
  assert.notEqual(
    membershipReminder(pending, '2026-10-11').key,
    membershipReminder(pending, '2026-10-15').key,
  );
  assert.equal(eventReminders(data, now).length, 1);
  assert.match(eventReminders(data, new Date('2026-10-12T03:00:00Z'))[0].key, /1h/);
  assert.equal(eventReminders(data, new Date('2026-10-12T04:00:00Z')).length, 0);
  data.tickets[0].refundPending = true;
  assert.equal(eventReminders(data, now).length, 0);
});
test('concurrent scheduler and delivery runs queue and send each recipient exactly once', async () => {
  const f = await fixture(),
    reminders = new RemindersService(f);
  await Promise.all([reminders.prepare('skyline', now), reminders.prepare('skyline', now)]);
  let data = (await f.domain.load('skyline')).data;
  assert.equal(data.notifications.length, 3);
  assert.equal(data.deliveries.length, 5);
  await Promise.all([
    f.worker.runClub('skyline', { maxDeliveries: 20 }),
    f.worker.runClub('skyline', { maxDeliveries: 20 }),
  ]);
  assert.equal(f.calls.length, 5);
  assert.equal(
    (await f.repo.list(clubKey('skyline'), 'DELIVERY#')).filter((d) => d.status === 'Sent').length,
    5,
  );
  await reminders.prepare('skyline', now);
  await f.worker.runClub('skyline');
  assert.equal(f.calls.length, 5);
  assert.equal((await f.domain.load('skyline')).data.notifications.length, 3);
});
test('weekly roundup requires saved opt-in, starts Sunday morning and lists upcoming events', async () => {
  const f = await fixture(),
    state = await f.domain.load('skyline');
  state.data.members[0].preferences = { email: true, renewals: true, weekly: true };
  const reminders = weeklyReminders(state.data, now, '2026-10-11');
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].userId, user.id);
  assert.match(reminders[0].body, /Reminder event/);
  assert.equal(
    weeklyReminders(state.data, new Date('2026-10-11T02:00:00Z'), '2026-10-11').length,
    0,
  );
  assert.equal(
    weeklyReminders(state.data, new Date('2026-10-12T04:30:00Z'), '2026-10-12').length,
    0,
  );
  await f.repo.put(state);
  await new RemindersService(f).prepare('skyline', now);
  const next = await f.domain.load('skyline');
  next.data.members[0].preferences.weekly = false;
  await f.repo.put(next);
  await f.worker.runClub('skyline', { maxDeliveries: 20 });
  assert.equal(f.calls.filter((c) => c.message.title === 'Your club week ahead').length, 0);
});
test('delivery rechecks withdrawn consent, disabled accounts and changed membership before sending', async () => {
  const f = await fixture();
  await new RemindersService(f).prepare('skyline', now);
  const state = await f.domain.load('skyline');
  state.data.members[0].whatsappOptIn = false;
  await f.repo.put(state);
  const profile = await f.repo.get('USER#member-b', 'PROFILE');
  await f.repo.put({ ...profile, disabled: true });
  await f.worker.runClub('skyline', { maxDeliveries: 20 });
  assert.equal(f.calls.filter((c) => c.channel === 'WhatsApp').length, 0);
  assert.equal(f.calls.filter((c) => c.member.userId === 'member-b').length, 0);
});
test('unknown WhatsApp results never resend automatically; only rejected deliveries can be retried', async () => {
  const f = await fixture();
  await new RemindersService(f).prepare('skyline', now);
  let attempts = 0;
  f.worker.whatsapp = {
    send: async () => {
      attempts++;
      return { status: 'Unknown', detail: 'timeout' };
    },
  };
  await f.worker.runClub('skyline', { maxDeliveries: 20 });
  await f.worker.runClub('skyline', { retryFailed: true, maxDeliveries: 20 });
  assert.equal(attempts, 2);
  const g = await fixture();
  await new RemindersService(g).prepare('skyline', now);
  let rejected = 0;
  g.worker.whatsapp = {
    send: async () => {
      rejected++;
      return { status: 'Failed', detail: 'expired token' };
    },
  };
  await g.worker.runClub('skyline', { maxDeliveries: 20 });
  await g.worker.runClub('skyline', { maxDeliveries: 20 });
  assert.equal(rejected, 2);
  await g.worker.runClub('skyline', { retryFailed: true, maxDeliveries: 20 });
  assert.equal(rejected, 4);
});
test('WhatsApp sends the configured approved template with real content and explains token failures', async () => {
  const f = await fixture(),
    member = (await f.domain.load('skyline')).data.members[0];
  let payload;
  const service = new WhatsAppService({
    env: f.env,
    fetchImpl: async (url, options) => {
      payload = JSON.parse(options.body);
      return { ok: true, json: async () => ({ messages: [{ id: 'provider-id' }] }) };
    },
  });
  const result = await service.send(member, {
    title: 'Tomorrow',
    body: 'Your event starts at 9.',
    url: '/app/my-tickets',
  });
  assert.equal(result.providerStatus, 'accepted');
  assert.equal(payload.template.name, 'msg');
  assert.deepEqual(
    payload.template.components[0].parameters.map((p) => p.text),
    [member.name, 'Tomorrow', 'Your event starts at 9.'],
  );
  service.fetchImpl = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: { code: 190 } }),
  });
  assert.match(
    (await service.send(member, { title: 'x', body: 'y', url: '/app' })).detail,
    /expired or invalid/,
  );
});
function subscription() {
  const curve = createECDH('prime256v1');
  curve.generateKeys();
  return {
    endpoint: 'https://fcm.googleapis.com/fcm/send/fixture',
    keys: {
      p256dh: curve.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
    expirationTime: null,
  };
}
test('browser subscriptions reject unsafe endpoints, isolate accounts and disable expired devices', async () => {
  const f = await fixture(),
    keys = webpush.generateVAPIDKeys();
  const env = {
    ...f.env,
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: 'mailto:admin@example.test',
  };
  let sent = 0;
  const push = new PushService({
    ...f,
    env,
    sendPush: async () => {
      sent++;
    },
  });
  const sub = subscription();
  for (const endpoint of [
    'https://127.0.0.1/push',
    'https://example.test/push',
    'http://fcm.googleapis.com/push',
    'https://fcm.googleapis.com:8443/push',
  ])
    await assert.rejects(
      push.subscribe({ ...sub, endpoint }, user),
      (error) => error.status === 400,
    );
  await push.subscribe(sub, user);
  const record = await f.repo.get('USER#' + user.id, pushKey(sub.endpoint));
  await push.subscribe(sub, { ...user, id: 'member-b' });
  assert.equal((await push.send(record, { title: 'private' })).status, 'Failed');
  assert.equal(sent, 0);
  const second = await f.repo.get('USER#member-b', pushKey(sub.endpoint));
  push.sendPush = async () => {
    throw { statusCode: 410 };
  };
  assert.equal((await push.send(second, { title: 'private' })).status, 'Failed');
  assert.equal((await f.repo.get(second.pk, second.sk)).active, false);
});
test('browser push sends only new, unread notifications visible to the subscribing account', async () => {
  const f = await fixture(),
    keys = webpush.generateVAPIDKeys(),
    sent = [];
  const env = {
    ...f.env,
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: 'mailto:admin@example.test',
  };
  const push = new PushService({
    ...f,
    env,
    sendPush: async (sub, payload) => sent.push(JSON.parse(payload)),
  });
  await push.subscribe(subscription(), user);
  const state = await f.domain.load('skyline');
  const date = new Date(Date.now() + 1000).toISOString();
  state.data.notifications = [
    {
      id: 'own',
      title: 'Own reminder',
      body: 'private',
      userId: user.id,
      to: '/app/my-card',
      read: false,
      date,
    },
    {
      id: 'other',
      title: 'Other reminder',
      body: 'private',
      userId: 'member-b',
      to: '/app/my-card',
      read: false,
      date,
    },
    {
      id: 'old',
      title: 'Old',
      body: 'old',
      userId: user.id,
      to: '/app',
      read: false,
      date: '2020-01-01',
    },
  ];
  await f.repo.put(state);
  f.worker.push = push;
  await Promise.all([f.worker.runClub('skyline'), f.worker.runClub('skyline')]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].title, 'Own reminder');
  assert.equal(sent[0].clubId, 'skyline');
});
test('email reminders use authenticated TLS and actual reminder content', async () => {
  let message;
  const service = new MailService({
    env: { EMAIL_FROM: 'admin@example.test', APP_ORIGIN: 'https://skyline.example.test' },
    transport: {
      sendMail: async (input) => {
        message = input;
        return { accepted: [input.to] };
      },
    },
  });
  assert.equal(
    (
      await service.send(user, {
        title: 'Renew membership',
        body: 'Expires tomorrow.',
        url: '/app/my-card',
      })
    ).status,
    'Sent',
  );
  assert.equal(message.subject, 'Renew membership');
  assert.match(message.text, /Expires tomorrow/);
  assert.match(message.text, /https:\/\/skyline.example.test\/app\/my-card/);
});
test('manual renewal reminders include active members nearing expiry and deduplicate schedule runs', async () => {
  const f = await fixture();
  const result = await f.domain.execute(
    'skyline',
    {
      type: 'reminders.prepare',
      args: { status: 'Expiring', memberIds: ['member-a'] },
      idempotencyKey: crypto.randomUUID(),
    },
    user,
  );
  assert.equal(result.prepared, 1);
  assert.equal(result.state.notifications.length, 1);
  await new RemindersService(f).prepare('skyline', now);
  assert.equal((await f.domain.load('skyline')).data.notifications.length, 3);
});
test('HTTP browser and delivery routes require authentication and never expose VAPID private keys', async () => {
  const f = await fixture(),
    keys = webpush.generateVAPIDKeys();
  await f.repo.put({
    pk: accountKey(user.email),
    sk: 'ACCOUNT',
    id: user.id,
    passwordHash: await hashPassword('fixture-password-123'),
  });
  const env = {
    ...f.env,
    JWT_SECRET: 'fixture-secret'.repeat(8),
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: 'mailto:admin@example.test',
  };
  const app = createApp({ ...f, clubs: [{ id: 'skyline' }], env });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    env.APP_ORIGIN = base;
    assert.equal((await fetch(base + '/api/notifications/browser')).status, 401);
    assert.equal(
      (
        await fetch(base + '/api/clubs/skyline/notifications/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
      403,
    );
    const headers = { 'Content-Type': 'application/json', 'x-skyline-client': 'web', Origin: base };
    const login = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: user.email, password: 'fixture-password-123' }),
    });
    assert.equal(login.status, 200);
    const csrf = (await login.json()).csrfToken;
    const cookie = login.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const settings = await (
      await fetch(base + '/api/notifications/browser', { headers: { Cookie: cookie } })
    ).json();
    assert.equal(settings.publicKey, keys.publicKey);
    assert.ok(!JSON.stringify(settings).includes(keys.privateKey));
    const sub = subscription();
    assert.equal(
      (
        await fetch(base + '/api/notifications/browser', {
          method: 'POST',
          headers: { ...headers, Cookie: cookie },
          body: JSON.stringify(sub),
        })
      ).status,
      403,
    );
    const secure = { ...headers, Cookie: cookie, 'x-csrf-token': csrf };
    assert.equal(
      (
        await fetch(base + '/api/notifications/browser', {
          method: 'POST',
          headers: secure,
          body: JSON.stringify(sub),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + '/api/clubs/codecraft/notifications/dispatch', {
          method: 'POST',
          headers: secure,
          body: '{}',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + '/api/notifications/browser/disable', {
          method: 'POST',
          headers: secure,
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
      ).status,
      200,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('early WhatsApp delivery receipts survive provider completion; older failures cannot replace delivered', async () => {
  const f = await fixture(),
    providers = createProviders(f);
  await new RemindersService(f).prepare('skyline', now);
  let counter = 0;
  f.worker.whatsapp = {
    send: async () => {
      const id = 'early-message-' + ++counter;
      await providers.webhook({
        entry: [
          { changes: [{ value: { statuses: [{ id, status: 'delivered', timestamp: '100' }] } }] },
        ],
      });
      return {
        status: 'Sent',
        providerStatus: 'accepted',
        providerMessageId: id,
        detail: 'accepted',
      };
    },
  };
  const result = await f.worker.runClub('skyline', { maxDeliveries: 20 });
  assert.equal(
    result.deliveries
      .filter((d) => d.channel === 'WhatsApp')
      .every((d) => d.providerStatus === 'delivered'),
    true,
  );
  await providers.webhook({
    entry: [
      {
        changes: [
          { value: { statuses: [{ id: 'early-message-1', status: 'failed', timestamp: '90' }] } },
        ],
      },
    ],
  });
  const mapping = await f.repo.get('MESSAGE#early-message-1', 'DELIVERY');
  assert.equal(
    (await f.repo.get(mapping.deliveryPk, mapping.deliverySk)).providerStatus,
    'delivered',
  );
});
