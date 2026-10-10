import { createHash } from 'node:crypto';
import { clubKey, timestamp } from '../../shared/records.js';
import { visibleState } from '../clubs/club.views.js';
import { matchesAudience } from '../communications/audience.js';
import { normalizePhone } from '../../../../shared/schemas.js';
import { RemindersService } from './reminders.service.js';
import { WhatsAppService } from './whatsapp.service.js';
import { MailService } from './mail.service.js';
import { PushService } from './push.service.js';
import { reminderEligible } from './reminder-eligibility.js';
const key = (value) => 'DELIVERY#' + createHash('sha256').update(value).digest('hex');
const publicRow = ({ pk, sk, actor, ...row }) => row;
export class DeliveryWorker {
  constructor({ repo, domain, env, clubs, fetchImpl, mail, whatsapp, push }) {
    Object.assign(this, { repo, domain, env, clubs });
    this.reminders = new RemindersService({ repo, domain });
    this.whatsapp = whatsapp || new WhatsAppService({ env, fetchImpl });
    this.mail = mail || new MailService({ env, fetchImpl });
    this.push = push || new PushService({ repo, env });
  }
  async claim(clubId, source, retryFailed) {
    const pk = clubKey(clubId),
      sk = key(source.id + ':' + source.channel + ':' + source.recipient);
    const old = await this.repo.get(pk, sk);
    if (old && !(retryFailed && old.status === 'Failed' && old.version !== undefined)) return null;
    const row = {
      ...source,
      pk,
      sk,
      status: 'Unknown',
      version: (old?.version ?? -1) + 1,
      date: timestamp(),
      detail: 'Delivery is in progress or unconfirmed. Automatic resend is blocked.',
    };
    const operation = old
      ? {
          item: row,
          condition: '#version = :version',
          names: { '#version': 'version' },
          values: { ':version': old.version },
        }
      : { item: row, condition: 'attribute_not_exists(pk)' };
    return (await this.repo.atomic([operation])) ? row : null;
  }
  async finish(row, outcome) {
    let next = { ...row, ...outcome, version: row.version + 1 };
    if (outcome.providerMessageId) {
      await this.repo.put({
        pk: 'MESSAGE#' + outcome.providerMessageId,
        sk: 'DELIVERY',
        deliveryPk: row.pk,
        deliverySk: row.sk,
      });
      const early = await this.repo.get('MESSAGE#' + outcome.providerMessageId, 'STATUS');
      if (early)
        next = {
          ...next,
          providerStatus: early.providerStatus,
          providerTimestamp: early.providerTimestamp,
          status: early.providerStatus === 'failed' ? 'Failed' : 'Sent',
          detail: 'Meta webhook reports: ' + early.providerStatus,
        };
    }
    // A webhook may race with the provider response; never overwrite its confirmed state.
    await this.repo.atomic([
      {
        item: next,
        condition: '#version = :version',
        names: { '#version': 'version' },
        values: { ':version': row.version },
      },
    ]);
    return publicRow(await this.repo.get(row.pk, row.sk));
  }
  async deliver(clubId, source, retryFailed) {
    const row = await this.claim(clubId, source, retryFailed);
    if (!row) return null;
    const data = (await this.domain.load(clubId)).data;
    const member = data.members.find((m) =>
      source.userId
        ? m.userId === source.userId
        : source.channel === 'WhatsApp'
          ? normalizePhone(m.phone) === normalizePhone(source.recipient)
          : m.email === source.recipient,
    );
    const profile = member?.userId && (await this.repo.get('USER#' + member.userId, 'PROFILE'));
    const announcement = data.announcements.find((a) => a.id === source.announcementId);
    if (
      !member?.userId ||
      !profile ||
      profile.disabled ||
      !reminderEligible(data, member, source) ||
      (announcement && !matchesAudience(member, announcement.audience)) ||
      (source.channel === 'Email' &&
        (member.preferences?.email === false || member.email !== source.recipient)) ||
      (source.channel === 'WhatsApp' &&
        (!member.whatsappOptIn ||
          normalizePhone(member.phone) !== normalizePhone(source.recipient)))
    )
      return this.finish(row, {
        status: 'Failed',
        detail: 'Recipient eligibility, consent or preferences changed before sending.',
      });
    const message = {
      title: source.title || announcement?.title,
      body: source.body || announcement?.body,
      url: source.url || '/app/announcements',
    };
    if (!message.title || !message.body)
      return this.finish(row, {
        status: 'Failed',
        detail: 'This older queued record has no message content. Queue a new reminder.',
      });
    return this.finish(
      row,
      await (source.channel === 'WhatsApp' ? this.whatsapp : this.mail).send(member, message),
    );
  }
  async runClub(
    clubId,
    { retryFailed = false, deadline = Date.now() + 18000, maxDeliveries = 4 } = {},
  ) {
    const results = [];
    const data = (await this.domain.load(clubId)).data;
    // Oldest first prevents new announcements from starving existing reminders.
    for (const source of [...data.deliveries]
      .reverse()
      .filter((d) => d.status === 'Prepared' && ['Email', 'WhatsApp'].includes(d.channel))) {
      if (results.length >= maxDeliveries || Date.now() > deadline - 6000) break;
      const result = await this.deliver(clubId, source, retryFailed);
      if (result) results.push(result);
    }
    if (!this.push.configured()) return { deliveries: results };
    for (const member of data.members.filter((m) => m.userId)) {
      const user = await this.repo.get('USER#' + member.userId, 'PROFILE');
      if (!user || user.disabled) continue;
      const subscriptions = (await this.repo.list('USER#' + member.userId, 'PUSH#')).filter(
        (s) => s.active,
      );
      const notifications = visibleState(data, user, 'member').notifications.filter((n) => !n.read);
      for (const subscription of subscriptions)
        for (const notification of notifications) {
          if (results.length >= maxDeliveries || Date.now() > deadline - 6000)
            return { deliveries: results };
          if (Date.parse(notification.date) < Date.parse(subscription.createdAt)) continue;
          const fresh = (await this.domain.load(clubId)).data;
          const freshMember = fresh.members.find((m) => m.userId === user.id);
          const visible = visibleState(fresh, user, 'member').notifications.find(
            (n) => n.id === notification.id && !n.read,
          );
          const reminder =
            fresh.deliveries.find((d) => d.notificationId === notification.id) || notification;
          if (!freshMember || !visible || !reminderEligible(fresh, freshMember, reminder)) continue;
          const source = {
            id: `${notification.id}-${subscription.sk}`,
            announcementId: notification.id,
            notificationId: notification.id,
            userId: user.id,
            channel: 'Browser',
            recipient: subscription.sk,
            status: 'Prepared',
            date: timestamp(),
            detail: 'Queued browser notification.',
            kind: 'browser',
          };
          const row = await this.claim(clubId, source, false);
          if (row)
            results.push(
              await this.finish(
                row,
                await this.push.send(subscription, {
                  title: notification.title,
                  body: notification.body.slice(0, 240),
                  tag: `${clubId}:${notification.id}`,
                  url: notification.to?.startsWith('/app/')
                    ? notification.to
                    : '/app/communications',
                  clubId,
                }),
              ),
            );
        }
    }
    return { deliveries: results };
  }
  async run({ deadline = Date.now() + 18000, now = new Date() } = {}) {
    const results = [];
    for (const club of this.clubs) {
      if (Date.now() > deadline - 6000) break;
      try {
        await this.reminders.prepare(club.id, now);
        results.push({ clubId: club.id, ...(await this.runClub(club.id, { deadline })) });
      } catch (error) {
        console.error('Notification worker club failed', club.id, error.name);
      }
    }
    return { clubs: results };
  }
}
