import { HttpError } from '../../shared/records.js';

export function createWebhooksController({ env, providers }) {
  return {
    verifySubscription: (req, res) => {
      if (
        !env.META_WEBHOOK_VERIFY_TOKEN ||
        req.query['hub.mode'] !== 'subscribe' ||
        req.query['hub.verify_token'] !== env.META_WEBHOOK_VERIFY_TOKEN ||
        typeof req.query['hub.challenge'] !== 'string'
      )
        throw new HttpError(403, 'Webhook verification failed.');
      res.type('text/plain').send(req.query['hub.challenge']);
    },
    receiveStatus: async (req, res) => {
      providers.verifyWebhook(req);
      await providers.webhook(req.body);
      res.json({ ok: true });
    },
  };
}
