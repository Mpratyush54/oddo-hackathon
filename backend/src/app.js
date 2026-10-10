import { registerCatalogRoutes } from './modules/catalog/catalog.routes.js';
import { registerClubsRoutes } from './modules/clubs/clubs.routes.js';
import { registerUsersRoutes } from './modules/users/users.routes.js';
import { registerCollegeRoutes } from './modules/college/college.routes.js';
import { registerCommerceRoutes } from './modules/commerce/commerce.routes.js';
import { registerCommunicationsRoutes } from './modules/communications/communications.routes.js';
import { registerFinanceRoutes } from './modules/finance/finance.routes.js';
import { registerWebhooksRoutes } from './modules/webhooks/webhooks.routes.js';
import express from 'express';
import { registerNotificationRoutes } from './modules/notifications/notifications.routes.js';
import { registerPaymentsRoutes } from './modules/payments/payments.routes.js';
import { S3Client } from '@aws-sdk/client-s3';
import { createAuth } from './modules/auth/index.js';
import { createDomain } from './modules/clubs/club.service.js';
import { createProviders } from './modules/communications/providers.service.js';
import { fileURLToPath } from 'node:url';
import { createReceiptService } from './modules/finance/receipt.service.js';
import { createRequestSecurity } from './middleware/request-security.js';
import { validateJsonObject } from './middleware/json-object.js';
import { createAuthenticate } from './middleware/authenticate.js';
import { handleError } from './middleware/error-handler.js';
import { createCatalogController } from './modules/catalog/catalog.controller.js';
import { createClubsController } from './modules/clubs/clubs.controller.js';
import { createCollegeController } from './modules/college/college.controller.js';
import { createCommerceController } from './modules/commerce/commerce.controller.js';
import { createCommunicationsController } from './modules/communications/communications.controller.js';
import { createFinanceController } from './modules/finance/finance.controller.js';
import { createWebhooksController } from './modules/webhooks/webhooks.controller.js';

export function createApp({
  env = process.env,
  repo,
  clubs,
  fetchImpl = fetch,
  s3 = new S3Client({}),
  notificationOptions = {},
}) {
  const app = express(),
    auth = createAuth({ repo, env, fetchImpl }),
    domain = createDomain({
      repo,
      clubs,
      paymentsRequired: env.NODE_ENV === 'production' || !!env.RAZORPAY_KEY_ID,
    }),
    providers = createProviders({ env, repo, domain, fetchImpl });
  const { checkReceipt } = createReceiptService({ env, s3 });
  const catalogController = createCatalogController({ env, clubs, domain });
  const clubsController = createClubsController({ repo, domain, checkReceipt });
  const collegeController = createCollegeController({ repo, clubs, domain });
  const commerceController = createCommerceController({ domain });
  const communicationsController = createCommunicationsController({ providers });
  const financeController = createFinanceController({ env, domain, s3 });
  const webhooksController = createWebhooksController({ env, providers });
  app.disable('x-powered-by');
  app.use(createRequestSecurity({ env }));
  app.use(
    express.json({
      limit: '64kb',
      strict: true,
      verify: (req, res, buffer) => {
        if (['/api/webhooks/whatsapp', '/api/webhooks/razorpay'].includes(req.path))
          req.rawBody = buffer;
      },
    }),
  );
  app.use(validateJsonObject);
  registerCatalogRoutes(app, catalogController);

  auth.routes(app);
  app.use('/api', createAuthenticate({ auth, repo }));
  registerPaymentsRoutes(app, { repo, domain, env, fetchImpl });
  registerNotificationRoutes(app, { repo, domain, env, clubs, fetchImpl, ...notificationOptions });
  registerClubsRoutes(app, clubsController);
  registerUsersRoutes(app, { repo, domain });
  registerCollegeRoutes(app, collegeController);

  registerCommerceRoutes(app, commerceController);
  registerCommunicationsRoutes(app, communicationsController);

  registerFinanceRoutes(app, financeController);

  registerWebhooksRoutes(app, webhooksController);

  const staticPath = fileURLToPath(new URL('./static/', import.meta.url));
  app.get('/notifications-sw.js', (req, res, next) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile('notifications-sw.js', { root: staticPath }, (error) => {
      if (error) next();
    });
  });
  app.use(express.static(staticPath, { index: false, maxAge: '1y', immutable: true }));
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.split('/').pop().includes('.')) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile('index.html', { root: staticPath }, (error) => {
      if (error) next();
    });
  });
  app.use((req, res) => res.status(404).json({ error: 'Unknown endpoint.' }));
  app.use(handleError);
  return app;
}
