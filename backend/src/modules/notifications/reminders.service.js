import { clubKey, timestamp, recordId, HttpError } from '../../shared/records.js';
import {
  membershipReminder,
  eventReminders,
  weeklyReminders,
  queueReminder,
  reminderId,
} from './reminder-planner.js';
export class RemindersService {
  constructor({ repo, domain }) {
    Object.assign(this, { repo, domain });
  }
  async prepare(clubId, now = new Date()) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await this.domain.load(clubId),
        data = structuredClone(current.data);
      const candidates = [
        ...data.members.map((m) => membershipReminder(m, today)).filter(Boolean),
        ...eventReminders(data, now),
        ...weeklyReminders(data, now, today),
      ];
      const markers = [];
      for (const candidate of candidates) {
        if (markers.length >= 20) break;
        const sk = 'REMINDER#' + reminderId(candidate.key);
        if (await this.repo.get(clubKey(clubId), sk)) continue;
        // A manual reminder may already have queued this same day's notification.
        queueReminder(data, candidate, now.toISOString());
        markers.push({
          item: {
            pk: clubKey(clubId),
            sk,
            userId: candidate.userId,
            createdAt: now.toISOString(),
            expiresAt: Math.floor(now.getTime() / 1000) + 90 * 86400,
          },
          condition: 'attribute_not_exists(pk)',
        });
      }
      if (!markers.length) return { prepared: 0 };
      if (Buffer.byteLength(JSON.stringify(data)) > 300000)
        throw new HttpError(409, 'Club data limit reached; archive old notifications.');
      const audit = {
        id: recordId('AUD'),
        actor: 'SYSTEM',
        action: 'reminders.schedule',
        date: timestamp(),
        detail: `Queued ${markers.length} due reminders.`,
      };
      if (
        await this.repo.atomic([
          {
            item: { ...current, data, version: current.version + 1 },
            condition: '#version = :version',
            names: { '#version': 'version' },
            values: { ':version': current.version },
          },
          {
            item: { pk: clubKey(clubId), sk: `AUDIT#${audit.date}#${audit.id}`, ...audit },
            condition: 'attribute_not_exists(pk)',
          },
          ...markers,
        ])
      )
        return { prepared: markers.length };
    }
    throw new HttpError(409, 'Reminder scheduling is awaiting another update.');
  }
}
