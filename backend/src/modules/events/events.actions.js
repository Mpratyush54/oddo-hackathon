import { HttpError, timestamp, recordId } from '../../shared/records.js';
import { staff, requireRole } from '../../shared/authorization.js';
import { text, eventFor } from '../../shared/validation.js';
import { eventSchema } from '../../database/schemas/club.schema.js';

export function handleEvents({ data, action, user, role, now, context, actor, args }) {
  let result = {};
  switch (action.type) {
    case 'events.save': {
      requireRole(role, staff);
      const e = args.event;
      if (
        !e ||
        !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
        !/^\d{2}:\d{2}$/.test(e.time) ||
        !Number.isInteger(e.capacity) ||
        e.capacity < 1 ||
        e.capacity > 10000 ||
        !Number.isFinite(e.price) ||
        e.price < 0 ||
        !Number.isFinite(e.memberPrice) ||
        e.memberPrice < 0
      )
        throw new HttpError(400, 'Enter a valid event schedule, capacity, and prices.');
      const prior = e.id ? data.events.find((x) => x.id === e.id) : null;
      if (e.capacity < (prior?.sold || 0))
        throw new HttpError(409, 'Capacity cannot be lower than bookings.');
      const event = {
        id: prior?.id || recordId('EVT'),
        title: text(e.title, 100),
        description: text(e.description, 5000),
        date: e.date,
        time: e.time,
        venue: text(e.venue, 120),
        category: text(e.category, 40),
        price: e.price,
        memberPrice: e.memberPrice,
        capacity: e.capacity,
        sold: prior?.sold || 0,
        image: /^https:\/\//.test(String(e.image)) ? e.image : '',
        budget: Number.isFinite(e.budget) && e.budget >= 0 ? e.budget : prior?.budget || 0,
        recap: String(e.recap || '').slice(0, 2500),
        gallery: Array.isArray(e.gallery)
          ? e.gallery
              .filter((url) => typeof url === 'string' && url.startsWith('https://'))
              .slice(0, 3)
          : [],
        endTime: /^\d{2}:\d{2}$/.test(e.endTime || '') ? e.endTime : undefined,
        endDate: /^\d{4}-\d{2}-\d{2}$/.test(e.endDate || '') ? e.endDate : undefined,
      };
      if (!eventSchema.safeParse(event).success)
        throw new HttpError(400, 'Enter a valid event schedule, capacity, and prices.');
      data.events = [event, ...data.events.filter((x) => x.id !== event.id)];
      break;
    }
    case 'reviews.create': {
      const event = eventFor(data, args.eventId);
      if (
        event.date >= now ||
        !data.tickets.some((t) => t.eventId === event.id && t.userId === user.id && t.checkedIn)
      )
        throw new HttpError(403, 'Only checked-in attendees can review an ended event.');
      if (
        !Number.isInteger(args.rating) ||
        args.rating < 1 ||
        args.rating > 5 ||
        (data.eventReviews || []).some((r) => r.eventId === event.id && r.authorId === user.id)
      )
        throw new HttpError(409, 'A valid single review is required.');
      data.eventReviews = [
        {
          id: recordId('REV'),
          eventId: event.id,
          authorId: user.id,
          authorName: user.name,
          rating: args.rating,
          comment: text(args.comment, 1500),
          date: timestamp(),
        },
        ...(data.eventReviews || []),
      ];
      break;
    }
  }
  return { data, result };
}
