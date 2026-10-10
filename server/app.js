import express from 'express';
import serverlessExpress from '@codegenie/serverless-express';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createAuth } from './auth.js';
import { createDomain, publicState, requireRole, visibleState } from './domain.js';
import { createProviders } from './providers.js';
import { HttpError, clubKey, recordId } from './repository.js';
import { fileURLToPath } from 'node:url';

export function createApp({
  env = process.env,
  repo,
  clubs,
  fetchImpl = fetch,
  s3 = new S3Client({}),
}) {
  const app = express(),
    auth = createAuth({ repo, env }),
    domain = createDomain({ repo, clubs }),
    providers = createProviders({ env, repo, domain, fetchImpl });
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const invoke = serverlessExpress.getCurrentInvoke();
    if (invoke?.event) req.apiGateway = invoke;
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    });
    // API Gateway supplies the original client IP. Do not trust forwarded IP headers.
    req.clientIp =
      req.apiGateway?.event?.requestContext?.http?.sourceIp || req.socket.remoteAddress;
    Object.defineProperty(req, 'ip', { value: req.clientIp });
    const webhook = req.path === '/api/webhooks/whatsapp';
    if (!webhook && !['GET', 'HEAD'].includes(req.method)) {
      const allowed = new Set(
        String(env.APP_ORIGIN || 'http://127.0.0.1:5174,http://localhost:5174').split(','),
      );
      if (
        (req.headers.origin && !allowed.has(req.headers.origin)) ||
        req.headers['x-skyline-client'] !== 'web'
      )
        return res.status(403).json({ error: 'Request origin or client verification failed.' });
      if (req.headers['sec-fetch-site'] === 'cross-site')
        return res.status(403).json({ error: 'Cross-site request blocked.' });
    }
    next();
  });
  app.use(
    express.json({
      limit: '64kb',
      strict: true,
      verify: (req, res, buffer) => {
        if (req.path === '/api/webhooks/whatsapp') req.rawBody = buffer;
      },
    }),
  );
  app.use((req, res, next) => {
    if (
      req.body !== undefined &&
      (!req.body || Array.isArray(req.body) || typeof req.body !== 'object')
    )
      return res.status(400).json({ error: 'A JSON object is required.' });
    next();
  });
  app.get('/api/health', (req, res) =>
    res.json({
      mode: env.DATA_TABLE ? 'aws-backend' : 'local-backend',
      auth: 'JWT',
      database: env.DATA_TABLE ? 'DynamoDB' : 'Memory',
      ai: { configured: !!env.OPENROUTER_API_KEY, provider: 'OpenRouter' },
      whatsapp: {
        configured: !!(
          env.META_WHATSAPP_TOKEN &&
          env.META_PHONE_NUMBER_ID &&
          env.META_TEST_RECIPIENTS
        ),
        template: 'hello_world',
        webhookConfigured: !!env.META_APP_SECRET,
      },
      payments: 'simulated',
    }),
  );
  app.get('/api/public/clubs', async (req, res) =>
    res.json({
      organizations: clubs,
      clubs: Object.fromEntries(
        await Promise.all(
          clubs.map(async (c) => [c.id, publicState((await domain.load(c.id)).data)]),
        ),
      ),
    }),
  );
  auth.routes(app);
  app.use('/api', async (req, res, next) => {
    if (req.path.startsWith('/webhooks/')) return next();
    try {
      req.auth = await auth.requireAuth(req);
      await repo.limit(`API#${req.auth.user.id}`, 90, 60);
      next();
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/clubs/:clubId/state', async (req, res) => {
    const { clubId } = req.params,
      role = await domain.roleFor(req.auth.user, clubId),
      current = await domain.load(clubId);
    const state = visibleState(current.data, req.auth.user, role);
    if (['admin', 'organizer'].includes(role)) {
      const actual = (await repo.list(clubKey(clubId), 'DELIVERY#')).map(
        ({ pk, sk, actor, ...row }) => row,
      );
      state.deliveries = [
        ...actual,
        ...state.deliveries.filter(
          (row) =>
            !actual.some(
              (sent) =>
                sent.announcementId === row.announcementId &&
                sent.channel === row.channel &&
                sent.recipient === row.recipient.replace(/\D/g, ''),
            ),
        ),
      ];
    }
    res.json({ state, role, version: current.version });
  });
  app.get('/api/college/overview', async (req, res) => {
    const assignments = await repo.list(`USER#${req.auth.user.id}`, 'ACCESS#');
    if (!assignments.some((a) => a.role === 'college' && a.collegeId === 'skyline-campus'))
      throw new HttpError(403, 'College administrator access is required.');
    const participants = new Set();
    const summaries = await Promise.all(
      clubs.map(async (club) => {
        const { data } = await domain.load(club.id);
        data.members.forEach((m) => {
          if (m.userId) participants.add(m.userId);
        });
        return {
          ...club,
          memberCount: data.members.length,
          eventCount: data.events.length,
          upcomingCount: data.events.filter(
            (e) => new Date(`${e.date}T23:59:59+05:30`).getTime() > Date.now(),
          ).length,
          balance: data.transactions
            .filter((t) => t.status === 'Completed')
            .reduce((total, t) => total + t.amount, 0),
        };
      }),
    );
    res.json({
      collegeId: 'skyline-campus',
      uniqueParticipants: participants.size,
      clubs: summaries,
    });
  });
  app.post('/api/clubs/:clubId/actions', async (req, res) => {
    if (req.body.type === 'expenses.create')
      await checkReceipt(req.params.clubId, req.auth.user, req.body.args?.receiptKey);
    res.json(await domain.execute(req.params.clubId, req.body, req.auth.user));
  });
  const aliases = {
    '/orders': 'orders',
    '/inventory': 'inventory',
    '/tickets/cancel': 'tickets.cancel',
    '/waitlist/join': 'waitlist.join',
    '/points/award': 'points.award',
    '/check-in': 'check-in',
    '/tickets/book': 'tickets.book',
  };
  for (const [path, type] of Object.entries(aliases))
    app.post(`/api${path}`, async (req, res) => {
      if (req.body.snapshot || req.body.actor)
        throw new HttpError(
          400,
          'Cloud operations do not accept browser snapshots or actor identities.',
        );
      const result = await domain.execute(
        req.body.clubId,
        { type, args: req.body, idempotencyKey: req.body.idempotencyKey },
        req.auth.user,
      );
      res.json({ ...result, patch: result.state });
    });
  app.post('/api/promos/quote', async (req, res) =>
    res.json(domain.quote((await domain.load(req.body.clubId)).data, req.body, req.auth.user)),
  );
  app.post('/api/ai/draft', async (req, res) =>
    res.json(await providers.draft(req.body.clubId, req.auth.user, req.body)),
  );
  app.post('/api/notifications/send', async (req, res) =>
    res.json(await providers.send(req.body.clubId, req.auth.user, req.body)),
  );
  app.post('/api/clubs/:clubId/receipts/upload', async (req, res) => {
    await domain.load(req.params.clubId);
    const type = req.body.contentType;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(type))
      throw new HttpError(400, 'Upload a PDF, JPEG, or PNG receipt.');
    const key = `skyline-campus/${req.params.clubId}/${req.auth.user.id}/${recordId('RECEIPT')}`;
    const upload = await createPresignedPost(s3, {
      Bucket: env.RECEIPTS_BUCKET,
      Key: key,
      Fields: { 'Content-Type': type },
      Conditions: [
        ['content-length-range', 1, 5 * 1024 * 1024],
        ['eq', '$Content-Type', type],
      ],
      Expires: 300,
    });
    res.json({ ...upload, key });
  });
  async function checkReceipt(clubId, user, key) {
    if (typeof key !== 'string' || !key.startsWith(`skyline-campus/${clubId}/${user.id}/`))
      throw new HttpError(403, 'Invalid receipt owner.');
    let object;
    try {
      object = await s3.send(new HeadObjectCommand({ Bucket: env.RECEIPTS_BUCKET, Key: key }));
    } catch {
      throw new HttpError(400, 'Upload the receipt before submitting your expense.');
    }
    if (
      !['application/pdf', 'image/jpeg', 'image/png'].includes(object.ContentType) ||
      object.ContentLength < 1 ||
      object.ContentLength > 5 * 1024 * 1024
    )
      throw new HttpError(400, 'Invalid receipt type or size.');
  }
  app.get('/api/clubs/:clubId/receipts/:transactionId', async (req, res) => {
    const tx = (await domain.load(req.params.clubId)).data.transactions.find(
      (t) => t.id === req.params.transactionId,
    );
    if (!tx?.receiptKey) throw new HttpError(404, 'Receipt not found.');
    if (tx.createdBy !== req.auth.user.id)
      requireRole(await domain.roleFor(req.auth.user, req.params.clubId), ['admin', 'treasurer']);
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: env.RECEIPTS_BUCKET,
        Key: tx.receiptKey,
        ResponseContentDisposition: 'attachment',
      }),
      { expiresIn: 120 },
    );
    res.json({ url });
  });
  app.get('/api/webhooks/whatsapp', (req, res) => {
    if (
      !env.META_WEBHOOK_VERIFY_TOKEN ||
      req.query['hub.mode'] !== 'subscribe' ||
      req.query['hub.verify_token'] !== env.META_WEBHOOK_VERIFY_TOKEN ||
      typeof req.query['hub.challenge'] !== 'string'
    )
      throw new HttpError(403, 'Webhook verification failed.');
    res.type('text/plain').send(req.query['hub.challenge']);
  });
  app.post('/api/webhooks/whatsapp', async (req, res) => {
    providers.verifyWebhook(req);
    await providers.webhook(req.body);
    res.json({ ok: true });
  });
  const staticPath = fileURLToPath(new URL('./static/', import.meta.url));
  app.use(express.static(staticPath, { index: false, maxAge: '1y', immutable: true }));
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.split('/').pop().includes('.')) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile('index.html', { root: staticPath }, (error) => {
      if (error) next();
    });
  });
  app.use((req, res) => res.status(404).json({ error: 'Unknown endpoint.' }));
  app.use((error, req, res, next) => {
    const status =
      error.type === 'entity.too.large'
        ? 413
        : error.type === 'entity.parse.failed'
          ? 400
          : error.status || 503;
    if (!error.status && !error.type)
      console.error(
        JSON.stringify({
          type: error.name,
          route: req.path,
          requestId: req.apiGateway?.context?.awsRequestId,
        }),
      );
    res
      .status(status)
      .json({
        error: error.type
          ? status === 413
            ? 'Request too large.'
            : 'Invalid JSON.'
          : error.status
            ? error.message
            : 'The service is temporarily unavailable.',
      });
  });
  return app;
}
