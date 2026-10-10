import { parseRequest } from '../../shared/request-validation.js';
import { publishAnnouncementSchema, prepareRemindersSchema } from './communications.schemas.js';
import { HttpError, recordId } from '../../shared/records.js';
import { staff, requireRole } from '../../shared/authorization.js';

import { matchesAudience } from './audience.js';
import { ClubActionService } from '../clubs/club-action.service.js';

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
      date: this.now,
      read: false,
      to: '/app/announcements',
      audience,
    });
    for (const member of this.data.members.filter((m) => m.userId && matchesAudience(m, audience)))
      for (const channel of [
        ...(announcement.email ? ['Email'] : []),
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
        });
    const result = { announcement };

    return result;
  }

  prepareReminders(input) {
    input = parseRequest(prepareRemindersSchema, input);

    requireRole(this.role, staff);

    const announcementId = `REM-${input.status}-${this.now}`;
    if (this.data.deliveries.some((d) => d.announcementId === announcementId))
      throw new HttpError(409, 'Reminders have already been prepared today.');
    for (const member of this.data.members.filter((m) => m.userId && m.status === input.status))
      for (const channel of [
        'Email',
        ...(member.whatsappOptIn && member.phone ? ['WhatsApp'] : []),
      ])
        this.data.deliveries.unshift({
          id: recordId('DEL'),
          announcementId,
          channel,
          recipient: channel === 'WhatsApp' ? member.phone : member.email,
          status: 'Prepared',
          date: this.now,
          detail: 'Reminder prepared. No external message sent.',
        });

    return {};
  }
}
