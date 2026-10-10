import { HttpError } from './records.js';

export function text(value, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new HttpError(400, 'Required text is missing or too long.');
  return value.trim();
}

export function amount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1000000)
    throw new HttpError(400, 'Enter a valid amount.');
  return Math.round(value * 100) / 100;
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
