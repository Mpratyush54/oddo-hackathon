import { HttpError, timestamp } from '../../shared/records.js';
import { ownMember } from '../../shared/validation.js';

export function handleAccount({ data, action, user, role, now, context, actor, args }) {
  let result = {};
  switch (action.type) {
    case 'profile.preferences': {
      const member = ownMember(data, user);
      if (!member) throw new HttpError(409, 'Join the club first.');
      const phone = Object.hasOwn(args, 'phone')
        ? String(args.phone || '').trim()
        : member.phone || '';
      if (phone && !/^\+[1-9]\d{7,14}$/.test(phone))
        throw new HttpError(400, 'Use a phone number with country code.');
      if (args.whatsappOptIn && !phone)
        throw new HttpError(400, 'Add your WhatsApp number before opting in.');
      member.phone = phone;
      if (Object.hasOwn(args, 'whatsappOptIn')) {
        member.whatsappOptIn = args.whatsappOptIn === true;
        member.consentUpdatedAt = timestamp();
      }
      if (args.preferences)
        member.preferences = {
          email: args.preferences.email === true,
          renewals: args.preferences.renewals === true,
          weekly: args.preferences.weekly === true,
        };
      break;
    }
    case 'notifications.read': {
      const member = ownMember(data, user);
      if (!member) throw new HttpError(409, 'Join the club first.');
      if (!Array.isArray(args.ids) || args.ids.length > 100)
        throw new HttpError(400, 'Choose up to 100 notifications.');
      const allowed = data.notifications
        .filter((n) => !n.userId || n.userId === user.id)
        .map((n) => n.id);
      member.readNotificationIds = [
        ...new Set([
          ...(member.readNotificationIds || []),
          ...args.ids.filter((id) => allowed.includes(id)),
        ]),
      ].slice(-100);
      break;
    }
  }
  return { data, result };
}
