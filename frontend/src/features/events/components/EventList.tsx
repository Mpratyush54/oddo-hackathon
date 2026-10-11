import { Link } from 'react-router-dom';
import { Empty } from '../../../shared/ui/Empty';
import { EventPhoto } from '../../../shared/ui/EventPhoto';
import { Icon } from '../../../shared/ui/Icon';
import { date, today } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';

export function EventList({ limit = 3 }: { limit?: number }) {
  const { data } = useStore();
  const events = [...data.events]
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
  return (
    <div className="portal-event-list">
      {events.map((e) => (
        <Link to={`/app/events/${e.id}`} className="portal-event" key={e.id}>
          <EventPhoto image={e.image} seed={e.id} alt="" />
          <div>
            <small>
              {date(e.date, { day: 'numeric', month: 'short' })} · {e.time}
            </small>
            <h3>{e.title}</h3>
            <p>
              <Icon name="MapPin" size={13} /> {e.venue}
            </p>
          </div>
          <Icon name="ChevronRight" size={18} />
        </Link>
      ))}
      {!events.length && (
        <Empty title="A new calendar awaits" description="Upcoming events will appear here." />
      )}
    </div>
  );
}
