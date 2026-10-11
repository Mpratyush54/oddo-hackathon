import { dateToday, HttpError } from '../../shared/records.js';
import { ensureCommerceFields } from '../commerce/commerce.domain.js';
import { MembershipService } from '../membership/membership.service.js';
import { AccountService } from '../account/account.service.js';
import { TicketService } from '../tickets/tickets.service.js';
import { CommerceService } from '../commerce/commerce.service.js';
import { FinanceService } from '../finance/finance.service.js';
import { AnnouncementService } from '../communications/announcements.service.js';
import { EventService } from '../events/events.service.js';
import { TaskService } from '../tasks/tasks.service.js';

const handlers = new Map([
  ['members.add', { Service: MembershipService, method: 'addMember' }],
  ['membership.join', { Service: MembershipService, method: 'join' }],
  ['membership.approve', { Service: MembershipService, method: 'approve' }],
  ['membership.demo-dues', { Service: MembershipService, method: 'payDemoDues' }],
  ['profile.preferences', { Service: AccountService, method: 'updatePreferences' }],
  ['notifications.read', { Service: AccountService, method: 'readNotifications' }],
  ['tickets.book', { Service: TicketService, method: 'book' }],
  ['tickets.cancel', { Service: TicketService, method: 'cancel' }],
  ['check-in', { Service: TicketService, method: 'checkIn' }],
  ['waitlist.join', { Service: TicketService, method: 'joinWaitlist' }],
  ['orders', { Service: CommerceService, method: 'placeOrder' }],
  ['orders.update', { Service: CommerceService, method: 'updateOrder' }],
  ['inventory', { Service: CommerceService, method: 'adjustInventory' }],
  ['products.create', { Service: CommerceService, method: 'createProduct' }],
  ['products.update', { Service: CommerceService, method: 'updateProduct' }],
  ['products.delete', { Service: CommerceService, method: 'deleteProduct' }],
  ['points.award', { Service: CommerceService, method: 'awardPoints' }],
  ['points.rules', { Service: CommerceService, method: 'savePointRules' }],
  ['promos.save', { Service: CommerceService, method: 'savePromo' }],
  ['expenses.create', { Service: FinanceService, method: 'createExpense' }],
  ['expenses.review', { Service: FinanceService, method: 'reviewExpense' }],
  ['income.create', { Service: FinanceService, method: 'createIncome' }],
  ['announcements.publish', { Service: AnnouncementService, method: 'publish' }],
  ['reminders.prepare', { Service: AnnouncementService, method: 'prepareReminders' }],
  ['events.save', { Service: EventService, method: 'save' }],
  ['reviews.create', { Service: EventService, method: 'createReview' }],
  ['tasks.save', { Service: TaskService, method: 'save' }],
  ['tasks.claim', { Service: TaskService, method: 'claim' }],
  ['projects.save', { Service: TaskService, method: 'saveProject' }],
]);

export function applyAction(input, action, user, role, now = dateToday(), context = {}) {
  const handler = handlers.get(action.type);
  if (!handler) throw new HttpError(400, 'Unknown action.');
  const args = action.args || {};
  const service = new handler.Service({
    data: ensureCommerceFields(structuredClone(input)),
    user,
    role,
    now,
    clubId: action.clubId,
    targetUser: context.targetUser,
  });
  const result = service[handler.method](args);
  return { data: service.data, result };
}
