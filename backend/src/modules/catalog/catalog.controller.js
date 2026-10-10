import { publicState } from '../clubs/club.service.js';

export function createCatalogController({ env, clubs, domain }) {
  return {
    health: (req, res) =>
      res.json({
        mode: env.DATA_TABLE ? 'aws-backend' : 'local-backend',
        auth: 'JWT',
        database: env.DATA_TABLE ? 'DynamoDB' : 'Memory',
        ai: { configured: !!env.OPENROUTER_API_KEY, provider: 'OpenRouter' },
        email: {
          configured: !!(
            env.EMAIL_FROM &&
            (env.SMTP_HOST ? env.SMTP_USER && env.SMTP_PASSWORD : env.SENDGRID_API_KEY)
          ),
          provider: env.SMTP_HOST ? 'SMTP' : 'SendGrid',
        },
        whatsapp: {
          configured: !!(
            env.META_WHATSAPP_TOKEN &&
            env.META_PHONE_NUMBER_ID &&
            env.META_TEST_RECIPIENTS
          ),
          template: env.META_WHATSAPP_TEMPLATE || 'hello_world',
          webhookConfigured: !!env.META_APP_SECRET,
          contentParameters: Number(env.META_TEMPLATE_PARAMETER_COUNT || 0),
        },
        browserNotifications: {
          configured: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT),
        },
        payments: {
          provider: 'Razorpay',
          mode: 'test',
          configured: !!(
            env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') &&
            env.RAZORPAY_KEY_SECRET &&
            env.RAZORPAY_WEBHOOK_SECRET
          ),
        },
      }),
    listPublicClubs: async (req, res) =>
      res.json({
        organizations: clubs,
        clubs: Object.fromEntries(
          await Promise.all(
            clubs.map(async (c) => [c.id, publicState((await domain.load(c.id)).data)]),
          ),
        ),
      }),
  };
}
