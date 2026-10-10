import { HttpError, recordId } from '../../shared/records.js';
import { staff, requireRole } from '../../shared/authorization.js';
import { text } from '../../shared/validation.js';
import { matchesAudience } from './audience.js';

export function handleCommunications({ data, action, user, role, now, context, actor, args }) {
  let result = {};
  switch (action.type) {
    case 'announcements.publish': {
      requireRole(role, staff);
      const audience = text(args.audience, 80);
      if (
        !['All members', 'Active members', 'Volunteers', 'Pending dues', 'Renewing soon'].includes(
          audience,
        )
      )
        throw new HttpError(400, 'Unknown audience.');
      const announcement = {
        id: recordId('ANN'),
        title: text(args.title, 100),
        body: text(args.body, 3000),
        audience,
        date: now,
        author: user.name,
        authorId: user.id,
        read: 0,
        email: args.email === true,
        whatsapp: args.whatsapp === true,
        recipients: data.members.filter((m) => matchesAudience(m, audience)).length,
      };
      data.announcements.unshift(announcement);
      data.notifications.unshift({
        id: recordId('NOT'),
        title: announcement.title,
        body: announcement.body,
        date: now,
        read: false,
        to: '/app/announcements',
        audience,
      });
      for (const member of data.members.filter((m) => m.userId && matchesAudience(m, audience)))
        for (const channel of [
          ...(announcement.email ? ['Email'] : []),
          ...(announcement.whatsapp && member.whatsappOptIn && member.phone ? ['WhatsApp'] : []),
        ])
          data.deliveries.unshift({
            id: recordId('DEL'),
            announcementId: announcement.id,
            channel,
            recipient: channel === 'WhatsApp' ? member.phone : member.email,
            status: 'Prepared',
            date: now,
            detail: 'Prepared only. No external message sent.',
          });
      result = { announcement };
      break;
    }
    case 'reminders.prepare': {
      requireRole(role, staff);
      if (!['Pending', 'Expiring'].includes(args.status))
        throw new HttpError(400, 'Unknown reminder audience.');
      const announcementId = `REM-${args.status}-${now}`;
      if (data.deliveries.some((d) => d.announcementId === announcementId))
        throw new HttpError(409, 'Reminders have already been prepared today.');
      for (const member of data.members.filter((m) => m.userId && m.status === args.status))
        for (const channel of [
          'Email',
          ...(member.whatsappOptIn && member.phone ? ['WhatsApp'] : []),
        ])
          data.deliveries.unshift({
            id: recordId('DEL'),
            announcementId,
            channel,
            recipient: channel === 'WhatsApp' ? member.phone : member.email,
            status: 'Prepared',
            date: now,
            detail: 'Reminder prepared. No external message sent.',
          });
      break;
    }
  }
  return { data, result };
}
