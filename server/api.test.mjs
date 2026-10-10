import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, createExpressApp, handler } from './api.mjs';

test('Express routes enforce JSON size, shape and local origins without provider calls', async () => {
  let providerCalls = 0;
  const app = createExpressApp({
    env: {},
    fetchImpl: async () => {
      providerCalls++;
      throw new Error('Provider must not be called.');
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}/api`;
  try {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).mode, 'local-demo');
    assert.equal(health.headers.get('cache-control'), 'no-store');
    assert.equal(health.headers.get('x-powered-by'), null);
    const invalid = await fetch(`${base}/ai/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad',
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error, 'Invalid JSON request.');
    const array = await fetch(`${base}/ai/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '[]',
    });
    assert.equal(array.status, 400);
    const oversized = await fetch(`${base}/ai/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'x'.repeat(17000) }),
    });
    assert.equal(oversized.status, 413);
    const foreign = await fetch(`${base}/health`, {
      headers: { Origin: 'https://untrusted.example' },
    });
    assert.equal(foreign.status, 403);
    const unconfigured = await fetch(`${base}/ai/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5174' },
      body: JSON.stringify({ notes: 'Meet at 4 PM', clubId: 'skyline' }),
    });
    assert.equal(unconfigured.status, 503);
    assert.equal(providerCalls, 0);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
test('unconfigured providers fail without outbound network requests', async () => {
  const api = createApi({
    env: {},
    fetchImpl: () => {
      throw new Error('must not call');
    },
  });
  assert.equal((await api('/health', 'GET')).ai.configured, false);
  await assert.rejects(api('/ai/draft', 'POST', { notes: 'Meet at 4' }), (e) => e.status === 503);
  await assert.rejects(
    api('/notifications/send', 'POST', { channel: 'WhatsApp' }),
    (e) => e.status === 503,
  );
});
test('draft uses only free model and validates structured output', async () => {
  let calls = 0;
  const api = createApi({
    env: { OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'openrouter/free' },
    fetchImpl: async (url, options) => {
      calls++;
      const request = JSON.parse(options.body);
      assert.equal(request.model, 'openrouter/free');
      assert.equal(request.max_tokens, 650);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Campus coffee',
                  body: 'Meet at the library at 4 PM.',
                }),
              },
            },
          ],
        }),
      };
    },
  });
  const result = await api('/ai/draft', 'POST', { notes: 'Library coffee, 4 PM' });
  assert.equal(result.title, 'Campus coffee');
  assert.equal(calls, 1);
  const paid = createApi({
    env: { OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'paid-model' },
  });
  await assert.rejects(paid('/ai/draft', 'POST', { notes: 'hello' }), (e) => e.status === 503);
});
test('WhatsApp rejects unknown recipients and sends template only once', async () => {
  let calls = 0;
  const api = createApi({
    env: {
      META_WHATSAPP_TOKEN: 'test-token',
      META_PHONE_NUMBER_ID: '12345',
      META_TEST_RECIPIENTS: '919999999999',
    },
    fetchImpl: async (url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      assert.equal(body.type, 'template');
      assert.equal(body.template.name, 'hello_world');
      assert.equal(body.to, '919999999999');
      return { ok: true, json: async () => ({ messages: [{ id: 'fake-message' }] }) };
    },
  });
  await assert.rejects(
    api('/notifications/send', 'POST', {
      channel: 'WhatsApp',
      recipients: ['918888888888'],
      clubId: 'skyline',
      announcementId: 'A1',
    }),
    (e) => e.status === 403,
  );
  const request = {
    channel: 'WhatsApp',
    recipients: ['+919999999999'],
    clubId: 'skyline',
    announcementId: 'A1',
    template: 'hello_world',
  };
  const [first, second] = await Promise.all([
    api('/notifications/send', 'POST', request),
    api('/notifications/send', 'POST', request),
  ]);
  assert.equal(calls, 1);
  assert.equal(first.deliveries[0].status, 'Sent');
  assert.equal(second.deliveries[0].status, 'Sent');
  assert.match(first.deliveries[0].detail, /Announcement content was not sent/);
});
test('production handler denies requests without Cognito authorizer identity', async () => {
  const result = await handler({
    rawPath: '/ai/draft',
    body: '{}',
    requestContext: { http: { method: 'POST' } },
  });
  assert.equal(result.statusCode, 401);
});
