import webpush from 'web-push';
import { createHash } from 'node:crypto';
import { HttpError, timestamp } from '../../shared/records.js';
import { parseRequest } from '../../shared/request-validation.js';
import { pushSubscriptionSchema, unsubscribeSchema } from './push.schemas.js';

export const pushKey = (endpoint) => 'PUSH#' + createHash('sha256').update(endpoint).digest('hex');
const conditional = (item, prior) =>
  prior
    ? {
        item,
        condition: '#version = :version',
        names: { '#version': 'version' },
        values: { ':version': prior.version },
      }
    : { item, condition: 'attribute_not_exists(pk)' };
export class PushService {
  constructor({ repo, env, sendPush = webpush.sendNotification.bind(webpush) }) {
    Object.assign(this, { repo, env, sendPush });
  }
  configured() {
    return !!(this.env.VAPID_PUBLIC_KEY && this.env.VAPID_PRIVATE_KEY && this.env.VAPID_SUBJECT);
  }
  async settings(user) {
    return {
      configured: this.configured(),
      publicKey: this.env.VAPID_PUBLIC_KEY || '',
      subscriptions: (await this.repo.list('USER#' + user.id, 'PUSH#'))
        .filter((r) => r.active)
        .map((r) => ({ endpoint: r.subscription.endpoint })),
    };
  }
  async subscribe(input, user) {
    if (!this.configured()) throw new HttpError(503, 'Browser notifications are not configured.');
    const subscription = parseRequest(pushSubscriptionSchema, input);
    const pk = 'USER#' + user.id,
      sk = pushKey(subscription.endpoint);
    for (let attempt = 0; attempt < 5; attempt++) {
      const prior = await this.repo.get(pk, sk),
        owner = await this.repo.get(sk, 'OWNER');
      const record = {
        pk,
        sk,
        userId: user.id,
        subscription,
        active: true,
        createdAt: prior?.active && owner?.userId === user.id ? prior.createdAt : timestamp(),
        updatedAt: timestamp(),
        version: (prior?.version ?? -1) + 1,
      };
      if (
        await this.repo.atomic([
          conditional(record, prior),
          conditional(
            { pk: sk, sk: 'OWNER', userId: user.id, version: (owner?.version ?? -1) + 1 },
            owner,
          ),
        ])
      )
        return { enabled: true };
    }
    throw new HttpError(409, 'Notification settings changed. Please retry.');
  }
  async unsubscribe(input, user) {
    const { endpoint } = parseRequest(unsubscribeSchema, input);
    const prior = await this.repo.get('USER#' + user.id, pushKey(endpoint));
    if (prior) await this.disable(prior);
    return { enabled: false };
  }
  async disable(prior) {
    return this.repo.atomic([
      conditional(
        { ...prior, active: false, updatedAt: timestamp(), version: prior.version + 1 },
        prior,
      ),
    ]);
  }
  async send(record, message) {
    const latest = await this.repo.get(record.pk, record.sk),
      owner = await this.repo.get(record.sk, 'OWNER');
    if (!latest?.active || owner?.userId !== record.userId)
      return {
        status: 'Failed',
        detail: 'Browser notifications were disabled or this device changed account.',
      };
    try {
      await this.sendPush(latest.subscription, JSON.stringify(message), {
        TTL: 3600,
        timeout: 5000,
        vapidDetails: {
          subject: this.env.VAPID_SUBJECT,
          publicKey: this.env.VAPID_PUBLIC_KEY,
          privateKey: this.env.VAPID_PRIVATE_KEY,
        },
      });
      return {
        status: 'Sent',
        providerStatus: 'accepted',
        detail: 'Browser push service accepted the notification. Device display is not confirmed.',
      };
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) await this.disable(latest);
      return {
        status: error.statusCode ? 'Failed' : 'Unknown',
        detail: [404, 410].includes(error.statusCode)
          ? 'Browser subscription expired. Enable notifications again on this device.'
          : 'Browser notification was not confirmed by the push service.',
      };
    }
  }
}
