import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Empty, Icon, LinkButton, PageHeader } from '../components';
import { date, today, useStore } from '../store';
import { eventPhase, eventEnd } from '../event-utils';
import '../campus-calendar.css';

const keyFor = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
// A continuing event belongs on each calendar day it occupies.
function eventDays(event: Parameters<typeof eventEnd>[0]): string[] {
  const end = new Date(eventEnd(event).getTime() - 1);
  const last = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(end);
  const days: string[] = [];
  const cursor = new Date(`${event.date}T12:00:00+05:30`);
  for (let count = 0; count < 366; count++) {
    const day = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(cursor);
    if (day > last) break;
    days.push(day);
    cursor.setTime(cursor.getTime() + 86400000);
  }
  return days;
}
export default function CampusCalendar() {
  const { data } = useStore();
  const now = new Date(`${today}T12:00:00`);
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState('agenda');
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const monthEvents = data.events
    .filter((e) => eventDays(e).some((day) => day.startsWith(monthKey)))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const groups = [
    ...new Set(monthEvents.flatMap(eventDays).filter((day) => day.startsWith(monthKey))),
  ].sort();
  const firstDay = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const numberOfDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const selectedEvents = data.events
    .filter((e) => eventDays(e).includes(selected))
    .sort((a, b) => a.time.localeCompare(b.time));
  const moveMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelected(keyFor(next.getFullYear(), next.getMonth(), 1));
  };
  const monthName = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const renderEvent = (event: (typeof data.events)[number]) => {
    const phase = eventPhase(event);
    return (
      <Link className="campus-agenda-event" key={event.id} to={`/app/events/${event.id}`}>
        <span className="campus-agenda-time">
          {event.time}
          <small>
            {phase === 'past' ? 'Finished' : phase === 'ongoing' ? 'Live now' : 'Starts at'}
          </small>
        </span>
        <div>
          <h3>{event.title}</h3>
          <p>
            <Icon name="MapPin" size={14} />
            {event.venue}
          </p>
          <Badge tone={phase === 'past' ? 'gold' : phase === 'ongoing' ? 'green' : 'teal'}>
            {phase === 'past'
              ? 'Past event'
              : phase === 'ongoing'
                ? 'Happening now'
                : event.category}
          </Badge>
        </div>
        <Icon name="ChevronRight" size={19} />
      </Link>
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="MAKE ROOM FOR GOOD COMPANY"
        title="Your campus calendar."
        description="See the month clearly. Find the plan that fits your day."
        action={
          <LinkButton to="/app/events" variant="secondary" icon="ArrowUpRight">
            Explore events
          </LinkButton>
        }
      />
      <section className="campus-calendar">
        <header className="campus-calendar-header">
          <div>
            <span className="campus-calendar-overline">{monthEvents.length} EVENTS THIS MONTH</span>
            <h2>{monthName}</h2>
          </div>
          <div className="campus-calendar-controls">
            <Button
              variant="secondary"
              onClick={() => {
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelected(today);
              }}
            >
              Today
            </Button>
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
            >
              <Icon name="ChevronLeft" />
            </button>
            <button className="icon-button" aria-label="Next month" onClick={() => moveMonth(1)}>
              <Icon name="ChevronRight" />
            </button>
            <div className="campus-calendar-view">
              <button
                className={view === 'agenda' ? 'active' : ''}
                aria-pressed={view === 'agenda'}
                onClick={() => setView('agenda')}
              >
                Agenda
              </button>
              <button
                className={view === 'month' ? 'active' : ''}
                aria-pressed={view === 'month'}
                onClick={() => setView('month')}
              >
                Month
              </button>
            </div>
          </div>
        </header>
        <div className={`campus-calendar-content view-${view}`}>
          <div className="campus-calendar-agenda">
            <div className="campus-calendar-agenda-heading">
              <h3>Plans for {month.toLocaleDateString('en-GB', { month: 'long' })}</h3>
              <p>A readable view of every event, day by day.</p>
            </div>
            {groups.map((day) => (
              <section className="campus-agenda-group" key={day}>
                <div className="campus-agenda-date">
                  <span>{date(day, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  {day === today && <Badge>Today</Badge>}
                </div>
                {monthEvents.filter((e) => eventDays(e).includes(day)).map(renderEvent)}
              </section>
            ))}
            {!groups.length && (
              <Empty
                title="A fresh month to fill"
                description="There are no club events in this month. Try the next month or explore all events."
                action={<LinkButton to="/app/events">Browse events</LinkButton>}
              />
            )}
          </div>
          <div className="campus-calendar-month">
            <div className="campus-calendar-weekdays">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                (d) => (
                  <span key={d}>{d.slice(0, 3)}</span>
                ),
              )}
            </div>
            <div className="campus-calendar-grid">
              {Array.from({ length: firstDay }, (_, i) => (
                <div className="campus-calendar-blank" key={`blank-${i}`} />
              ))}
              {Array.from({ length: numberOfDays }, (_, i) => {
                const day = keyFor(month.getFullYear(), month.getMonth(), i + 1);
                const events = monthEvents.filter((e) => eventDays(e).includes(day));
                return (
                  <button
                    key={day}
                    className={`campus-calendar-cell ${day === selected ? 'selected' : ''} ${day === today ? 'today' : ''}`}
                    aria-label={`${date(day, { weekday: 'long', day: 'numeric', month: 'long' })}, ${events.length} events`}
                    aria-pressed={day === selected}
                    onClick={() => setSelected(day)}
                  >
                    <span>{i + 1}</span>
                    {events.slice(0, 2).map((e) => (
                      <small key={e.id} title={e.title}>
                        {e.time} · {e.title}
                      </small>
                    ))}
                    {events.length > 2 && <strong>+{events.length - 2} more</strong>}
                  </button>
                );
              })}
            </div>
            <section className="campus-calendar-day">
              <div>
                <h3>{date(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                <p>
                  {selectedEvents.length
                    ? `${selectedEvents.length} plan${selectedEvents.length > 1 ? 's' : ''} for your day.`
                    : 'A little breathing room in your calendar.'}
                </p>
              </div>
              {selectedEvents.map(renderEvent)}
            </section>
          </div>
        </div>
      </section>
      <div className="campus-calendar-mobile-note">
        <Icon name="CalendarDays" size={17} />
        <p>The agenda keeps full event names and locations readable on your phone.</p>
      </div>
    </>
  );
}
