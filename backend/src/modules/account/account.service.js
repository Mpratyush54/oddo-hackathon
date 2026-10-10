import { parseRequest } from '../../shared/request-validation.js';
import { preferencesRequestSchema, readNotificationsSchema } from './account.schemas.js';
import { HttpError, timestamp } from '../../shared/records.js';
import { ownMember } from '../../shared/validation.js';
import { ClubActionService } from '../clubs/club-action.service.js';

export class AccountService extends ClubActionService {
  updatePreferences(input) {
    input = parseRequest(preferencesRequestSchema, input);

    const member = ownMember(this.data, this.user);
    if (!member) throw new HttpError(409, 'Join the club first.');
    const phone = Object.hasOwn(input, 'phone') ? (input.phone ?? '') : member.phone || '';

    if (input.whatsappOptIn && !phone)
      throw new HttpError(400, 'Add your WhatsApp number before opting in.');
    member.phone = phone;
    if (Object.hasOwn(input, 'whatsappOptIn')) {
      member.whatsappOptIn = input.whatsappOptIn;
      member.consentUpdatedAt = timestamp();
    }
    if (input.preferences) member.preferences = input.preferences;

    return {};
  }

  readNotifications(input) {
    input = parseRequest(readNotificationsSchema, input);

    const member = ownMember(this.data, this.user);
    if (!member) throw new HttpError(409, 'Join the club first.');

    const allowed = this.data.notifications
      .filter((n) => !n.userId || n.userId === this.user.id)
      .map((n) => n.id);
    member.readNotificationIds = [
      ...new Set([
        ...(member.readNotificationIds || []),
        ...input.ids.filter((id) => allowed.includes(id)),
      ]),
    ].slice(-100);

    return {};
  }
}
