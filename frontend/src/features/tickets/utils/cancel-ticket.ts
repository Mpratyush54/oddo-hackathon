import { date, today, uid } from '../../../shared/utils/format';
import '../../finance/styles/finance.css';
import type { Store } from '../../../shared/types/domain';

export function cancelEventTicket(current: Store, ticketId: string, actor: string): Store {
  const ticket = current.tickets.find((t) => t.id === ticketId);
  if (!ticket || ticket.checkedIn || ticket.status === 'Cancelled') return current;
  const first = current.waitlist
    .filter((w) => w.eventId === ticket.eventId && w.status === 'Waiting')
    .sort((a, b) => a.joined.localeCompare(b.joined))[0];
  return {
    ...current,
    tickets: current.tickets.map((t) => (t.id === ticketId ? { ...t, status: 'Cancelled' } : t)),
    events: current.events.map((e) =>
      e.id === ticket.eventId ? { ...e, sold: Math.max(0, e.sold - (first ? 0 : 1)) } : e,
    ),
    waitlist: current.waitlist.map((w) => (w.id === first?.id ? { ...w, status: 'Promoted' } : w)),
    notifications: first
      ? [
          {
            id: uid('NTF'),
            title: 'A seat opened up',
            body: `${first.name}, your waitlist offer is reserved. Complete demo checkout to confirm it.`,
            date: new Date().toISOString(),
            read: false,
            to: first.email,
          },
          ...current.notifications,
        ]
      : current.notifications,
    transactions:
      ticket.amount > 0
        ? [
            {
              id: uid('TX'),
              title: `Demo cancellation credit · ${ticket.id}`,
              category: 'Tickets',
              amount: -ticket.amount,
              date: today,
              status: 'Completed',
              eventId: ticket.eventId,
              createdBy: actor,
            },
            ...current.transactions,
          ]
        : current.transactions,
  };
}
