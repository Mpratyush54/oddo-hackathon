import { dateToday, HttpError } from '../../shared/records.js';
import { ensureCommerceFields } from '../commerce/commerce.service.js';
import { handleMembership } from '../membership/membership.actions.js';
import { handleAccount } from '../account/account.actions.js';
import { handleTickets } from '../tickets/tickets.actions.js';
import { handleCommerce } from '../commerce/commerce.actions.js';
import { handleFinance } from '../finance/finance.actions.js';
import { handleCommunications } from '../communications/communications.actions.js';
import { handleEvents } from '../events/events.actions.js';
import { handleTasks } from '../tasks/tasks.actions.js';

const handlers = new Map([
  ['members.add', handleMembership],
  ['membership.join', handleMembership],
  ['membership.demo-dues', handleMembership],
  ['profile.preferences', handleAccount],
  ['notifications.read', handleAccount],
  ['tickets.book', handleTickets],
  ['tickets.cancel', handleTickets],
  ['check-in', handleTickets],
  ['waitlist.join', handleTickets],
  ['orders', handleCommerce],
  ['inventory', handleCommerce],
  ['points.award', handleCommerce],
  ['promos.save', handleCommerce],
  ['expenses.create', handleFinance],
  ['expenses.review', handleFinance],
  ['income.create', handleFinance],
  ['announcements.publish', handleCommunications],
  ['reminders.prepare', handleCommunications],
  ['events.save', handleEvents],
  ['reviews.create', handleEvents],
  ['tasks.save', handleTasks],
]);
export function applyAction(input, action, user, role, now = dateToday(), context = {}) {
  const handler = handlers.get(action.type);
  if (!handler) throw new HttpError(400, 'Unknown action.');
  return handler({
    data: ensureCommerceFields(structuredClone(input)),
    action,
    user,
    role,
    now,
    context,
    actor: { id: user.id, name: user.name, email: user.email },
    args: action.args || {},
  });
}
