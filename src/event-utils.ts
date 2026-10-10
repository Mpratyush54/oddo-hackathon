export type EventPhase = 'upcoming' | 'ongoing' | 'past';

type EventSchedule = { date: string; time: string; endTime?: string; endDate?: string; durationMinutes?: number };

/** Campus event times are local to India, independent of a viewer's browser timezone. */
export function eventStart(event: EventSchedule): Date {
  return new Date(`${event.date}T${event.time.length === 5 ? `${event.time}:00` : event.time}+05:30`);
}

export function eventEnd(event: EventSchedule): Date {
  const start = eventStart(event);
  if (event.endTime) {
    const end = new Date(`${event.endDate || event.date}T${event.endTime.length === 5 ? `${event.endTime}:00` : event.endTime}+05:30`);
    // An end time earlier than the start means the event continues after midnight.
    if (!event.endDate && end.getTime() <= start.getTime()) end.setTime(end.getTime() + 86_400_000);
    return end;
  }
  return new Date(start.getTime() + Math.max(1, event.durationMinutes || 120) * 60_000);
}

export function eventPhase(event: EventSchedule, now = new Date()): EventPhase {
  if (now.getTime() < eventStart(event).getTime()) return 'upcoming';
  if (now.getTime() >= eventEnd(event).getTime()) return 'past';
  return 'ongoing';
}
