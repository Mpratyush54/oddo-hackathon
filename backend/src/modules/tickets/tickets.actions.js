import { HttpError, recordId } from '../../shared/records.js';
import {
  cancelTicket,
  checkInWithPoints,
  joinWaitlist,
  isActiveMember,
} from '../commerce/commerce.service.js';
import { staff, requireRole } from '../../shared/authorization.js';
import { amount, eventFor, openEvent } from '../../shared/validation.js';

export function handleTickets({ data, action, user, role, now, context, actor, args }) {
  let result = {};
  switch (action.type) {
    case 'tickets.book': {
      const event = eventFor(data, args.eventId);
      openEvent(event);
      const offered = data.waitlist.some(
        (w) => w.eventId === event.id && w.email === user.email && w.status === 'Promoted',
      );
      if (event.sold >= event.capacity && !offered)
        throw new HttpError(409, 'This event is full. Join the waitlist.');
      if (
        data.tickets.some(
          (t) => t.eventId === event.id && t.userId === user.id && t.status !== 'Cancelled',
        )
      )
        throw new HttpError(409, 'You already booked this event.');
      const member = !!isActiveMember(data, user.email, now),
        price = member ? event.memberPrice : event.price;
      const ticket = {
        id: recordId('TKT'),
        eventId: event.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        member,
        checkedIn: false,
        amount: price,
        status: 'Confirmed',
        simulated: true,
      };
      data.tickets.unshift(ticket);
      if (!offered) event.sold++;
      data.transactions.unshift({
        id: recordId('TX'),
        title: `${event.title} · ${user.name} (simulated payment)`,
        category: 'Tickets',
        amount: price,
        date: now,
        status: 'Completed',
        eventId: event.id,
        createdBy: user.id,
        simulated: true,
      });
      data.waitlist = data.waitlist.map((w) =>
        w.eventId === event.id && w.email === user.email ? { ...w, status: 'Booked' } : w,
      );
      result = { ticket };
      break;
    }
    case 'tickets.cancel': {
      const ticket = data.tickets.find((t) => t.id === args.ticketId);
      if (!ticket) throw new HttpError(404, 'Ticket not found.');
      if (!staff.includes(role) && ticket.userId !== user.id)
        throw new HttpError(403, 'This ticket belongs to another user.');
      if (ticket.status === 'Cancelled' || ticket.checkedIn)
        throw new HttpError(409, 'This ticket cannot be cancelled.');
      openEvent(eventFor(data, ticket.eventId));
      result = cancelTicket(data, { ticketId: ticket.id, actor, today: now });
      data = { ...data, ...result.patch };
      break;
    }
    case 'check-in': {
      requireRole(role, staff);
      result = checkInWithPoints(data, { ticketId: args.ticketId, actor, today: now });
      data = { ...data, ...result.patch };
      break;
    }
    case 'waitlist.join': {
      openEvent(eventFor(data, args.eventId));
      result = joinWaitlist(data, { eventId: args.eventId, name: user.name, email: user.email });
      data = { ...data, ...result.patch };
      break;
    }
  }
  return { data, result };
}
