import { HttpError } from './records.js';
import { parseRequest, requiredText, moneyAmount } from './request-validation.js';

export function text(value, max = 100) {
  return parseRequest(requiredText(max), value, 'Required text is missing or too long.');
}

export function amount(value) {
  return Math.round(parseRequest(moneyAmount, value, 'Enter a valid amount.') * 100) / 100;
}

export function eventFor(data, id) {
  const event = data.events.find((e) => e.id === id);
  if (!event) throw new HttpError(404, 'Event not found.');
  return event;
}

export function openEvent(event) {
  if (
    new Date(`${event.endDate || event.date}T${event.endTime || '23:59'}:00+05:30`).getTime() <
    Date.now()
  )
    throw new HttpError(409, 'This event has ended.');
}

export const ownMember = (data, user) => data.members.find((m) => m.userId === user.id);
