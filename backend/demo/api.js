import { createOpenRouter } from '../src/modules/communications/openrouter.service.js';
import express from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  adjustInventory,
  awardPoints,
  cancelTicket,
  checkInWithPoints,
  CommerceError,
  ensureCommerceFields,
  joinWaitlist,
  placeOrder,
  quotePromo,
} from '../src/modules/commerce/commerce.domain.js';

export { loadLocalEnvironment } from '../src/config/environment.js';
import { loadLocalEnvironment } from '../src/config/environment.js';
import { normalizePhone, digitsSchema, graphVersionSchema } from '../../shared/schemas.js';
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function createApi({ env = process.env, fetchImpl = fetch } = {}) {
  const completed = new Map(),
    inFlight = new Map();
  let usageDate = '',
    drafts = 0;
  let minute = 0,
    requests = 0;
  const rateLimit = () => {
    const now = Math.floor(Date.now() / 60000);
    if (now !== minute) {
      minute = now;
      requests = 0;
    }
    if (++requests > 20)
      throw new ApiError(429, 'Too many requests. Give the demo a moment and try again.');
  };
  const draftFromProvider = createOpenRouter({ env, fetchImpl });
  const createAnnouncementDraft = async (body) => {
    const day = new Date().toISOString().slice(0, 10);
    if (day !== usageDate) {
      usageDate = day;
      drafts = 0;
    }
    if (drafts >= Number(env.AI_DAILY_LIMIT || 30))
      throw new ApiError(
        429,
        'The demo draft limit has been reached. Use the editable template draft.',
      );
    drafts++;

    return draftFromProvider(body);
  };
  const sendWhatsAppTest = async (body) => {
    if (body.channel !== 'WhatsApp')
      throw new ApiError(400, 'Only the configured WhatsApp test channel is enabled.');
    if (!env.META_WHATSAPP_TOKEN || !env.META_PHONE_NUMBER_ID)
      throw new ApiError(503, 'Meta WhatsApp test credentials are not configured.');
    const recipients = Array.isArray(body.recipients)
      ? [...new Set(body.recipients.map(normalizePhone))]
      : [];
    if (
      !recipients.length ||
      recipients.length > 5 ||
      recipients.some((phone) => !digitsSchema.min(8).max(15).safeParse(phone).success)
    )
      throw new ApiError(400, 'Choose up to five registered test recipients.');
    const allowed = new Set(
      String(env.META_TEST_RECIPIENTS || '')
        .split(',')
        .map(normalizePhone)
        .filter(Boolean),
    );
    if (!allowed.size || recipients.some((p) => !allowed.has(p)))
      throw new ApiError(403, 'Every recipient must be in the server-side Meta test allowlist.');
    const template = env.META_WHATSAPP_TEMPLATE || 'hello_world';
    if (body.template && body.template !== template)
      throw new ApiError(400, 'This template is not configured for the demo.');
    const version = env.META_GRAPH_VERSION || 'v25.0';
    if (
      !graphVersionSchema.safeParse(version).success ||
      !digitsSchema.safeParse(env.META_PHONE_NUMBER_ID).success
    )
      throw new ApiError(503, 'Check the Meta phone-number ID and Graph API version.');
    const id = String(body.announcementId || '');
    const club = String(body.clubId || '');
    if (!id || id.length > 100 || !club || club.length > 60)
      throw new ApiError(400, 'An announcement reference and club are required.');
    const parameterCount = Number(env.META_TEMPLATE_PARAMETER_COUNT || 0);
    if (![0, 1, 2].includes(parameterCount))
      throw new ApiError(503, 'Template parameter count must be 0, 1, or 2.');
    const details = await Promise.all(
      recipients.map(async (recipient) => {
        const key = `${club}:${id}:${template}:${recipient}`;
        if (completed.has(key)) return completed.get(key);
        if (inFlight.has(key)) return inFlight.get(key);
        const pending = (async () => {
          try {
            const templateBody = {
              name: template,
              language: { code: env.META_TEMPLATE_LANGUAGE || 'en_US' },
            };
            if (parameterCount)
              templateBody.components = [
                {
                  type: 'body',
                  parameters: [
                    String(body.title || '').slice(0, 100),
                    String(body.body || '').slice(0, 1500),
                  ]
                    .slice(0, parameterCount)
                    .map((text) => ({ type: 'text', text })),
                },
              ];
            const response = await fetchImpl(
              `https://graph.facebook.com/${version}/${env.META_PHONE_NUMBER_ID}/messages`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${env.META_WHATSAPP_TOKEN}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: recipient,
                  type: 'template',
                  template: templateBody,
                }),
                signal: AbortSignal.timeout(15000),
              },
            );
            const result = await response.json();
            if (!response.ok || !result.messages?.[0]?.id)
              return {
                recipient,
                channel: 'WhatsApp',
                status: 'Failed',
                detail: `Meta rejected the test request${result.error?.code ? ` (code ${result.error.code})` : ''}. Check token, test recipient, and template setup.`,
              };
            const sent = {
              recipient,
              channel: 'WhatsApp',
              status: 'Sent',
              detail:
                template === 'hello_world'
                  ? 'Meta accepted the hello_world connectivity test. Announcement content was not sent; device delivery is not confirmed.'
                  : 'Meta accepted the approved template. Device delivery requires a webhook confirmation.',
              providerMessageId: result.messages[0].id,
            };
            completed.set(key, sent);
            return sent;
          } catch {
            return {
              recipient,
              channel: 'WhatsApp',
              status: 'Failed',
              detail:
                'Test request could not be confirmed. Check the provider dashboard before retrying to avoid a duplicate.',
            };
          }
        })();
        inFlight.set(key, pending);
        try {
          return await pending;
        } finally {
          inFlight.delete(key);
        }
      }),
    );
    return { deliveries: details };
  };
  const requireSnapshot = (body) => {
    if (!body.snapshot || typeof body.snapshot !== 'object' || Array.isArray(body.snapshot))
      throw new ApiError(400, 'A club store snapshot is required for commerce actions.');
    if (!body.clubId || String(body.clubId).length > 60)
      throw new ApiError(400, 'A clubId is required.');
    return ensureCommerceFields(body.snapshot);
  };

  return async (path, method, body = {}) => {
    if (path === '/health' && method === 'GET')
      return {
        mode: 'local-demo',
        ai: {
          configured: !!env.OPENROUTER_API_KEY,
          provider: 'OpenRouter',
          model: env.OPENROUTER_MODEL || 'openrouter/free',
        },
        whatsapp: {
          configured: !!(
            env.META_WHATSAPP_TOKEN &&
            env.META_PHONE_NUMBER_ID &&
            env.META_TEST_RECIPIENTS
          ),
          template: env.META_WHATSAPP_TEMPLATE || 'hello_world',
        },
        commerce: {
          promos: true,
          inventory: true,
          waitlist: true,
          points: true,
          membershipUpsell: true,
        },
      };
    rateLimit();
    if (method !== 'POST') throw new ApiError(405, 'This action requires POST.');
    if (path === '/ai/draft') return createAnnouncementDraft(body);
    if (path === '/notifications/send') return sendWhatsAppTest(body);
    try {
      if (path === '/promos/quote') {
        const store = requireSnapshot(body);
        return quotePromo(store, body);
      }
      if (path === '/orders') {
        const store = requireSnapshot(body);
        return placeOrder(store, body);
      }
      if (path === '/inventory') {
        const store = requireSnapshot(body);
        return adjustInventory(store, body);
      }
      if (path === '/tickets/cancel') {
        const store = requireSnapshot(body);
        return cancelTicket(store, body);
      }
      if (path === '/waitlist/join') {
        const store = requireSnapshot(body);
        return joinWaitlist(store, body);
      }
      if (path === '/points/award') {
        const store = requireSnapshot(body);
        return awardPoints(store, body);
      }
      if (path === '/check-in') {
        const store = requireSnapshot(body);
        return checkInWithPoints(store, body);
      }
    } catch (error) {
      if (error instanceof CommerceError) throw new ApiError(error.status, error.message);
      throw error;
    }
    throw new ApiError(404, 'Unknown API endpoint.');
  };
}
// Local demo transport. Provider logic stays reusable for the future Lambda adapter.
export function createExpressApp({ env = process.env, fetchImpl = fetch } = {}) {
  const app = express();
  const api = createApi({ env, fetchImpl });
  app.disable('x-powered-by');

  app.use((request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    const origin = request.headers.origin;
    if (!origin) return next();
    try {
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        !['localhost', '127.0.0.1'].includes(url.hostname)
      ) {
        return response.status(403).json({ error: 'Local demo origin required.' });
      }
    } catch {
      return response.status(403).json({ error: 'Invalid request origin.' });
    }
    next();
  });

  // Club store snapshots for commerce can exceed the smaller AI-draft limit.
  app.use(express.json({ limit: '2mb', strict: true }));
  app.use('/api', async (request, response, next) => {
    try {
      const body = request.body ?? {};
      if (Array.isArray(body) || typeof body !== 'object' || body === null) {
        throw new ApiError(400, 'A JSON object is required.');
      }
      const result = await api(request.path, request.method, body);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use((_request, response) => response.status(404).json({ error: 'Unknown API endpoint.' }));
  app.use((error, _request, response, _next) => {
    if (error.type === 'entity.too.large') {
      return response.status(413).json({ error: 'Request too large.' });
    }
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'Invalid JSON request.' });
    }
    const status = error instanceof ApiError ? error.status : 503;
    // Never expose raw provider responses, credentials, or stack traces to the browser.
    response.status(status).json({
      error: error instanceof ApiError ? error.message : 'The service is temporarily unavailable.',
    });
  });
  return app;
}

export function startLocalApi() {
  loadLocalEnvironment();
  const port = Number(process.env.API_PORT || 3001);
  return createExpressApp().listen(port, '127.0.0.1', () => {
    console.log(`Skyline Express API ready at http://127.0.0.1:${port} (keys stay server-side)`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startLocalApi();
