const assert = require('node:assert/strict');
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    'C:/Users/Pratyush Mishra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
const { readFileSync, mkdirSync, writeFileSync, unlinkSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');
const deployment = JSON.parse(readFileSync('AWS_DEPLOYMENT_OUTPUT.json', 'utf8'));
const base = deployment.WebsiteUrl,
  email = `deployment-qa-${randomUUID()}@example.test`,
  password = randomUUID() + '-Test';
function aws(args) {
  return JSON.parse(
    execFileSync(
      'aws',
      [...args, '--region', deployment.region, '--no-cli-pager', '--output', 'json'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          AWS_CLI_FILE_ENCODING: 'UTF-8',
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ) || '{}',
  );
}

(async () => {
  const { marshall, unmarshall } = await import('@aws-sdk/util-dynamodb');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(),
    errors = [];
  let userId, receiptKey;
  page.on('pageerror', (error) => errors.push(error.message));
  const reports = [];
  try {
    await page.goto(base + '/signup');
    await page.getByRole('heading', { name: 'Join your campus', exact: true }).waitFor();
    await page.locator('input[name=name]').fill('Deployment QA Student');
    await page.locator('input[name=email]').fill(email);
    await page.locator('input[name=password]').fill(password);
    const signupPromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/auth/signup'),
    );
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    const signup = await signupPromise;
    assert.equal(signup.status(), 201, await signup.text());
    userId = (await signup.json()).user.id;
    await page.waitForURL(base + '/app');
    await page.getByRole('button', { name: 'Join club', exact: true }).click();
    await page.waitForFunction(
      () => !document.querySelector('.info-banner button')?.textContent?.includes('Join club'),
    );
    reports.push('Browser signup, JWT cookies and joining a club');
    const me = await context.request.get(base + '/api/auth/me');
    assert.equal(me.status(), 200);
    const session = await me.json();
    const headers = { 'x-skyline-client': 'web', 'x-csrf-token': session.csrfToken, origin: base };
    const post = async (route, data) => {
      const response = await context.request.post(base + '/api' + route, { headers, data });
      const body = await response.json();
      assert.equal(response.status(), 200, JSON.stringify(body));
      return body;
    };
    const roles = session.roles;
    assert.deepEqual(roles, {});
    const inventory = await context.request.post(base + '/api/inventory', {
      headers,
      data: {
        clubId: 'skyline',
        productId: 'PROD-001',
        size: 'M',
        delta: 5,
        reason: 'Unauthorized attempt',
        idempotencyKey: randomUUID(),
      },
    });
    assert.equal(inventory.status(), 403);
    const stateResponse = await context.request.get(base + '/api/clubs/skyline/state');
    const state = (await stateResponse.json()).state;
    const event = state.events.find(
      (e) => new Date(`${e.date}T23:59:59+05:30`) > new Date() && e.sold < e.capacity,
    );
    assert.ok(event, 'At least one upcoming fixture event is required.');
    const request = {
      type: 'tickets.book',
      args: { eventId: event.id, amount: 0, actor: { id: 'spoof' } },
      idempotencyKey: randomUUID(),
    };
    const booking = await post('/clubs/skyline/actions', request);
    assert.equal(booking.ticket.amount, event.price);
    const retry = await post('/clubs/skyline/actions', request);
    assert.equal(retry.ticket.id, booking.ticket.id);
    await page.goto(base + '/app/my-tickets');
    await page.getByText(event.title, { exact: true }).first().waitFor();
    reports.push('DynamoDB booking, authoritative price, idempotent retry and ticket view');
    const upload = await post('/clubs/skyline/receipts/upload', { contentType: 'application/pdf' });
    receiptKey = upload.key;
    const multipart = Object.fromEntries(Object.entries(upload.fields));
    multipart.file = {
      name: 'qa-receipt.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n% Synthetic receipt for deployment validation\n%%EOF'),
    };
    const uploaded = await context.request.post(upload.url, { multipart });
    assert.equal(uploaded.status(), 204, await uploaded.text());
    await post('/clubs/skyline/actions', {
      type: 'expenses.create',
      args: { title: 'Deployment QA receipt', amount: 25, receipt: 'qa-receipt.pdf', receiptKey },
      idempotencyKey: randomUUID(),
    });
    reports.push('Private S3 receipt upload and authenticated expense submission');
    const refreshed = await context.request.post(base + '/api/auth/refresh', { headers, data: {} });
    assert.equal(refreshed.status(), 200);
    const refreshedSession = await refreshed.json();
    headers['x-csrf-token'] = refreshedSession.csrfToken;
    await context.request.post(base + '/api/auth/logout', { headers, data: {} });
    await page.goto(base + '/app');
    await page.waitForURL(/\/login/);
    await page.locator('input[name=email]').fill(email);
    await page.locator('input[name=password]').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(base + '/app');
    reports.push('Refresh, logout and password login');
    assert.deepEqual(errors, []);
    mkdirSync('.aws-build', { recursive: true });
    await page.screenshot({ path: '.aws-build/aws-workspace.png', fullPage: true });
    writeFileSync(
      '.aws-build/smoke-report.json',
      JSON.stringify({ url: base, passed: reports, pageErrors: errors }, null, 2),
    );
    console.log(JSON.stringify({ passed: reports, pageErrors: errors }, null, 2));
  } finally {
    await browser.close();
    // Remove only the synthetic account and business records created by this run.
    if (userId) {
      for (const clubId of ['skyline', 'codecraft', 'canvas']) {
        const key = { pk: `COLLEGE#skyline-campus#CLUB#${clubId}`, sk: 'STATE' };
        const raw = aws([
          'dynamodb',
          'get-item',
          '--table-name',
          deployment.DataTable,
          '--key',
          JSON.stringify(marshall(key)),
          '--consistent-read',
        ]).Item;
        const item = unmarshall(raw),
          before = item.data,
          removedTickets = before.tickets.filter((t) => t.userId === userId),
          removedOrders = before.orders.filter((o) => o.userId === userId);
        if (
          !before.members.some((m) => m.userId === userId) &&
          !removedTickets.length &&
          !removedOrders.length &&
          !before.transactions.some((t) => t.createdBy === userId)
        )
          continue;
        item.data.members = before.members.filter((m) => m.userId !== userId);
        item.data.tickets = before.tickets.filter((t) => t.userId !== userId);
        item.data.orders = before.orders.filter((o) => o.userId !== userId);
        item.data.transactions = before.transactions.filter((t) => t.createdBy !== userId);
        item.data.waitlist = before.waitlist.filter((w) => w.email !== email);
        item.data.events = before.events.map((e) => ({
          ...e,
          sold:
            e.sold -
            removedTickets.filter((t) => t.eventId === e.id && t.status !== 'Cancelled').length,
        }));
        for (const order of removedOrders) {
          const product = item.data.products.find((p) => p.id === order.productId);
          product.stock[order.size]++;
        }
        const previousVersion = item.version;
        item.version++;
        const file = path.resolve('.aws-build/qa-cleanup.json');
        writeFileSync(file, JSON.stringify(marshall(item, { removeUndefinedValues: true })));
        try {
          aws([
            'dynamodb',
            'put-item',
            '--table-name',
            deployment.DataTable,
            '--item',
            `file://${file}`,
            '--condition-expression',
            '#version = :previous',
            '--expression-attribute-names',
            '{"#version":"version"}',
            '--expression-attribute-values',
            JSON.stringify({ ':previous': { N: String(previousVersion) } }),
          ]);
        } finally {
          unlinkSync(file);
        }
      }
      for (const key of [
        { pk: 'USER#' + userId, sk: 'PROFILE' },
        { pk: 'ACCOUNT#' + createHash('sha256').update(email).digest('hex'), sk: 'ACCOUNT' },
      ])
        aws([
          'dynamodb',
          'delete-item',
          '--table-name',
          deployment.DataTable,
          '--key',
          JSON.stringify(marshall(key)),
        ]);
      if (receiptKey)
        aws(['s3api', 'delete-object', '--bucket', deployment.ReceiptsBucket, '--key', receiptKey]);
      console.log(
        'Synthetic QA account, business records and receipt removed; audit history retained.',
      );
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
