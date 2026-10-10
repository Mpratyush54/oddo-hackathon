import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { MemoryRepository } from '../../src/database/repositories/memory.repository.js';
import { EmailVerificationService } from '../../src/modules/auth/email-verification.service.js';
import { UsersService } from '../../src/modules/users/users.service.js';
import { createDomain } from '../../src/modules/clubs/club.service.js';
import { createApp } from '../../src/app.js';
import { clubKey } from '../../src/shared/records.js';
import { hash } from '../../src/modules/auth/password.js';
import { EmailSenderService } from '../../src/modules/auth/email-sender.service.js';

const seed = JSON.parse(readFileSync(new URL('../../data/seed.json', import.meta.url), 'utf8'));
const profile = (id, verified = false) => ({
  pk: 'USER#' + id,
  sk: 'PROFILE',
  id,
  name: id,
  email: id.toLowerCase() + '@example.test',
  emailVerified: verified,
  sessionVersion: 1,
  createdAt: new Date().toISOString(),
});
async function fixture() {
  const repo = new MemoryRepository();
  for (const id of ['skyline', 'canvas'])
    await repo.put({
      pk: clubKey(id),
      sk: 'STATE',
      version: 1,
      data: { ...structuredClone(seed.clubs.skyline), members: [], audit: [] },
    });
  const admin = profile('USR-admin', true),
    student = profile('USR-student');
  await repo.put(admin);
  await repo.put(student);
  await repo.put({ pk: admin.pk, sk: 'ACCESS#skyline', clubId: 'skyline', role: 'admin' });
  const domain = createDomain({ repo, clubs: [{ id: 'skyline' }, { id: 'canvas' }] });
  return { repo, admin, student, domain, users: new UsersService({ repo, domain }) };
}
const env = {
  SENDGRID_API_KEY: 'fake-test-key',
  EMAIL_FROM: 'sender@example.test',
  EMAIL_VERIFICATION_ORIGIN: 'https://skyline.example.test',
  NODE_ENV: 'production',
};
function mailService(repo, status = 202) {
  let payload;
  const service = new EmailVerificationService({
    repo,
    env,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.sendgrid.com/v3/mail/send');
      payload = JSON.parse(options.body);
      return { status };
    },
  });
  return { service, token: () => new URL(payload.content[0].value.split('\n')[2]).hash.slice(1) };
}
test('verification stores a hash, requires an unexpired single-use token, and never changes other profiles', async () => {
  const { repo, student, admin } = await fixture();
  const { service, token } = mailService(repo);
  assert.equal((await service.send(student)).accepted, true);
  const raw = token();
  const stored = await repo.get('VERIFY#' + hash(raw), 'EMAIL_VERIFICATION');
  assert.equal(JSON.stringify(stored).includes(raw), false);
  assert.equal((await repo.get(student.pk, 'PROFILE')).emailVerified, false);
  await service.confirm({ token: raw });
  assert.equal((await repo.get(student.pk, 'PROFILE')).emailVerified, true);
  await assert.rejects(service.confirm({ token: raw }), (e) => e.status === 400);
  assert.deepEqual(await repo.get(admin.pk, 'PROFILE'), { ...admin, schemaVersion: 1 });
});
test('expired, forged and rejected-provider verification links cannot verify an account', async () => {
  const { repo, student } = await fixture();
  const { service, token } = mailService(repo);
  await service.send(student);
  const record = await repo.get('VERIFY#' + hash(token()), 'EMAIL_VERIFICATION');
  await repo.put({ ...record, expiresAt: 1 });
  await assert.rejects(service.confirm({ token: token() }), (e) => e.status === 400);
  await assert.rejects(service.confirm({ token: 'a'.repeat(64) }), (e) => e.status === 400);
  const rejected = mailService(repo, 403);
  await assert.rejects(rejected.service.send(student), (e) => e.status === 502);
  assert.equal(
    (await repo.get('VERIFY#' + hash(rejected.token()), 'EMAIL_VERIFICATION')).revoked,
    true,
  );
  assert.equal((await repo.get(student.pk, 'PROFILE')).emailVerified, false);
});
test('verification resend is rate limited and missing provider credentials make no network request', async () => {
  const { repo, student } = await fixture();
  const { service } = mailService(repo);
  for (let n = 0; n < 3; n++) await service.send(student);
  await assert.rejects(service.send(student), (e) => e.status === 429);
  const missing = new EmailVerificationService({
    repo,
    env: {},
    fetchImpl: () => assert.fail('unexpected network request'),
  });
  await assert.rejects(missing.send(student), (e) => e.status === 503);
});
test('user management is scoped, validates before writes, protects self access and requires verification for promotion', async () => {
  const { repo, admin, student, domain, users } = await fixture();
  const input = {
    userId: student.id,
    role: 'member',
    course: 'CS',
    status: 'Active',
    expires: '2099-07-31',
    memberRole: 'Volunteer',
  };
  await assert.rejects(users.update(student, 'skyline', input), (e) => e.status === 403);
  await assert.rejects(users.update(admin, 'canvas', input), (e) => e.status === 403);
  await assert.rejects(
    users.update(admin, 'skyline', { ...input, role: 'college' }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    users.update(admin, 'skyline', { ...input, role: 'admin' }),
    (e) => e.status === 409,
  );
  await assert.rejects(
    users.remove(admin, 'skyline', { userId: admin.id }),
    (e) => e.status === 409,
  );
  await assert.rejects(
    users.update(admin, 'skyline', { ...input, userId: admin.id }),
    (e) => e.status === 409,
  );
  assert.equal((await repo.list(clubKey('skyline'), 'AUDIT#')).length, 0);
  const transactionCount = (await domain.load('skyline')).data.transactions.length;
  await users.update(admin, 'skyline', input);
  assert.equal((await domain.load('skyline')).data.members[0].duesWaived, true);
  assert.equal((await domain.load('skyline')).data.transactions.length, transactionCount);
  await repo.put({ ...student, emailVerified: true });
  await users.update(admin, 'skyline', { ...input, role: 'organizer' });
  assert.equal(await domain.roleFor(student, 'skyline'), 'organizer');
  await users.remove(admin, 'skyline', { userId: student.id });
  assert.equal(await domain.roleFor(student, 'skyline'), 'member');
  assert.equal((await domain.load('skyline')).data.members.length, 0);
  assert.ok(await repo.get(student.pk, 'PROFILE'));
  assert.equal((await repo.list(clubKey('skyline'), 'AUDIT#')).length, 3);
});
test('Express signup sends verification, confirmation works signed out, and user administration requires JWT and CSRF', async () => {
  const { repo } = await fixture();
  let sent;
  const app = createApp({
    repo,
    clubs: [{ id: 'skyline' }],
    env: { ...env, NODE_ENV: 'test', JWT_SECRET: 'x'.repeat(64) },
    fetchImpl: async (_url, options) => {
      sent = JSON.parse(options.body);
      return { status: 202 };
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const headers = { 'Content-Type': 'application/json', 'x-skyline-client': 'web' };
  try {
    const signup = await fetch(base + '/api/auth/signup', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'New User',
        email: 'new@example.test',
        password: 'long-test-password-123',
      }),
    });
    assert.equal(signup.status, 201);
    const data = await signup.json();
    assert.equal(data.verification.accepted, true);
    const cookie = signup.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const token = new URL(sent.content[0].value.split('\n')[2]).hash.slice(1);
    const confirm = await fetch(base + '/api/auth/verify-email', {
      method: 'POST',
      headers,
      body: JSON.stringify({ token }),
    });
    assert.equal(confirm.status, 200);
    assert.equal((await repo.get('USER#' + data.user.id, 'PROFILE')).emailVerified, true);
    const listPath = base + '/api/clubs/skyline/users';
    assert.equal((await fetch(listPath)).status, 401);
    assert.equal((await fetch(listPath, { headers: { ...headers, cookie } })).status, 403);
    await repo.put({
      pk: 'USER#' + data.user.id,
      sk: 'ACCESS#skyline',
      clubId: 'skyline',
      role: 'admin',
    });
    assert.equal((await fetch(listPath, { headers: { ...headers, cookie } })).status, 200);
    const updatePath = listPath + '/update';
    const input = {
      userId: data.user.id,
      role: 'admin',
      status: 'Active',
      course: 'CS',
      expires: '2099-07-31',
      memberRole: 'Volunteer',
    };
    assert.equal(
      (
        await fetch(updatePath, {
          method: 'POST',
          headers: { ...headers, cookie },
          body: JSON.stringify(input),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(updatePath, {
          method: 'POST',
          headers: { ...headers, cookie, 'x-csrf-token': data.csrfToken },
          body: JSON.stringify(input),
        })
      ).status,
      200,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});

test('Brevo SMTP uses authenticated TLS, accepts only the requested recipient, and keeps credentials out of errors', async () => {
  const smtpEnv = {
    SMTP_HOST: 'smtp-relay.brevo.com',
    SMTP_PORT: '587',
    SMTP_USER: 'smtp-login',
    SMTP_PASSWORD: 'fake-private-key',
    EMAIL_FROM: 'sender@example.test',
  };
  let options,
    message,
    closed = false;
  const sender = new EmailSenderService({
    env: smtpEnv,
    smtpFactory: (config) => {
      options = config;
      return {
        sendMail: async (mail) => {
          message = mail;
          return { accepted: ['student@example.test'] };
        },
        close: () => {
          closed = true;
        },
      };
    },
  });
  await sender.send('student@example.test', 'verification body');
  assert.equal(options.host, smtpEnv.SMTP_HOST);
  assert.equal(options.port, 587);
  assert.equal(options.requireTLS, true);
  assert.equal(options.secure, false);
  assert.equal(options.auth.user, smtpEnv.SMTP_USER);
  assert.equal(options.auth.pass, smtpEnv.SMTP_PASSWORD);
  assert.equal(options.debug, false);
  assert.equal(closed, true);
  assert.equal(message.to, 'student@example.test');
  const missing = new EmailSenderService({
    env: { ...smtpEnv, SMTP_USER: '' },
    smtpFactory: () => assert.fail('unexpected SMTP connection'),
  });
  await assert.rejects(missing.send('student@example.test', 'body'), (e) => e.status === 503);
  const failed = new EmailSenderService({
    env: smtpEnv,
    smtpFactory: () => ({
      sendMail: async () => {
        throw Object.assign(new Error('fake-private-key'), { code: 'EAUTH' });
      },
      close: () => {},
    }),
  });
  await assert.rejects(
    failed.send('student@example.test', 'body'),
    (e) => e.status === 502 && !e.message.includes('fake-private-key'),
  );
});
