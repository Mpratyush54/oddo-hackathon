import { renewingSoon } from '../../../../shared/reminders.js';
import { hasActiveMembership } from '../../../../shared/membership.js';
import { dateToday } from '../../shared/records.js';
export function matchesAudience(member, audience) {
  return (
    audience === 'All members' ||
    (audience === 'Active members' && hasActiveMembership(member, dateToday())) ||
    (audience === 'Volunteers' && member.role === 'Volunteer') ||
    (audience === 'Pending dues' && member.status === 'Pending') ||
    (audience === 'Renewing soon' && renewingSoon(member, dateToday()))
  );
}
