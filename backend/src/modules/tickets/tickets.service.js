import { parseRequest } from '../../shared/request-validation.js';
import { eventReferenceSchema, ticketReferenceSchema } from './tickets.schemas.js';
import { HttpError, recordId } from '../../shared/records.js';
import {
  cancelTicket,
  checkInWithPoints,
  joinWaitlist,
  isActiveMember,
} from '../commerce/commerce.domain.js';
import { staff, requireRole } from '../../shared/authorization.js';
import { eventFor, openEvent } from '../../shared/validation.js';
import { ClubActionService } from '../clubs/club-action.service.js';

export class TicketService extends ClubActionService {
  book(input) {
    input = parseRequest(eventReferenceSchema, input);

    const event = eventFor(this.data, input.eventId);
    openEvent(event);
    const offered = this.data.waitlist.some(
      (w) => w.eventId === event.id && w.email === this.user.email && w.status === 'Promoted',
    );
    if (event.sold >= event.capacity && !offered)
      throw new HttpError(409, 'This event is full. Join the waitlist.');
    if (
      this.data.tickets.some(
        (t) => t.eventId === event.id && t.userId === this.user.id && t.status !== 'Cancelled',
      )
    )
      throw new HttpError(409, 'You already booked this event.');
    const member = !!isActiveMember(this.data, this.user.email, this.now),
      price = member ? event.memberPrice : event.price;
    const ticket = {
      id: recordId('TKT'),
      eventId: event.id,
      userId: this.user.id,
      name: this.user.name,
      email: this.user.email,
      member,
      checkedIn: false,
      amount: price,
      status: 'Confirmed',
      simulated: true,
    };
    this.data.tickets.unshift(ticket);
    if (!offered) event.sold++;
    this.data.transactions.unshift({
      id: recordId('TX'),
      title: `${event.title} · ${this.user.name} (simulated payment)`,
      category: 'Tickets',
      amount: price,
      date: this.now,
      status: 'Completed',
      eventId: event.id,
      createdBy: this.user.id,
      simulated: true,
    });
    this.data.waitlist = this.data.waitlist.map((w) =>
      w.eventId === event.id && w.email === this.user.email ? { ...w, status: 'Booked' } : w,
    );
    const result = { ticket };

    return result;
  }

  cancel(input) {
    input = parseRequest(ticketReferenceSchema, input);

    const ticket = this.data.tickets.find((t) => t.id === input.ticketId);
    if (!ticket) throw new HttpError(404, 'Ticket not found.');
    if (!staff.includes(this.role) && ticket.userId !== this.user.id)
      throw new HttpError(403, 'This ticket belongs to another user.');
    if (ticket.status === 'Cancelled' || ticket.checkedIn)
      throw new HttpError(409, 'This ticket cannot be cancelled.');
    openEvent(eventFor(this.data, ticket.eventId));
    const result = cancelTicket(this.data, {
      ticketId: ticket.id,
      actor: this.actor,
      today: this.now,
    });
    this.data = { ...this.data, ...result.patch };

    return result;
  }

  checkIn(input) {
    input = parseRequest(ticketReferenceSchema, input);

    requireRole(this.role, staff);
    const result = checkInWithPoints(this.data, {
      ticketId: input.ticketId,
      actor: this.actor,
      today: this.now,
    });
    this.data = { ...this.data, ...result.patch };

    return result;
  }

  joinWaitlist(input) {
    input = parseRequest(eventReferenceSchema, input);

    openEvent(eventFor(this.data, input.eventId));
    const result = joinWaitlist(this.data, {
      eventId: input.eventId,
      name: this.user.name,
      email: this.user.email,
    });
    this.data = { ...this.data, ...result.patch };

    return result;
  }
}
