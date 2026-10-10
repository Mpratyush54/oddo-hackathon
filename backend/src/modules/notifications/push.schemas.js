import { z } from 'zod';
const hosts = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
export const pushEndpointSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (hosts.includes(url.hostname) || url.hostname.endsWith('.push.apple.com'))
    );
  }, 'Use a supported browser push service.');
export const pushSubscriptionSchema = z.strictObject({
  endpoint: pushEndpointSchema,
  expirationTime: z.number().nullable().optional(),
  keys: z.strictObject({
    p256dh: z
      .base64url()
      .min(80)
      .max(100)
      .refine(
        (value) => Buffer.from(value, 'base64url').length === 65,
        'Use the browser public encryption key.',
      ),
    auth: z
      .base64url()
      .min(20)
      .max(30)
      .refine(
        (value) => Buffer.from(value, 'base64url').length === 16,
        'Use the browser authentication secret.',
      ),
  }),
});
export const unsubscribeSchema = z.strictObject({ endpoint: pushEndpointSchema });
