import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { Field } from '../../../shared/ui/Field';
import { FormFooter } from '../../../shared/ui/FormFooter';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { Modal } from '../../../shared/ui/Modal';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Progress } from '../../../shared/ui/Progress';
import { SearchField } from '../../../shared/ui/SearchField';
import { TablePager } from '../../../shared/ui/TablePager';
import { formValues } from '../../../shared/ui/formValues';
import { date, money, today, uid } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import { useServerTable } from '../../../shared/hooks/useServerTable';
import { eventEnd, eventStart } from '../utils/event-time';
import '../../finance/styles/finance.css';
import type { ClubEvent } from '../../../shared/types/domain';

export function EventsPage() {
  const { data, update, toast } = useStore();
  const { can, clubId } = useSession();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(params.get('create') === 'true'),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState('All events'),
    [view, setView] = useState('grid'),
    [sort, setSort] = useState('date');
  const close = useCallback(() => {
    setAdding(false);
    setParams({}, { replace: true });
  }, [setParams]);
  const events = data.events
    .filter(
      (e) =>
        e.title.toLowerCase().includes(search.toLowerCase()) &&
        (category === 'All events' || e.category === category),
    )
    .sort((a, b) =>
      sort === 'date' ? a.date.localeCompare(b.date) : a.title.localeCompare(b.title),
    );
  const eventsTable = useServerTable<ClubEvent>({
    clubId,
    table: 'events',
    localRows: events,
    query: search,
    category: category === 'All events' ? '' : category,
    limit: 5,
  });
  return (
    <>
      <PageHeader
        eyebrow="GOOD COMPANY. GREAT PLANS."
        title="Moments worth showing up for"
        description="A calendar full of reasons to come together."
        action={
          <>
            <LinkButton to="/app/calendar" variant="secondary" icon="CalendarRange">
              Open calendar
            </LinkButton>
            {can('manage_events') && (
              <Button icon="Plus" onClick={() => setAdding(true)}>
                Create event
              </Button>
            )}
          </>
        }
      />
      <div className="events-toolbar">
        <div className="filter-tabs">
          {['All events', 'Social', 'Fundraiser', 'Meeting', 'Workshop'].map((c) => (
            <button
              key={c}
              className={category === c ? 'active' : ''}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="table-tools">
          <SearchField value={search} onChange={setSearch} placeholder="Find an event..." />
          <select aria-label="Sort events" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="date">Soonest first</option>
            <option value="name">By name</option>
          </select>
          <div className="view-toggle">
            <button
              className={view === 'grid' ? 'selected' : ''}
              aria-label="Grid view"
              onClick={() => setView('grid')}
            >
              <Icon name="LayoutGrid" size={18} />
            </button>
            <button
              className={view === 'list' ? 'selected' : ''}
              aria-label="List view"
              onClick={() => setView('list')}
            >
              <Icon name="List" size={18} />
            </button>
          </div>
        </div>
      </div>
      {view === 'grid' ? (
        <div className="event-grid">
          {events.map((e) => (
            <article className="event-card" key={e.id}>
              <Link to={`/app/events/${e.id}`} className="event-image">
                <img src={e.image} alt={`${e.category} event at Skyline`} loading="lazy" />
                <div className="event-image-top">
                  <Badge
                    tone={
                      e.category === 'Social'
                        ? 'purple'
                        : e.category === 'Fundraiser'
                          ? 'green'
                          : 'teal'
                    }
                  >
                    {e.category}
                  </Badge>
                  <span className="event-date-stamp">
                    <strong>{new Date(e.date + 'T12:00:00').getDate()}</strong>
                    <small>{date(e.date, { month: 'short' }).toUpperCase()}</small>
                  </span>
                </div>
              </Link>
              <div className="event-card-content">
                <div className="event-time">
                  <Icon name="Clock3" size={14} />
                  {date(e.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {e.time}
                </div>
                <h2>
                  <Link to={`/app/events/${e.id}`}>{e.title}</Link>
                </h2>
                <p>
                  <Icon name="MapPin" size={15} />
                  {e.venue}
                </p>
                <div className="event-availability">
                  <span>{e.capacity - e.sold} spots left</span>
                  <span>
                    {e.sold}/{e.capacity}
                  </span>
                </div>
                <Progress value={(e.sold / e.capacity) * 100} tone="purple" />
                <div className="event-card-footer">
                  <span>
                    {e.memberPrice ? (
                      <>
                        <strong>{money(e.memberPrice)}</strong>
                        <small>for members</small>
                      </>
                    ) : (
                      <strong>Everyone’s welcome · Free</strong>
                    )}
                  </span>
                  <Link to={`/app/events/${e.id}`} className="button secondary">
                    View event
                    <Icon name="ArrowUpRight" size={16} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="card table-card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date & time</th>
                  <th>Category</th>
                  <th>Reservations</th>
                  <th>Member price</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {eventsTable.rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.title}</strong>
                      <small className="cell-subtext">{e.venue}</small>
                    </td>
                    <td>
                      {date(e.date)} · {e.time}
                    </td>
                    <td>
                      <Badge tone="purple">{e.category}</Badge>
                    </td>
                    <td>
                      {e.sold} / {e.capacity}
                    </td>
                    <td>{e.memberPrice ? money(e.memberPrice) : 'Free'}</td>
                    <td>
                      <Link
                        to={`/app/events/${e.id}`}
                        className="plain-icon"
                        aria-label={`View ${e.title}`}
                      >
                        <Icon name="ArrowUpRight" size={19} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager
            page={eventsTable.page}
            pages={eventsTable.pages}
            total={eventsTable.total}
            limit={eventsTable.limit}
            label="events"
            loading={eventsTable.loading}
            onPageChange={eventsTable.setPage}
          />
        </section>
      )}
      {!events.length && (
        <Empty
          title="A little space for new plans"
          description="No events match your filters. Try another search."
        />
      )}
      <div className="info-banner">
        <Icon name="Ticket" size={25} />
        <div>
          <strong>More community, less queue.</strong>
          <p>
            Every booking comes with a unique QR ticket. Your team can scan it or check in by name
            at the door.
          </p>
        </div>
        {can('check_in') && (
          <LinkButton to="/app/check-in" variant="secondary" icon="ScanLine">
            Ticket check-in
          </LinkButton>
        )}
      </div>
      {adding && can('manage_events') && (
        <Modal
          title="Make something happen"
          description="Give your community a reason to come together."
          onClose={close}
          wide
        >
          <form
            onSubmit={(e) => {
              const f = formValues(e);
              if (!can('manage_events')) return;
              if (Number(f.memberPrice) > Number(f.price)) {
                toast('Member price should not exceed the standard price.');
                return;
              }
              const event: ClubEvent = {
                id: uid('EVT'),
                title: f.title.trim(),
                date: f.date,
                time: f.time,
                endTime: f.endTime,
                endDate: f.endDate || f.date,
                venue: f.venue.trim(),
                category: f.category,
                price: Number(f.price),
                memberPrice: Number(f.memberPrice),
                capacity: Number(f.capacity),
                sold: 0,
                budget: Number(f.budget),
                description: f.description.trim(),
                image:
                  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=85',
              };
              if (eventEnd(event).getTime() <= eventStart(event).getTime()) {
                toast('The event must end after it starts. Choose a later time or end date.');
                return;
              }
              update((d) => ({ ...d, events: [...d.events, event] }));
              close();
              toast('Your new event is ready to bring people together.');
            }}
          >
            <Field label="Event name">
              <input name="title" required placeholder="Give your plan a name" maxLength={100} />
            </Field>
            <div className="form-two">
              <Field label="Date">
                <input type="date" name="date" min={today} defaultValue="2026-10-24" required />
              </Field>
              <Field label="Start time">
                <input type="time" name="time" defaultValue="18:00" required />
              </Field>
            </div>
            <div className="form-two">
              <Field label="End time">
                <input type="time" name="endTime" defaultValue="20:00" required />
              </Field>
              <Field
                label="End date (optional)"
                hint="Leave blank for the same day. Choose a later date for a multi-day event."
              >
                <input type="date" name="endDate" min={today} />
              </Field>
            </div>
            <Field label="Where are we meeting?">
              <input name="venue" required placeholder="Venue or campus location" />
            </Field>
            <Field label="A little about the event">
              <textarea
                name="description"
                rows={3}
                required
                placeholder="What should people look forward to?"
              />
            </Field>
            <div className="form-two">
              <Field label="Category">
                <select name="category">
                  <option>Social</option>
                  <option>Fundraiser</option>
                  <option>Meeting</option>
                  <option>Workshop</option>
                </select>
              </Field>
              <Field label="Capacity">
                <input
                  name="capacity"
                  type="number"
                  min="1"
                  max="10000"
                  required
                  defaultValue="100"
                />
              </Field>
            </div>
            <div className="form-two">
              <Field label="Standard price (₹)">
                <input name="price" type="number" min="0" required defaultValue="500" />
              </Field>
              <Field label="Member price (₹)">
                <input name="memberPrice" type="number" min="0" required defaultValue="350" />
              </Field>
            </div>
            <Field label="Expense budget (INR)">
              <input name="budget" type="number" min="0" defaultValue="0" required />
            </Field>
            <FormFooter onClose={close} label="Create event" />
          </form>
        </Modal>
      )}
    </>
  );
}
