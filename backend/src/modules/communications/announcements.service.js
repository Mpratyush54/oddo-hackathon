import { parseRequest } from '../../shared/request-validation.js';
import { publishAnnouncementSchema, prepareRemindersSchema } from './communications.schemas.js';
import { HttpError, recordId, timestamp } from '../../shared/records.js';
import { staff, requireRole } from '../../shared/authorization.js';

import { matchesAudience } from './audience.js';
import { ClubActionService } from '../clubs/club-action.service.js';
import { membershipReminder, queueReminder } from '../notifications/reminder-planner.js';

export class AnnouncementService extends ClubActionService {
  publish(input) {
    input = parseRequest(publishAnnouncementSchema, input);

    requireRole(this.role, staff);
    const audience = input.audience;

    const announcement = {
      id: recordId('ANN'),
      title: input.title,
      body: input.body,
      audience,
      date: this.now,
      author: this.user.name,
      authorId: this.user.id,
      read: 0,
      email: input.email,
      whatsapp: input.whatsapp,
      recipients: this.data.members.filter((m) => matchesAudience(m, audience)).length,
    };
    this.data.announcements.unshift(announcement);
    this.data.notifications.unshift({
      id: recordId('NOT'),
      title: announcement.title,
      body: announcement.body,
      date: timestamp(),
      read: false,
      to: '/app/announcements',
      audience,
    });
    for (const member of this.data.members.filter((m) => m.userId && matchesAudience(m, audience)))
      for (const channel of [
        ...(announcement.email && member.preferences?.email !== false ? ['Email'] : []),
        ...(announcement.whatsapp && member.whatsappOptIn && member.phone ? ['WhatsApp'] : []),
      ])
        this.data.deliveries.unshift({
          id: recordId('DEL'),
          announcementId: announcement.id,
          channel,
          recipient: channel === 'WhatsApp' ? member.phone : member.email,
          status: 'Prepared',
          date: this.now,
          detail: 'Prepared only. No external message sent.',
          userId: member.userId,
          title: announcement.title,
          body: announcement.body,
          url: '/app/announcements',
          kind: 'announcement',
        });
    const result = { announcement };

    return result;
  }

  prepareReminders(input) {
    input = parseRequest(prepareRemindersSchema, input);

    requireRole(this.role, staff);

    let prepared = 0;
    for (const member of this.data.members) {
      if (input.memberIds && !input.memberIds.includes(member.id)) continue;
      const reminder = membershipReminder(member, this.now, input.status);
      if (reminder && queueReminder(this.data, reminder, timestamp())) prepared++;
    }
    if (!prepared)
      throw new HttpError(
        409,
        'No eligible reminders, or these reminders were already queued today.',
      );
    return { prepared };
  }
}
