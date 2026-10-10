import { z } from 'zod';
import { PushService } from './push.service.js';
import { DeliveryWorker } from './delivery-worker.service.js';
import { requireRole } from '../../shared/authorization.js';
import { parseRequest } from '../../shared/request-validation.js';
import { unsubscribeSchema } from './push.schemas.js';
import { pushKey } from './push.service.js';
import { HttpError } from '../../shared/records.js';
const dispatchSchema = z.strictObject({ retryFailed: z.boolean().default(false) });
export function registerNotificationRoutes(app, dependencies) {
  const push = new PushService(dependencies),
    worker = new DeliveryWorker({ ...dependencies, push });
  app.get('/api/notifications/browser', async (req, res) =>
    res.json(await push.settings(req.auth.user)),
  );
  app.post('/api/notifications/browser', async (req, res) =>
    res.json(await push.subscribe(req.body, req.auth.user)),
  );
  app.post('/api/notifications/browser/disable', async (req, res) =>
    res.json(await push.unsubscribe(req.body, req.auth.user)),
  );
  app.post('/api/notifications/browser/test', async (req, res) => {
    const { endpoint } = parseRequest(unsubscribeSchema, req.body);
    const subscription = await dependencies.repo.get('USER#' + req.auth.user.id, pushKey(endpoint));
    if (!subscription?.active)
      throw new HttpError(404, 'Enable notifications on this device first.');
    await dependencies.repo.limit('PUSH-TEST#' + req.auth.user.id, 5, 60);
    res.json(
      await push.send(subscription, {
        title: 'Skyline notifications are ready',
        body: 'This is your browser notification test.',
        url: '/app/profile',
        tag: 'skyline-test',
      }),
    );
  });
  app.post('/api/clubs/:clubId/notifications/dispatch', async (req, res) => {
    requireRole(await dependencies.domain.roleFor(req.auth.user, req.params.clubId), [
      'admin',
      'organizer',
    ]);
    const args = parseRequest(dispatchSchema, req.body);
    await dependencies.repo.limit('DISPATCH#' + req.params.clubId, 10, 60);
    res.json(await worker.runClub(req.params.clubId, args));
  });
}
