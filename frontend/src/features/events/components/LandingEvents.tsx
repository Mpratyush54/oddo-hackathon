import { Link } from 'react-router-dom';
import { Revealed } from '../../../shared/components/PageMotion';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { date, money } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';

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
    <section className="landing-events" aria-labelledby="landing-events-title">
      <Revealed>
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
      </Revealed>
      <div className="landing-event-grid">
        {events.map(({ club, event }, i) => {
          const hasMemberPrice =
            event.price > 0 &&
            event.memberPrice !== undefined &&
            event.memberPrice < event.price;
          const priceLabel =
            event.price > 0
              ? hasMemberPrice
                ? `${money(event.memberPrice)} members · ${money(event.price)} guests`
                : money(event.price)
              : 'Free entry';

          return (
            <Revealed key={`${club.id}-${event.id}`} delay={i * 70} pop>
              <Link
                className="landing-event"
                to={`/e/${club.id}/${event.id}`}
                aria-label={`View ${event.title}`}
              >
                <div className="landing-event-image">
                  <img src={event.image} alt={event.title} loading="lazy" />
                  <span>{date(event.date, { month: 'short', day: 'numeric' })}</span>
                  <span
                    className="landing-event-arrow"
                    role="img"
                    aria-label={`View ${event.title}`}
                  >
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
                  <strong>{priceLabel}</strong>
                  <span>{Math.max(0, event.capacity - event.sold)} seats left</span>
                </footer>
              </Link>
            </Revealed>
          );
        })}
      </div>
    </section>
  );
}
