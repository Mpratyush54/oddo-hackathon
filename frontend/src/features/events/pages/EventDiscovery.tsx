import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { Logo } from '../../../shared/ui/Logo';
import { SearchField } from '../../../shared/ui/SearchField';
import { date, money } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import { PublicNav } from '../../../shared/layout/PublicLayout';
import { eventPhase } from '../utils/event-time';
import { Revealed } from '../../../shared/components/PageMotion';
import '../styles/discovery.css';

export function EventDiscovery({ publicView = false }: { publicView?: boolean }) {
  const { data, allClubs, organizations, selectedClub } = useStore();
  const { can } = useSession();
  const [tab, setTab] = useState('Upcoming');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const [club, setClub] = useState('All clubs');
  const [filters, setFilters] = useState(false);
  const events = publicView
    ? organizations.flatMap((org) =>
        (allClubs[org.id]?.events || []).map((event) => ({
          ...event,
          clubId: org.id,
          clubName: org.name,
        })),
      )
    : data.events.map((event) => ({
        ...event,
        clubId: selectedClub,
        clubName: organizations.find((c) => c.id === selectedClub)?.name || 'Your club',
      }));
  const visible = events
    .filter((event) => {
      const phase = eventPhase(event);
      return (
        (tab === 'All events' || (tab === 'Past events' ? phase === 'past' : phase !== 'past')) &&
        `${event.title} ${event.venue} ${event.clubName}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (category === 'All categories' || event.category === category) &&
        (club === 'All clubs' || event.clubId === club)
      );
    })
    .sort((a, b) =>
      tab === 'Past events'
        ? `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)
        : `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    );
  const featured = publicView && tab === 'Upcoming' ? visible[0] : null;
  const activeFilters = (category !== 'All categories' ? 1 : 0) + (club !== 'All clubs' ? 1 : 0);
  const content = (
    <main className="event-discovery">
      <header className="event-discovery-heading">
        <div>
          <span className="event-discovery-overline">EXPLORE CAMPUS</span>
          <h1>
            {tab === 'Past events'
              ? 'Past event highlights'
              : tab === 'All events'
                ? 'Campus events'
                : 'Upcoming campus events'}
          </h1>
          <p>
            {publicView
              ? 'Discover events across student clubs. Compare dates, find a seat, or explore past highlights.'
              : 'Upcoming plans and past events from your club, in one place.'}
          </p>
        </div>
        <div>
          {!publicView && (
            <LinkButton to="/app/calendar" variant="secondary" icon="CalendarDays">
              Open calendar
            </LinkButton>
          )}
          {!publicView && can('manage_events') && (
            <LinkButton to="/app/events/manage?create=true" icon="Plus">
              Create event
            </LinkButton>
          )}
        </div>
      </header>
      {featured && (
        <section className="event-spotlight" aria-label="Featured upcoming event">
          <img src={featured.image} alt={featured.title} />
          <div>
            <span className="event-spotlight-label">
              <span className="live-dot" />
              UPCOMING · NEXT ON CAMPUS
            </span>
            <p>{featured.clubName}</p>
            <h2>{featured.title}</h2>
            <div className="event-spotlight-meta">
              <span>
                <Icon name="CalendarDays" />
                {date(featured.date, { weekday: 'short', day: 'numeric', month: 'long' })} ·{' '}
                {featured.time}
              </span>
              <span>
                <Icon name="MapPin" />
                {featured.venue}
              </span>
            </div>
            <LinkButton to={`/e/${featured.clubId}/${featured.id}`} icon="ArrowRight">
              View event & tickets
            </LinkButton>
          </div>
        </section>
      )}
      {featured && <div className="event-hero-divider" role="separator" />}
      <section className="event-discovery-tools" aria-label="Find campus events">
        <div className="event-discovery-tabs">
          {['Upcoming', 'Past events', 'All events'].map((t) => (
            <button
              key={t}
              className={tab === t ? 'active' : ''}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="event-discovery-search">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search events, places, or clubs"
          />
          <Button variant="secondary" icon="List" onClick={() => setFilters((v) => !v)}>
            {filters ? 'Hide filters' : `Filters${activeFilters ? ` (${activeFilters})` : ''}`}
          </Button>
        </div>
        {filters && (
          <div className="event-discovery-filter-panel">
            <label>
              Event type
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>All categories</option>
                {[...new Set(events.map((e) => e.category))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {publicView && (
              <label>
                Student community
                <select value={club} onChange={(e) => setClub(e.target.value)}>
                  <option value="All clubs">All clubs</option>
                  {organizations.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button
              variant="secondary"
              icon="X"
              onClick={() => {
                setCategory('All categories');
                setClub('All clubs');
                setSearch('');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </section>
      <div className="event-discovery-count">
        <span>
          {visible.length} {tab === 'Past events' ? 'past experiences' : 'plans to explore'}
        </span>
        <span>
          {tab === 'Past events'
            ? 'The memories stay. Bookings are closed.'
            : 'Member prices available on eligible events.'}
        </span>
      </div>
      <div className="event-discovery-grid">
        {(featured ? visible.slice(1) : visible).map((event, index) => {
          const phase = eventPhase(event);
          const past = phase === 'past';
          const href = publicView ? `/e/${event.clubId}/${event.id}` : `/app/events/${event.id}`;
          const capacity = Math.max(0, event.capacity - event.sold);
          const atCapacity = capacity === 0;
          const isUrgent = !past && !atCapacity && capacity < 10;
          const cat = event.category.toLowerCase();
          const categoryTone = past
            ? 'neutral'
            : phase === 'ongoing'
              ? 'green'
              : cat.includes('meeting')
                ? 'teal'
                : cat.includes('workshop')
                  ? 'gold'
                  : cat.includes('social')
                    ? 'green'
                    : cat.includes('fundraiser')
                      ? 'purple'
                      : 'teal';
          return (
            <Revealed
              key={`${event.clubId}-${event.id}`}
              delay={Math.min(250, index * 55)}
              pop
              as="article"
              className={`event-discovery-card ${past ? 'past-event' : ''}`}
            >
              <Link className="event-discovery-photo" to={href} aria-label={`View ${event.title}`}>
                <img src={event.image} alt={event.title} loading="lazy" />
                <div className="event-discovery-photo-top">
                  <div className="event-discovery-badges">
                    <Badge tone={categoryTone}>
                      {past
                        ? 'PAST EVENT'
                        : phase === 'ongoing'
                          ? 'HAPPENING NOW'
                          : event.category.toUpperCase()}
                    </Badge>
                    {isUrgent && <span className="event-urgency-pill">Few spots left</span>}
                  </div>
                  <span className="event-discovery-date">
                    <strong>{new Date(`${event.date}T12:00:00`).getDate()}</strong>
                    <small>{date(event.date, { month: 'short' }).toUpperCase()}</small>
                  </span>
                </div>
                {past && (
                  <span className="event-discovery-photo-bottom">
                    <Icon name="Heart" size={14} />A moment we made together
                  </span>
                )}
              </Link>
              <div className="event-discovery-card-body">
                <span className="event-discovery-club">{event.clubName}</span>
                <h2>
                  <Link to={href}>{event.title}</Link>
                </h2>
                <div className="event-discovery-facts">
                  <span>
                    <Icon name="CalendarDays" size={15} />
                    {date(event.date, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                    {event.time}
                  </span>
                  <span>
                    <Icon name="MapPin" size={15} />
                    {event.venue}
                  </span>
                </div>
                <p>{event.description}</p>
                <div className="event-discovery-footer">
                  <div>
                    {past ? (
                      <>
                        <strong>Bookings closed</strong>
                        <small>Explore the event story</small>
                      </>
                    ) : (
                      <>
                        <strong>{event.price ? money(event.price) : 'Free entry'}</strong>
                        <small>
                          {event.price
                            ? `Members ${money(event.memberPrice)}`
                            : 'Everyone is welcome'}{' '}
                          · {atCapacity ? 'Full' : `${capacity} spots left`}
                        </small>
                      </>
                    )}
                  </div>
                  <Link className="button secondary" to={href}>
                    {past ? 'View memories' : atCapacity ? 'View waitlist' : 'Explore event'}
                    <Icon name="ArrowUpRight" size={15} />
                  </Link>
                </div>
              </div>
            </Revealed>
          );
        })}
      </div>
      {!visible.length && (
        <Empty
          title={
            tab === 'Past events'
              ? 'The story is just getting started'
              : 'A little room for new plans'
          }
          description="No events match this view. Try another category or clear your search."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setCategory('All categories');
                setClub('All clubs');
                setTab('All events');
              }}
            >
              Explore all events
            </Button>
          }
        />
      )}
      <div className="event-discovery-bottom-note">
        <Icon name={tab === 'Past events' ? 'HeartHandshake' : 'QrCode'} size={26} />
        <div>
          <strong>
            {tab === 'Past events'
              ? 'Good moments become a shared story.'
              : 'Your next good memory starts with one ticket.'}
          </strong>
          <p>
            {tab === 'Past events'
              ? 'Revisit past event details and any recap shared by the organizing team.'
              : 'Book online, keep your QR ticket, and spend less time in the queue.'}
          </p>
        </div>
      </div>
    </main>
  );
  return publicView ? (
    <div className="event-discovery-public">
      <PublicNav />
      {content}
      <footer>
        <Logo />
        <span>Find your people. Make your moments.</span>
        <Link to="/">Back to Skyline →</Link>
      </footer>
    </div>
  ) : (
    content
  );
}
