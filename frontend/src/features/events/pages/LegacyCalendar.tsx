import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { date, today } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';

export function CalendarPage() {
  const { data } = useStore();
  const [month, setMonth] = useState(9),
    [year, setYear] = useState(2026),
    [selected, setSelected] = useState('2026-10-10');
  const first = new Date(year, month, 1);
  const count = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from(
    { length: Math.ceil((offset + count) / 7) * 7 },
    (_, i) => i - offset + 1,
  );
  const move = (n: number) => {
    const next = new Date(year, month + n, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  };
  const events = data.events.filter((e) => e.date === selected);
  return (
    <>
      <PageHeader
        eyebrow="MAKE ROOM FOR GOOD THINGS"
        title="Your community calendar"
        description="The plans, the people, and the moments to look forward to."
        action={
          <LinkButton to="/app/events?create=true" icon="Plus">
            Create event
          </LinkButton>
        }
      />
      <div className="calendar-layout">
        <section className="card calendar-card">
          <div className="calendar-heading">
            <h2>{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
            <div>
              <Button
                variant="secondary"
                onClick={() => {
                  setMonth(9);
                  setYear(2026);
                  setSelected(today);
                }}
              >
                Today
              </Button>
              <button className="icon-button" onClick={() => move(-1)} aria-label="Previous month">
                <Icon name="ChevronLeft" />
              </button>
              <button className="icon-button" onClick={() => move(1)} aria-label="Next month">
                <Icon name="ChevronRight" />
              </button>
            </div>
          </div>
          <div className="calendar-weekdays">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((day, i) => {
              const valid = day > 0 && day <= count;
              const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = data.events.filter((e) => e.date === key);
              return (
                <div
                  key={i}
                  className={`calendar-day ${!valid ? 'outside' : ''} ${selected === key ? 'selected' : ''}`}
                  onClick={() => valid && setSelected(key)}
                >
                  {valid && (
                    <>
                      <button
                        aria-label={`Select ${date(key)}`}
                        className={`calendar-day-number ${key === today ? 'today' : ''}`}
                        onClick={() => setSelected(key)}
                      >
                        {day}
                      </button>
                      {dayEvents.map((e) => (
                        <Link
                          key={e.id}
                          to={`/app/events/${e.id}`}
                          className={`calendar-event ${e.category === 'Fundraiser' ? 'green' : e.category === 'Social' ? 'purple' : 'teal'}`}
                        >
                          {e.time} · {e.title}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <aside className="card calendar-day-detail">
          <div className="eyebrow">A LITTLE LOOK AHEAD</div>
          <h2>{date(selected, { weekday: 'long' })}</h2>
          <p>{date(selected, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          {events.length ? (
            events.map((e) => (
              <Link to={`/app/events/${e.id}`} key={e.id} className="day-event">
                <Badge tone="purple">{e.category}</Badge>
                <h3>{e.title}</h3>
                <p>
                  {e.time} · {e.venue}
                </p>
                <span className="text-link">
                  View event <Icon name="ArrowRight" size={15} />
                </span>
              </Link>
            ))
          ) : (
            <Empty
              title="A little breathing room"
              description="No events today. Pick another day to see what’s on."
            />
          )}
          <LinkButton to="/app/events" variant="secondary" icon="CalendarDays">
            Explore all events
          </LinkButton>
        </aside>
      </div>
    </>
  );
}
