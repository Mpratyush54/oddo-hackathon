import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { EventPhoto } from '../../../shared/ui/EventPhoto';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Revealed } from '../../../shared/components/PageMotion';
import { date, today } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { eventPhase, eventEnd } from '../utils/event-time';
import '../styles/calendar.css';

const keyFor = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

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

const getCategoryClass = (category: string) => {
  const c = (category || '').toLowerCase();
  if (c.includes('meeting') || c.includes('official') || c.includes('agm')) return 'chip-teal';
  if (c.includes('workshop') || c.includes('bootcamp') || c.includes('tech')) return 'chip-amber';
  if (c.includes('social') || c.includes('mixer') || c.includes('fest')) return 'chip-emerald';
  if (c.includes('fund') || c.includes('charity')) return 'chip-purple';
  return 'chip-blue';
};

export default function CampusCalendar() {
  const { data } = useStore();
  const now = new Date(`${today}T12:00:00`);
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<'agenda' | 'month'>('month');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const allMonthEvents = data.events
    .filter((e) => eventDays(e).some((day) => day.startsWith(monthKey)))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const monthEvents =
    selectedCategory === 'all'
      ? allMonthEvents
      : allMonthEvents.filter((e) =>
          e.category.toLowerCase().includes(selectedCategory.toLowerCase()),
        );

  const categories = ['all', ...new Set(allMonthEvents.map((e) => e.category))];

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
      <Link
        className="campus-agenda-event atmospheric-event"
        key={event.id}
        to={`/app/events/${event.id}`}
      >
        <div className="event-thumb-wrap">
          <EventPhoto
            image={event.image}
            seed={event.id}
            alt={event.title}
            className="event-thumb-img"
          />
        </div>
        <span className="campus-agenda-time">
          {event.time}
          <small>
            {phase === 'past' ? 'Finished' : phase === 'ongoing' ? 'Live now' : 'Starts at'}
          </small>
        </span>
        <div className="agenda-event-details">
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
        eyebrow="CAMPUS TIMELINE"
        title="Your campus calendar."
        description="See the month clearly. Find the plan that fits your day."
        action={
          <LinkButton to="/app/events" variant="secondary" icon="ArrowUpRight">
            Explore events
          </LinkButton>
        }
      />

      <Revealed delay={60}>
        <section className="campus-calendar">
          <header className="campus-calendar-header">
            <div>
              <span className="campus-calendar-overline">
                {monthEvents.length} EVENT{monthEvents.length !== 1 ? 'S' : ''} IN{' '}
                {month.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}
              </span>
              <h2>{monthName}</h2>
            </div>
            <div className="campus-calendar-controls">
              {categories.length > 2 && (
                <div className="calendar-cat-filter">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    aria-label="Filter events by category"
                  >
                    <option value="all">All categories ({allMonthEvents.length})</option>
                    {categories
                      .filter((c) => c !== 'all')
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  </select>
                </div>
              )}
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
                  className={view === 'month' ? 'active' : ''}
                  aria-pressed={view === 'month'}
                  onClick={() => setView('month')}
                >
                  Month
                </button>
                <button
                  className={view === 'agenda' ? 'active' : ''}
                  aria-pressed={view === 'agenda'}
                  onClick={() => setView('agenda')}
                >
                  Agenda
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
                  description="There are no club events matching this view. Try another month or clear filters."
                  action={<LinkButton to="/app/events">Browse events</LinkButton>}
                />
              )}
            </div>

            <div className="campus-calendar-month">
              <div className="campus-calendar-weekdays">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="campus-calendar-grid">
                {Array.from({ length: firstDay }, (_, i) => (
                  <div className="campus-calendar-blank" key={`blank-${i}`} />
                ))}
                {Array.from({ length: numberOfDays }, (_, i) => {
                  const day = keyFor(month.getFullYear(), month.getMonth(), i + 1);
                  const events = monthEvents.filter((e) => eventDays(e).includes(day));
                  const isToday = day === today;
                  const isSelected = day === selected;

                  return (
                    <div
                      key={day}
                      className={`campus-calendar-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => setSelected(day)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelected(day);
                        }
                      }}
                      aria-label={`${date(day, { weekday: 'long', day: 'numeric', month: 'long' })}, ${events.length} events`}
                    >
                      <div className="calendar-cell-top">
                        <span className="calendar-day-num">{i + 1}</span>
                        {events.length > 0 && (
                          <span className="calendar-day-count">{events.length}</span>
                        )}
                      </div>
                      <div className="calendar-cell-chips">
                        {events.slice(0, 3).map((e) => (
                          <Link
                            key={e.id}
                            to={`/app/events/${e.id}`}
                            className={`calendar-chip ${getCategoryClass(e.category)}`}
                            title={`${e.time} · ${e.title} (${e.category})`}
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <span className="chip-dot" />
                            <span className="chip-title">{e.title}</span>
                          </Link>
                        ))}
                        {events.length > 3 && (
                          <span className="calendar-chip-more">+{events.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <section className="campus-calendar-day">
                <div className="campus-calendar-day-header">
                  <div>
                    <span className="campus-day-overline">SELECTED DAY</span>
                    <h3>{date(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                  </div>
                  <Badge tone={selected === today ? 'green' : 'neutral'}>
                    {selected === today ? 'Today' : `${selectedEvents.length} scheduled`}
                  </Badge>
                </div>
                {selectedEvents.length > 0 ? (
                  <div className="campus-calendar-day-list">{selectedEvents.map(renderEvent)}</div>
                ) : (
                  <p className="campus-day-empty">
                    No scheduled activities for this date. Click another day on the calendar or
                    browse all upcoming events.
                  </p>
                )}
              </section>
            </div>
          </div>
        </section>
      </Revealed>

      <div className="campus-calendar-mobile-note">
        <Icon name="CalendarDays" size={17} />
        <p>Switch between Month and Agenda views to explore upcoming campus schedules.</p>
      </div>
    </>
  );
}
