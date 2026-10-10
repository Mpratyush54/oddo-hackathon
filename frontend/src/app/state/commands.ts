import type { Store } from '../../shared/types/domain';

/** Translate existing form changes to explicit server commands; never upload a store snapshot. */
export function actionFromChange(
  before: Store,
  after: Store,
): { type: string; args: Record<string, unknown> } | null {
  const added = <T extends { id: string }>(old: T[], next: T[]) =>
    next.find((item) => !old.some((x) => x.id === item.id));
  const changed = <T extends { id: string }>(old: T[], next: T[]) =>
    next.find((item) => {
      const prior = old.find((x) => x.id === item.id);
      return prior && JSON.stringify(prior) !== JSON.stringify(item);
    });
  const ticket = added(before.tickets, after.tickets);
  if (ticket) return { type: 'tickets.book', args: { eventId: ticket.eventId } };
  const editedTicket = changed(before.tickets, after.tickets);
  if (editedTicket?.status === 'Cancelled')
    return { type: 'tickets.cancel', args: { ticketId: editedTicket.id } };
  if (editedTicket?.checkedIn) return { type: 'check-in', args: { ticketId: editedTicket.id } };
  const announcement = added(before.announcements, after.announcements);
  if (announcement)
    return {
      type: 'announcements.publish',
      args: {
        title: announcement.title,
        body: announcement.body,
        audience: announcement.audience,
        email: announcement.email,
        whatsapp: announcement.whatsapp,
      },
    };
  const wait = added(before.waitlist, after.waitlist);
  if (wait) return { type: 'waitlist.join', args: { eventId: wait.eventId } };
  const review = added(before.eventReviews || [], after.eventReviews || []);
  if (review)
    return {
      type: 'reviews.create',
      args: { eventId: review.eventId, rating: review.rating, comment: review.comment },
    };
  const joined = added(before.members, after.members);
  if (joined)
    return joined.email === before.profile.email
      ? { type: 'membership.join', args: { course: joined.course } }
      : { type: 'members.add', args: { member: joined } };
  const member = changed(before.members, after.members);
  if (member) {
    const prior = before.members.find((m) => m.id === member.id)!;
    if (member.phone !== prior.phone || member.whatsappOptIn !== prior.whatsappOptIn)
      return {
        type: 'profile.preferences',
        args: { phone: member.phone, whatsappOptIn: member.whatsappOptIn },
      };
    if (member.status === 'Active' && prior.status !== 'Active')
      return { type: 'membership.demo-dues', args: { memberId: member.id } };
  }
  const transaction = changed(before.transactions, after.transactions);
  if (transaction)
    return {
      type: 'expenses.review',
      args: {
        transactionId: transaction.id,
        status: transaction.status,
        reason: transaction.rejectionReason,
      },
    };
  const income = added(before.transactions, after.transactions);
  if (income) {
    if (income.amount < 0) throw new Error('Submit expenses with the receipt upload form.');
    return {
      type: 'income.create',
      args: { title: income.title, category: income.category, amount: income.amount },
    };
  }
  const task = added(before.tasks, after.tasks) || changed(before.tasks, after.tasks);
  if (task) return { type: 'tasks.save', args: { task } };
  const event = added(before.events, after.events) || changed(before.events, after.events);
  if (event) return { type: 'events.save', args: { event } };
  const promo =
    added(before.promos || [], after.promos || []) ||
    changed(before.promos || [], after.promos || []);
  if (promo) return { type: 'promos.save', args: { promo } };
  const reminder = added(before.deliveries, after.deliveries);
  if (reminder?.announcementId.startsWith('REM-'))
    return { type: 'reminders.prepare', args: { status: reminder.announcementId.split('-')[1] } };
  const read = after.notifications
    .filter((n) => n.read && !before.notifications.find((x) => x.id === n.id)?.read)
    .map((n) => n.id);
  if (read.length) return { type: 'notifications.read', args: { ids: read } };
  if (JSON.stringify(before.preferences) !== JSON.stringify(after.preferences)) {
    return { type: 'profile.preferences', args: { preferences: after.preferences } };
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return null;
  throw new Error('This action is not yet available in the AWS workspace. No data was changed.');
}
