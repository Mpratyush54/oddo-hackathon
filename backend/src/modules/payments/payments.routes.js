import { PaymentsService } from './payments.service.js';
export function registerPaymentsRoutes(app, dependencies) {
  const payments = new PaymentsService(dependencies);
  app.get('/api/clubs/:clubId/refunds', async (req, res) =>
    res.json(await payments.refunds.list(req.params.clubId, req.auth.user, req.query)),
  );
  app.post('/api/clubs/:clubId/refunds', async (req, res) =>
    res.json(await payments.refunds.request(req.params.clubId, req.body, req.auth.user)),
  );
  app.post('/api/clubs/:clubId/refunds/:paymentId/review', async (req, res) =>
    res.json(
      await payments.refunds.review(
        req.params.clubId,
        req.params.paymentId,
        req.body,
        req.auth.user,
      ),
    ),
  );
  app.post('/api/clubs/:clubId/refunds/:paymentId/refresh', async (req, res) =>
    res.json(
      await payments.refunds.refresh(req.params.clubId, req.params.paymentId, req.auth.user),
    ),
  );
  app.post('/api/payments/orders', async (req, res) =>
    res.json(await payments.create(req.body, req.auth.user)),
  );
  app.post('/api/payments/verify', async (req, res) =>
    res.json(await payments.verify(req.body, req.auth.user)),
  );
  app.get('/api/payments/:key', async (req, res) =>
    res.json(await payments.status(req.params.key, req.auth.user)),
  );
  app.post('/api/webhooks/razorpay', async (req, res) => {
    await payments.webhook(req.rawBody, req.headers['x-razorpay-signature'], req.body);
    res.json({ received: true });
  });
}
