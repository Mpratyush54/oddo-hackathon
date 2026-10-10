import { Link } from 'react-router-dom';
import { Revealed } from './PageMotion';
import { Icon, LinkButton } from '../components';
import { date, money, useStore } from '../store';

/** Public discovery starts with events, before asking a visitor to create a session. */
export function LandingEvents() {
  const { allClubs, organizations } = useStore();
  const events = organizations
    .flatMap((club) => allClubs[club.id].events.map((event) => ({ club, event })))
    .filter(({ event }) => new Date(`${event.date}T${event.time}:00+05:30`) > new Date())
    .sort((a, b) =>
      `${a.event.date}${a.event.time}`.localeCompare(`${b.event.date}${b.event.time}`),
    )
    .slice(0, 3);

  return (
    <Revealed>
      <section className="landing-events" aria-labelledby="landing-events-title">
        <header>
          <div>
            <span className="portal-kicker">OUTSIDE THE GROUP CHAT</span>
            <h2 id="landing-events-title">What's happening on campus</h2>
            <p>Browse the plan. Find your people. Save your seat.</p>
          </div>
          <LinkButton to="/events" variant="secondary" icon="ArrowRight">
            All campus events
          </LinkButton>
        </header>
        <div className="landing-event-grid">
          {events.map(({ club, event }) => (
            <Link
              className="landing-event"
              to={`/e/${club.id}/${event.id}`}
              key={`${club.id}-${event.id}`}
            >
              <div className="landing-event-image">
                <img src={event.image} alt={event.title} loading="lazy" />
                <span>{date(event.date, { month: 'short', day: 'numeric' })}</span>
                <span className="landing-event-arrow">
                  <Icon name="ArrowUpRight" />
                </span>
              </div>
              <small>
                {club.name} · {event.category}
              </small>
              <h3>{event.title}</h3>
              <p>
                {event.venue} · {event.time}
              </p>
              <footer>
                <strong>{event.price ? `From ${money(event.memberPrice)}` : 'Free entry'}</strong>
                <span>{Math.max(0, event.capacity - event.sold)} seats left</span>
              </footer>
            </Link>
          ))}
        </div>
      </section>
    </Revealed>
  );
}
