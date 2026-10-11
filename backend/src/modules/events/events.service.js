import { parseRequest } from '../../shared/request-validation.js';
import { saveEventSchema, createReviewSchema } from './events.schemas.js';
import { HttpError, timestamp, recordId } from '../../shared/records.js';
import { staff, requireRole } from '../../shared/authorization.js';
import { eventFor } from '../../shared/validation.js';
import { resolveEventImage } from '../../../../shared/event-images.js';

import { ClubActionService } from '../clubs/club-action.service.js';

export class EventService extends ClubActionService {
  save(input) {
    input = parseRequest(saveEventSchema, input);

    requireRole(this.role, staff);
    const e = input.event;

    const prior = e.id ? this.data.events.find((x) => x.id === e.id) : null;
    if (e.capacity < (prior?.sold || 0))
      throw new HttpError(409, 'Capacity cannot be lower than bookings.');
    const id = prior?.id || recordId('EVT');
    const event = {
      id,
      title: e.title,
      description: e.description,
      date: e.date,
      time: e.time,
      venue: e.venue,
      category: e.category,
      price: e.price,
      memberPrice: e.memberPrice,
      capacity: e.capacity,
      sold: prior?.sold || 0,
      image: resolveEventImage(e.image || prior?.image, id),
      budget: e.budget ?? prior?.budget ?? 0,
      recap: e.recap ?? '',
      gallery: e.gallery ?? [],
      endTime: e.endTime,
      endDate: e.endDate,
    };

    this.data.events = [event, ...this.data.events.filter((x) => x.id !== event.id)];

    return {};
  }

  createReview(input) {
    input = parseRequest(createReviewSchema, input);

    const event = eventFor(this.data, input.eventId);
    if (
      event.date >= this.now ||
      !this.data.tickets.some(
        (t) => t.eventId === event.id && t.userId === this.user.id && t.checkedIn,
      )
    )
      throw new HttpError(403, 'Only checked-in attendees can review an ended event.');
    if (
      (this.data.eventReviews || []).some(
        (r) => r.eventId === event.id && r.authorId === this.user.id,
      )
    )
      throw new HttpError(409, 'A valid single review is required.');
    this.data.eventReviews = [
      {
        id: recordId('REV'),
        eventId: event.id,
        authorId: this.user.id,
        authorName: this.user.name,
        rating: input.rating,
        comment: input.comment,
        date: timestamp(),
      },
      ...(this.data.eventReviews || []),
    ];

    return {};
  }
}
