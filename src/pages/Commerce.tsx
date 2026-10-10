import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  Avatar,
  Badge,
  Button,
  CardHeader,
  Empty,
  Field,
  FormFooter,
  Icon,
  LinkButton,
  Modal,
  PageHeader,
  ProductArt,
  Progress,
  SearchField,
  StatCard,
  formValues,
} from '../components';
import { date, exportCSV, money, today, uid, useStore } from '../store';
import { useSession } from '../session';
import { eventEnd, eventPhase, eventStart } from '../event-utils';
import '../commerce-finance.css';
import type { Store, ClubEvent, Ticket } from '../store';

export function EventsPage() {
  const { data, update, toast } = useStore();
  const { can } = useSession();
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
                {events.map((e) => (
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
              if (eventEnd(event).getTime() <= eventStart(event).getTime()) { toast('The event must end after it starts. Choose a later time or end date.'); return; }
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
              <Field label="End time"><input type="time" name="endTime" defaultValue="20:00" required/></Field>
              <Field label="End date (optional)" hint="Leave blank for the same day. Choose a later date for a multi-day event."><input type="date" name="endDate" min={today}/></Field>
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

export function cancelEventTicket(current: Store, ticketId: string, actor: string): Store {
  const ticket = current.tickets.find((t) => t.id === ticketId);
  if (!ticket || ticket.checkedIn || ticket.status === 'Cancelled') return current;
  const first = current.waitlist
    .filter((w) => w.eventId === ticket.eventId && w.status === 'Waiting')
    .sort((a, b) => a.joined.localeCompare(b.joined))[0];
  return {
    ...current,
    tickets: current.tickets.map((t) => (t.id === ticketId ? { ...t, status: 'Cancelled' } : t)),
    events: current.events.map((e) =>
      e.id === ticket.eventId ? { ...e, sold: Math.max(0, e.sold - (first ? 0 : 1)) } : e,
    ),
    waitlist: current.waitlist.map((w) => (w.id === first?.id ? { ...w, status: 'Promoted' } : w)),
    notifications: first
      ? [
          {
            id: uid('NTF'),
            title: 'A seat opened up',
            body: `${first.name}, your waitlist offer is reserved. Complete demo checkout to confirm it.`,
            date: new Date().toISOString(),
            read: false,
            to: first.email,
          },
          ...current.notifications,
        ]
      : current.notifications,
    transactions:
      ticket.amount > 0
        ? [
            {
              id: uid('TX'),
              title: `Demo cancellation credit · ${ticket.id}`,
              category: 'Tickets',
              amount: -ticket.amount,
              date: today,
              status: 'Completed',
              eventId: ticket.eventId,
              createdBy: actor,
            },
            ...current.transactions,
          ]
        : current.transactions,
  };
}

function eventCalendar(event: ClubEvent) {
  const esc = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const start = eventStart(event);
  const end = eventEnd(event);
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Skyline//Campus Events//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@skyline`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(event.title)}`,
    `LOCATION:${esc(event.venue)}`,
    `DESCRIPTION:${esc(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EventDetail() {
  const { id } = useParams();
  const { data, update, toast } = useStore();
  const { can, user, clubId } = useSession();
  const [tab, setTab] = useState('Overview'),
    [attendeeSearch, setAttendeeSearch] = useState('');
  const event = data.events.find((e) => e.id === id);
  if (!event)
    return (
      <Empty
        title="That event is not on our calendar"
        action={<LinkButton to="/app/events">Back to events</LinkButton>}
      />
    );
  const staff = can('check_in');
  const tickets = data.tickets.filter((t) => t.eventId === event.id && t.status !== 'Cancelled');
  const checked = tickets.filter((t) => t.checkedIn).length;
  const rows = data.transactions.filter((t) => t.eventId === event.id);
  const completed = rows.filter((t) => t.status === 'Completed');
  const income = completed
    .filter((t) => t.category !== 'Expenses')
    .reduce((n, t) => n + t.amount, 0);
  const spend = -completed
    .filter((t) => t.category === 'Expenses' && t.amount < 0)
    .reduce((n, t) => n + t.amount, 0);
  const commitments = -rows
    .filter((t) => t.status === 'Pending' && t.amount < 0)
    .reduce((n, t) => n + t.amount, 0);
  const queued = data.waitlist.find(
    (w) =>
      w.eventId === event.id &&
      w.email.toLowerCase() === user.email.toLowerCase() &&
      w.status !== 'Booked',
  );
  const past = eventPhase(event) === 'past';
  const full = event.sold >= event.capacity;
  const offer = queued?.status === 'Promoted';
  const joinWaitlist = () => {
    if (eventPhase(event) === 'past') { toast('This event has ended. Reservations and the waitlist are closed.'); return; }
    if (
      data.tickets.some(
        (t) =>
          t.eventId === event.id &&
          t.email.toLowerCase() === user.email.toLowerCase() &&
          t.status !== 'Cancelled',
      )
    ) {
      toast('You already have a ticket for this event. Open My tickets.');
      return;
    }
    update((d) =>
      d.waitlist.some(
        (w) =>
          w.eventId === event.id &&
          w.email.toLowerCase() === user.email.toLowerCase() &&
          w.status !== 'Booked',
      ) ||
      d.tickets.some(
        (t) =>
          t.eventId === event.id &&
          t.email.toLowerCase() === user.email.toLowerCase() &&
          t.status !== 'Cancelled',
      )
        ? d
        : {
            ...d,
            waitlist: [
              ...d.waitlist,
              {
                id: uid('WAIT'),
                eventId: event.id,
                name: user.name,
                email: user.email,
                joined: new Date().toISOString(),
                status: 'Waiting',
              },
            ],
          },
    );
    toast('You are on the waitlist. Seat offers appear in your in-app inbox.');
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/e/${clubId}/${event.id}`);
      toast('Public event link copied.');
    } catch {
      toast('Copy this event URL from your browser to share it.');
    }
  };
  const ticketAction =
    past ? <Button disabled>Event ended · bookings closed</Button> : !full || offer ? (
      <LinkButton to={`/app/checkout?event=${event.id}`} icon="Ticket">
        {offer ? 'Claim your seat offer' : event.price ? 'Get your ticket' : 'Reserve a spot'}
      </LinkButton>
    ) : (
      <Button icon="ListPlus" disabled={!!queued} onClick={joinWaitlist}>
        {queued ? 'On the waitlist' : 'Join waitlist'}
      </Button>
    );
  return (
    <>
      <div className="breadcrumb">
        <Link to="/app/events">Events</Link>
        <Icon name="ChevronRight" size={14} />
        <span>{event.title}</span>
      </div>
      <PageHeader
        title={event.title}
        description="One plan. Every detail connected."
        action={
          <>
            <Button variant="secondary" icon="CalendarPlus" onClick={() => eventCalendar(event)}>
              Add to calendar
            </Button>
            <Button variant="secondary" icon="Globe" onClick={share}>
              Share event
            </Button>
            {staff && (
              <LinkButton
                to={`/app/check-in?event=${event.id}`}
                icon="ScanLine"
                variant="secondary"
              >
                Check in guests
              </LinkButton>
            )}
            {ticketAction}
          </>
        }
      />
      <section className="event-detail-hero">
        <img src={event.image} alt={event.title} />
        <div className="event-detail-overlay">
          <Badge tone="purple">{event.category}</Badge>
          <h2>
            Good people.
            <br />
            Great memories.
          </h2>
          <div className="event-detail-facts">
            <span>
              <Icon name="CalendarDays" size={22} />
              <span>
                <small>Save the date</small>
                <strong>
                  {date(event.date)} · {event.time}
                </strong>
              </span>
            </span>
            <span>
              <Icon name="MapPin" size={22} />
              <span>
                <small>Meet us here</small>
                <strong>{event.venue}</strong>
              </span>
            </span>
          </div>
        </div>
      </section>
      <div className="filter-tabs detail-tabs">
        {[
          'Overview',
          ...(staff ? ['Attendees', 'Ticket report'] : []),
          ...(can('view_finance') ? ['Event finances'] : []),
        ].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="event-detail-layout">
        <div>
          {tab === 'Overview' ? (
            <>
              <section className="card detail-description">
                <CardHeader title="Here is the plan" />
                <p>{event.description}</p>
                <h3>Good to know</h3>
                <ul>
                  <li>Use your unique QR ticket at the door.</li>
                  <li>Active members receive the member price at checkout.</li>
                  <li>
                    Cancel an unused ticket from My tickets to offer the spot to someone waiting.
                  </li>
                </ul>
              </section>
              {queued && (
                <div className="info-banner">
                  <Icon name="Bell" />
                  <div>
                    <strong>
                      {offer ? 'Your seat offer is ready' : 'You are on the waitlist'}
                    </strong>
                    <p>
                      {offer
                        ? 'Your spot is reserved until you complete demo checkout. No payment has been taken.'
                        : 'We will add a seat offer to your in-app inbox when a reservation is cancelled.'}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : tab === 'Attendees' && staff ? (
            <section className="card table-card">
              <div className="table-toolbar">
                <h2>Guest list</h2>
                <SearchField
                  value={attendeeSearch}
                  onChange={setAttendeeSearch}
                  placeholder="Find an attendee..."
                />
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Ticket</th>
                      <th>Check-in</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {tickets
                      .filter((t) =>
                        `${t.name} ${t.email} ${t.id}`
                          .toLowerCase()
                          .includes(attendeeSearch.toLowerCase()),
                      )
                      .map((t, i) => (
                        <tr key={t.id}>
                          <td>
                            <div className="member-cell">
                              <Avatar name={t.name} index={i} />
                              <span>
                                <strong>{t.name}</strong>
                                <small>{t.email}</small>
                              </span>
                            </div>
                          </td>
                          <td>{t.id}</td>
                          <td>
                            <Badge tone={t.checkedIn ? 'green' : 'gold'}>
                              {t.checkedIn ? 'Checked in' : 'Expected'}
                            </Badge>
                          </td>
                          <td>
                            {!t.checkedIn && (
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  update((d) => cancelEventTicket(d, t.id, user.id));
                                  toast(
                                    'Ticket cancelled. Any waiting student has received an in-app seat offer.',
                                  );
                                }}
                              >
                                Cancel ticket
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!tickets.length && <Empty title="No reservations yet" />}
            </section>
          ) : tab === 'Event finances' && can('view_finance') ? (
            <section className="card detail-description">
              <CardHeader
                title="Event budget & actual"
                subtitle="Linked ledger entries. Completed entries count toward actuals."
              />
              <div className="event-finance-grid">
                <StatCard icon="Wallet" label="Income after credits" value={money(income)} />
                <StatCard icon="Receipt" label="Actual expenses" value={money(spend)} tone="gold" />
                <StatCard
                  icon="TrendingUp"
                  label="Net result"
                  value={money(income - spend)}
                  tone="green"
                />
                <StatCard
                  icon="Flag"
                  label="Expense budget"
                  value={money(event.budget || 0)}
                  tone="purple"
                />
              </div>
              <div className="budget-status">
                <span>
                  Budget remaining after actuals{' '}
                  <strong>{money((event.budget || 0) - spend)}</strong>
                </span>
                <span>
                  Pending commitments <strong>{money(commitments)}</strong>
                </span>
              </div>
              <Progress
                value={(spend / Math.max(event.budget || 0, 1)) * 100}
                tone={spend > (event.budget || 0) ? 'gold' : 'teal'}
              />
              <div className="event-ledger-list">
                {rows.map((t) => (
                  <div key={t.id}>
                    <span>
                      <strong>{t.title}</strong>
                      <small>{date(t.date)}</small>
                    </span>
                    <Badge
                      tone={
                        t.status === 'Completed'
                          ? 'green'
                          : t.status === 'Rejected'
                            ? 'neutral'
                            : 'gold'
                      }
                    >
                      {t.status}
                    </Badge>
                    <strong>{money(t.amount)}</strong>
                  </div>
                ))}
              </div>
              {!rows.length && (
                <Empty
                  title="Connect the first transaction"
                  description="Choose this event when recording income or requesting a reimbursement."
                />
              )}
              <LinkButton to="/app/finance" variant="secondary">
                Open full ledger
              </LinkButton>
            </section>
          ) : staff ? (
            <section className="card detail-description">
              <CardHeader title="Ticket report" />
              <div className="report-stats">
                <StatCard
                  icon="Ticket"
                  label="Reservations"
                  value={`${event.sold}/${event.capacity}`}
                />
                <StatCard
                  icon="UserCheck"
                  label="Checked in"
                  value={`${checked}/${tickets.length}`}
                  tone="green"
                />
                <StatCard
                  icon="Wallet"
                  label="Stored ticket revenue"
                  value={money(tickets.reduce((n, t) => n + t.amount, 0))}
                  tone="purple"
                />
              </div>
              <p className="form-note">
                Historical reservations are included in totals. This report covers stored individual
                demo tickets.
              </p>
              <Button
                variant="secondary"
                icon="Download"
                onClick={() =>
                  exportCSV(`${event.id}-attendees.csv`, [
                    ['Ticket', 'Name', 'Email', 'Member', 'Checked in', 'Amount'],
                    ...tickets.map((t) => [t.id, t.name, t.email, t.member, t.checkedIn, t.amount]),
                  ])
                }
              >
                Export report
              </Button>
            </section>
          ) : null}
        </div>
        <aside className="card ticket-options">
          <CardHeader
            title={full ? 'A popular plan' : 'Your seat is waiting'}
            subtitle={`${Math.max(0, event.capacity - event.sold)} spots available`}
          />
          <div className="ticket-price-option">
            <span>
              <Icon name="BadgeCheck" size={19} />
              Skyline member<small>Membership verified at checkout</small>
            </span>
            <strong>{event.memberPrice ? money(event.memberPrice) : 'Free'}</strong>
          </div>
          <div className="ticket-price-option">
            <span>
              <Icon name="UserRound" size={19} />
              Standard ticket
            </span>
            <strong>{event.price ? money(event.price) : 'Free'}</strong>
          </div>
          <Progress value={(event.sold / event.capacity) * 100} tone="purple" />
          {ticketAction}
          <p className="ticket-helper">
            <Icon name="ShieldCheck" size={14} />
            Demo checkout. No real charges.
          </p>
        </aside>
      </div>
    </>
  );
}

export function ShopPage() {
  const { data, toast } = useStore();
  const { can, user } = useSession();
  const visibleOrders = data.orders.filter((o) => can('manage_orders') || o.name === user.name);
  const [sizes, setSizes] = useState<Record<string, string>>({}),
    [tab, setTab] = useState('Shop');
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE PIECE OF YOUR COMMUNITY"
        title="Wear your Skyline"
        description="Thoughtfully made. Proudly worn. Something to take the memories with you."
        action={
          <Button
            variant="secondary"
            icon={tab === 'Shop' ? 'Package' : 'ShoppingBag'}
            onClick={() => setTab(tab === 'Shop' ? 'Orders' : 'Shop')}
          >
            {tab === 'Shop' ? `View orders (${visibleOrders.length})` : 'Back to shop'}
          </Button>
        }
      />
      {tab === 'Shop' ? (
        <>
          <section className="shop-banner dark-card">
            <div>
              <div className="hero-eyebrow">THE CAMPUS COLLECTION · 2026</div>
              <h2>Belonging looks good on you.</h2>
              <p>Every purchase supports our next great community moment.</p>
              <span>
                <Icon name="BadgeCheck" size={17} />A little member discount, on every piece.
              </span>
            </div>
            <div className="shop-banner-art">
              <Icon name="Shirt" size={100} />
              <span>skyline.</span>
            </div>
          </section>
          <div className="product-grid">
            {data.products.map((p) => {
              const size = sizes[p.id];
              const remaining = Object.values(p.stock).reduce((s, n) => s + n, 0);
              return (
                <article className="product-card" key={p.id}>
                  <ProductArt type={p.type} color={p.color} />
                  <div className="product-card-content">
                    <div className="product-tag">
                      <span>{p.type}</span>
                      <Badge tone={remaining < 10 ? 'gold' : 'green'}>{remaining} in stock</Badge>
                    </div>
                    <h2>{p.name}</h2>
                    <div className="product-price">
                      <strong>{money(p.memberPrice)}</strong>
                      <span>member price</span>
                      <del>{money(p.price)}</del>
                    </div>
                    <div className="size-heading">
                      {p.type === 'Tote bag' ? 'A fit for everything' : 'Find your fit'}
                      {size && (
                        <span>
                          {p.stock[size]} left in {size}
                        </span>
                      )}
                    </div>
                    <div className="size-chips">
                      {Object.entries(p.stock).map(([s, count]) => (
                        <button
                          key={s}
                          className={size === s ? 'selected' : ''}
                          aria-pressed={size === s}
                          disabled={!count}
                          aria-label={`Size ${s}${count ? '' : ', sold out'}`}
                          onClick={() => setSizes({ ...sizes, [p.id]: s })}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {size ? (
                      <LinkButton
                        to={`/app/checkout?product=${p.id}&size=${encodeURIComponent(size)}`}
                        icon="ShoppingBag"
                      >
                        Make it yours
                      </LinkButton>
                    ) : (
                      <Button
                        variant="secondary"
                        className="full-width"
                        icon="ShoppingBag"
                        onClick={() => toast('Pick your size above to continue to checkout.')}
                      >
                        Select your size
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="shop-benefits">
            {[
              ['Leaf', 'A little lighter on the planet', 'Thoughtful fabrics. Reusable packaging.'],
              ['MapPin', 'Easy campus pickup', 'Collect from the Student Union office.'],
              ['Heart', 'Every order gives back', 'Supporting events for your community.'],
            ].map(([icon, title, text]) => (
              <div key={title}>
                <Icon name={icon} size={23} />
                <span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <section className="card table-card">
          <div className="table-toolbar">
            <h2>Your store orders</h2>
            <Button
              variant="secondary"
              icon="Download"
              onClick={() =>
                exportCSV('skyline-orders.csv', [
                  ['Order', 'Name', 'Product', 'Size', 'Amount', 'Date'],
                  ...visibleOrders.map((o) => [
                    o.id,
                    o.name,
                    data.products.find((p) => p.id === o.productId)?.name || '',
                    o.size,
                    o.amount,
                    o.date,
                  ]),
                ])
              }
            >
              Export orders
            </Button>
          </div>
          {visibleOrders.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Size</th>
                    <th className="numeric">Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.id}</td>
                      <td>{o.name}</td>
                      <td>{data.products.find((p) => p.id === o.productId)?.name}</td>
                      <td>{o.size}</td>
                      <td className="numeric">{money(o.amount)}</td>
                      <td>
                        <Badge tone="green">Ready for pickup</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Good things are in store"
              description="Orders appear here as soon as someone checks out."
              action={
                <Button icon="ShoppingBag" onClick={() => setTab('Shop')}>
                  Explore the collection
                </Button>
              }
            />
          )}
        </section>
      )}
    </>
  );
}

export function CheckoutPage() {
  const [params] = useSearchParams();
  const { data, update, toast } = useStore();
  const { user, can } = useSession();
  const [email, setEmail] = useState(user.email),
    [result, setResult] = useState<{
      id: string;
      amount: number;
      name: string;
      ticket: boolean;
    } | null>(null),
    [qr, setQr] = useState('');
  const event = data.events.find((e) => e.id === params.get('event'));
  const product = data.products.find((p) => p.id === params.get('product'));
  const size = params.get('size') || '';
  const member = data.members.find(
    (m) =>
      email.trim().toLowerCase() === user.email.toLowerCase() &&
      m.email.toLowerCase() === user.email.toLowerCase() &&
      m.status !== 'Pending' &&
      m.status !== 'Expired' &&
      m.expires >= today,
  );
  const item = event || product;
  const regular = item?.price || 0;
  const amount = member ? item?.memberPrice || 0 : regular;
  useEffect(() => {
    if (result?.ticket)
      QRCode.toDataURL(result.id, {
        width: 240,
        margin: 2,
        color: { dark: '#0f6b66', light: '#ffffff' },
      }).then(setQr);
  }, [result]);
  const receipt = () => {
    if (!result) return;
    exportCSV(`${result.id}-receipt.csv`, [
      ['Skyline receipt', result.id],
      ['Customer', result.name],
      ['Item', event?.title || product?.name || ''],
      ['Amount (INR)', result.amount],
      ['Payment', 'Demo payment — no money charged'],
      ['Date', today],
      ...(result.ticket ? [['Ticket ID', result.id]] : [['Size', size]]),
    ]);
  };
  if (event && eventPhase(event) === 'past' && !result) return <Empty title="This event has already ended" description="Reservations are closed. View the event recap or find your next campus plan." action={<LinkButton to={`/app/events/${event.id}`}>View event recap</LinkButton>}/>;
  if ((event && !can('book_ticket')) || (product && !can('shop')))
    return (
      <Empty
        title="Your role cannot use this checkout"
        description="Switch to a student or club team demo persona to book or order."
      />
    );
  if (!item)
    return (
      <Empty
        title="Let’s find something for you"
        description="Choose an event ticket or a little piece of Skyline first."
        action={
          <LinkButton to="/app/events" icon="Ticket">
            Explore events
          </LinkButton>
        }
      />
    );
  if (result)
    return (
      <div className="checkout-success card">
        <span className="success-icon">
          <Icon name="Check" size={35} />
        </span>
        <div className="eyebrow">ONE MORE GOOD THING TO LOOK FORWARD TO</div>
        <h1>{result.ticket ? 'You’re on the list!' : 'A little Skyline, coming your way.'}</h1>
        <p>
          {result.ticket
            ? `Your spot at ${event?.title} is reserved. See you there!`
            : 'Your order is ready for pickup at the Student Union office.'}
        </p>
        {qr && <img src={qr} alt={`QR ticket for ${result.id}`} className="ticket-qr" />}
        <div className="success-order">
          <span>{result.ticket ? 'Ticket' : 'Order'} reference</span>
          <strong>{result.id}</strong>
          <span>
            {result.name} · {money(result.amount)}
          </span>
        </div>
        <div className="success-actions">
          <Button icon="Download" variant="secondary" onClick={receipt}>
            Download receipt
          </Button>
          {qr && (
            <a href={qr} download={`${result.id}-ticket.png`} className="button secondary">
              <Icon name="QrCode" size={17} />
              Save QR ticket
            </a>
          )}
          <LinkButton to="/app" icon="ArrowRight">
            Back to overview
          </LinkButton>
        </div>
        <p className="form-note">Demo checkout completed. No real money was charged.</p>
      </div>
    );
  const offered =
    !!event &&
    data.waitlist.some(
      (w) =>
        w.eventId === event.id &&
        w.email.toLowerCase() === email.trim().toLowerCase() &&
        w.status === 'Promoted',
    );
  const soldOut = !!event && event.sold >= event.capacity && !offered;
  const unavailable = !!product && (!size || !product.stock[size]);
  return (
    <>
      <div className="breadcrumb">
        <Link to={event ? `/app/events/${event.id}` : '/app/merchandise'}>
          {event ? 'Your event' : 'The collection'}
        </Link>
        <Icon name="ChevronRight" size={14} />
        <span>Checkout</span>
      </div>
      <PageHeader
        title={event ? 'Save your spot.' : 'Make it yours.'}
        description="Just a few details, and you’re all set."
      />
      <div className="checkout-steps">
        <span className="completed">
          <Icon name="Check" size={15} />
          Your selection
        </span>
        <i />
        <span className="current">
          2<span>Details & payment</span>
        </span>
        <i />
        <span>
          3<span>All set</span>
        </span>
      </div>
      <div className="checkout-layout">
        <section className="dark-card checkout-summary">
          <div className="hero-eyebrow">SOMETHING TO LOOK FORWARD TO</div>
          <h2>{event?.title || product?.name}</h2>
          {event ? (
            <>
              <p>
                <Icon name="CalendarDays" size={17} />
                {date(event.date)} · {event.time}
              </p>
              <p>
                <Icon name="MapPin" size={17} />
                {event.venue}
              </p>
            </>
          ) : (
            <>
              <ProductArt type={product!.type} color={product!.color} />
              <p>Size: {size || 'Choose a size in the shop'} · Campus pickup</p>
            </>
          )}
          <dl className="checkout-totals">
            <div>
              <dt>{event ? 'Standard ticket' : 'Regular price'}</dt>
              <dd>{money(regular)}</dd>
            </div>
            {member && regular > amount && (
              <div className="discount-row">
                <dt>
                  Member discount <Icon name="BadgeCheck" size={14} />
                </dt>
                <dd>−{money(regular - amount)}</dd>
              </div>
            )}
            <div>
              <dt>Processing fees</dt>
              <dd>₹0</dd>
            </div>
            <div className="checkout-total">
              <dt>Total</dt>
              <dd>{money(amount)}</dd>
            </div>
          </dl>
          <span className="checkout-member-note">
            <Icon name="Heart" size={17} />
            {member
              ? 'A little thank-you for being part of Skyline.'
              : 'Members get a little extra. Use your member email.'}
          </span>
        </section>
        <section className="card checkout-form">
          <CardHeader
            title="A little about you"
            subtitle="We’ll keep your ticket or order under this name."
          />
          <form
            onSubmit={(e) => {
              const f = formValues(e);
              if ((event && eventPhase(event) === 'past') || soldOut || unavailable) {
                toast('This item is no longer available. Please choose another.');
                return;
              }
              const reference = uid(event ? 'SKY' : 'ORD');
              if (event) {
                const ticket: Ticket = {
                  id: reference,
                  eventId: event.id,
                  name: f.name.trim(),
                  email: email.trim(),
                  member: !!member,
                  checkedIn: false,
                  amount,
                  status: 'Confirmed',
                };
                update((d) => ({
                  ...d,
                  events: d.events.map((ev) =>
                    ev.id === event.id
                      ? {
                          ...ev,
                          sold:
                            ev.sold +
                            (d.waitlist.some(
                              (w) =>
                                w.eventId === event.id &&
                                w.email.toLowerCase() === email.trim().toLowerCase() &&
                                w.status === 'Promoted',
                            )
                              ? 0
                              : 1),
                        }
                      : ev,
                  ),
                  tickets: [...d.tickets, ticket],
                  waitlist: d.waitlist.map((w) =>
                    w.eventId === event.id &&
                    w.email.toLowerCase() === email.trim().toLowerCase() &&
                    w.status === 'Promoted'
                      ? { ...w, status: 'Booked' }
                      : w,
                  ),
                  transactions:
                    amount > 0
                      ? [
                          {
                            id: uid('TX'),
                            title: `${event.title} · ${ticket.name}`,
                            category: 'Tickets',
                            amount,
                            eventId: event.id,
                            createdBy: user.id,
                            date: today,
                            status: 'Completed',
                          },
                          ...d.transactions,
                        ]
                      : d.transactions,
                }));
              } else if (product) {
                update((d) => ({
                  ...d,
                  products: d.products.map((p) =>
                    p.id === product.id
                      ? { ...p, stock: { ...p.stock, [size]: p.stock[size] - 1 } }
                      : p,
                  ),
                  orders: [
                    {
                      id: reference,
                      productId: product.id,
                      name: f.name.trim(),
                      size,
                      amount,
                      date: today,
                    },
                    ...d.orders,
                  ],
                  transactions: [
                    {
                      id: uid('TX'),
                      title: `${product.name} · ${f.name.trim()}`,
                      category: 'Merchandise',
                      amount,
                      date: today,
                      status: 'Completed',
                    },
                    ...d.transactions,
                  ],
                }));
              }
              setResult({ id: reference, amount, name: f.name.trim(), ticket: !!event });
            }}
          >
            <Field label="Full name">
              <input name="name" required defaultValue={user.name} maxLength={80} />
            </Field>
            <Field
              label="Email address"
              hint={
                member
                  ? `✓ Membership verified for ${member.name}. Your discount is applied.`
                  : 'Use an active member email for your club discount.'
              }
            >
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <div className="payment-demo">
              <span className="icon-tile">
                <Icon name="CreditCard" />
              </span>
              <div>
                <strong>{amount ? 'Demo payment' : 'No payment needed'}</strong>
                <p>
                  {amount
                    ? 'Try the complete flow. No card details or real payment required.'
                    : 'This event is free. Good company is all you need.'}
                </p>
              </div>
              <Icon name="ShieldCheck" size={20} />
            </div>
            <label className="check-label">
              <input type="checkbox" required />I agree to the event / campus pickup details.
            </label>
            <Button
              type="submit"
              className="full-width"
              icon={event ? 'Ticket' : 'ShoppingBag'}
              disabled={soldOut || unavailable}
            >
              {soldOut
                ? 'All spots reserved'
                : unavailable
                  ? 'Size unavailable'
                  : amount
                    ? `Complete demo checkout · ${money(amount)}`
                    : 'Confirm my spot'}
            </Button>
            <p className="ticket-helper">
              <Icon name="LockKeyhole" size={14} />
              Demo workspace · Your data stays in this browser
            </p>
          </form>
        </section>
      </div>
    </>
  );
}

export function CheckInPage() {
  const { data, update, toast } = useStore();
  const { can, clubId } = useSession();
  const [mode, setMode] = useState('ticket');
  const [memberResult, setMemberResult] = useState<{
    valid: boolean;
    name?: string;
    reason: string;
  } | null>(null);
  const [params] = useSearchParams();
  const [eventId, setEventId] = useState(params.get('event') || data.events[0]?.id || ''),
    [query, setQuery] = useState(''),
    [result, setResult] = useState<{ type: 'valid' | 'used' | 'invalid'; ticket?: Ticket } | null>(
      null,
    ),
    [camera, setCamera] = useState(false),
    [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastCode = useRef('');
  const scanRef = useRef<(value: string) => void>(() => {});
  const scan = (value: string) => {
    if (!can('check_in')) {
      toast('Your role cannot scan or check in guests.');
      return;
    }
    if (mode === 'membership') {
      const pieces = value.trim().split(':');
      const correctClub = pieces[0] === 'SKYLINE' && pieces[1] === 'MEMBER' && pieces[2] === clubId;
      const member = correctClub ? data.members.find((m) => m.id === pieces[3]) : undefined;
      const valid =
        !!member &&
        member.status !== 'Pending' &&
        member.status !== 'Expired' &&
        member.expires >= today;
      setMemberResult({
        valid,
        name: member?.name,
        reason: !correctClub
          ? 'This card belongs to another club or is not a Skyline membership QR.'
          : !member
            ? 'Member not found.'
            : member.status === 'Pending'
              ? 'Dues are pending. Membership is not active.'
              : member.status === 'Expired' || member.expires < today
                ? 'This membership has expired.'
                : `Active until ${date(member.expires)}. No event ticket was consumed.`,
      });
      setCamera(false);
      return;
    }
    const ticket = data.tickets.find(
      (t) =>
        t.id.toLowerCase() === value.trim().toLowerCase() &&
        t.eventId === eventId &&
        t.status !== 'Cancelled',
    );
    if (!ticket) setResult({ type: 'invalid' });
    else if (ticket.checkedIn) setResult({ type: 'used', ticket });
    else {
      update((d) => ({
        ...d,
        tickets: d.tickets.map((t) => (t.id === ticket.id ? { ...t, checkedIn: true } : t)),
      }));
      setResult({ type: 'valid', ticket });
      toast(`${ticket.name} checked in. Welcome to the event!`);
    }
    setCamera(false);
  };
  scanRef.current = scan;
  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (media) => {
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = media;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = media;
        await video.play();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        timer = setInterval(() => {
          if (!ctx || !video.videoWidth || cancelled) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height);
          if (code && code.data !== lastCode.current) {
            lastCode.current = code.data;
            scanRef.current(code.data);
          }
        }, 350);
      })
      .catch(() => {
        setCameraError(
          'Camera unavailable or permission denied. You can still check in using a ticket ID or name.',
        );
        setCamera(false);
      });
    if (!navigator.mediaDevices) {
      setCameraError('Camera scanning is unavailable in this browser. Use a ticket ID below.');
      setCamera(false);
    }
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera]);
  const tickets = data.tickets.filter((t) => t.eventId === eventId && t.status !== 'Cancelled');
  const filtered = tickets.filter((t) =>
    `${t.name} ${t.id} ${t.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (!can('check_in'))
    return (
      <Empty
        title="Check-in is for your event team"
        description="Open your member card or tickets from your personal workspace."
        action={<LinkButton to="/app/my-tickets">My tickets</LinkButton>}
      />
    );
  return (
    <>
      <PageHeader
        eyebrow="A WARM WELCOME AT THE DOOR"
        title="You’re in good company"
        description="Scan a ticket, say hello, and keep the line moving."
      />
      <div className="segmented scanner-mode">
        {['ticket', 'membership'].map((m) => (
          <button
            key={m}
            className={mode === m ? 'selected' : ''}
            onClick={() => {
              setMode(m);
              setResult(null);
              setMemberResult(null);
              setQuery('');
              setCamera(false);
            }}
          >
            {m === 'ticket' ? 'Event ticket check-in' : 'Verify membership'}
          </button>
        ))}
      </div>
      <div className="checkin-layout">
        <section className="card scanner-card">
          {mode === 'ticket' && (
            <Field label="Which event are we welcoming people to?">
              <select
                value={eventId}
                onChange={(e) => {
                  setEventId(e.target.value);
                  setResult(null);
                  setQuery('');
                }}
              >
                {data.events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} · {date(e.date)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className={`scanner-view ${camera ? 'camera-active' : ''}`}>
            {camera ? (
              <video ref={videoRef} muted playsInline />
            ) : (
              <>
                <Icon name="QrCode" size={84} />
                <h3>
                  {mode === 'membership'
                    ? 'Verify their membership.'
                    : 'A little scan. A big welcome.'}
                </h3>
                <p>
                  {mode === 'membership'
                    ? 'Scan a member card to check active dues, club and expiry.'
                    : 'Point your camera at a guest’s Skyline QR ticket.'}
                </p>
              </>
            )}
            <span className="scanner-corner top-left" />
            <span className="scanner-corner top-right" />
            <span className="scanner-corner bottom-left" />
            <span className="scanner-corner bottom-right" />
          </div>
          <Button
            icon={camera ? 'CameraOff' : 'Camera'}
            className="full-width"
            onClick={() => {
              setCameraError('');
              lastCode.current = '';
              setCamera(!camera);
            }}
          >
            {camera ? 'Stop camera' : 'Start camera scanner'}
          </Button>
          {cameraError && (
            <p className="inline-error" role="alert">
              {cameraError}
            </p>
          )}
          <div className="or-divider">
            <span>
              {mode === 'membership' ? 'or enter a membership QR payload' : 'or use a ticket ID'}
            </span>
          </div>
          <form
            className="manual-scan"
            onSubmit={(e) => {
              e.preventDefault();
              scan(query);
            }}
          >
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={
                mode === 'membership'
                  ? 'SKYLINE:MEMBER:club:member-id'
                  : 'Ticket ID (or find a guest below)...'
              }
            />
            <Button type="submit" icon="ArrowRight">
              Check ID
            </Button>
          </form>
          <p className="form-note">
            {mode === 'membership'
              ? `Membership QR format: SKYLINE:MEMBER:${clubId}:MEM-001. Verification does not check in an event ticket.`
              : 'Enter the exact ticket ID, or search a guest and use the row check-in button.'}
          </p>
        </section>
        <aside>
          {mode === 'ticket' && (
            <section className="card checkin-summary">
              <CardHeader title="Tonight’s welcome" />
              <div className="checkin-stat">
                <strong>
                  {tickets.filter((t) => t.checkedIn).length}
                  <small> / {tickets.length}</small>
                </strong>
                <span>individual tickets checked in</span>
              </div>
              <Progress
                value={
                  (tickets.filter((t) => t.checkedIn).length / Math.max(tickets.length, 1)) * 100
                }
                tone="green"
              />
            </section>
          )}
          {memberResult && (
            <section
              className={`scan-result card ${memberResult.valid ? 'valid' : 'invalid'}`}
              role="status"
            >
              <Icon name={memberResult.valid ? 'BadgeCheck' : 'CircleX'} size={38} />
              <h2>{memberResult.valid ? 'Membership verified' : 'Membership not valid'}</h2>
              {memberResult.name && <h3>{memberResult.name}</h3>}
              <p>{memberResult.reason}</p>
            </section>
          )}
          {result && (
            <section className={`scan-result card ${result.type}`} role="status">
              <span className="result-icon">
                <Icon
                  name={
                    result.type === 'valid'
                      ? 'CircleCheck'
                      : result.type === 'used'
                        ? 'CircleAlert'
                        : 'CircleX'
                  }
                  size={38}
                />
              </span>
              <h2>
                {result.type === 'valid'
                  ? 'Welcome, you’re in!'
                  : result.type === 'used'
                    ? 'Already checked in'
                    : 'Ticket not found'}
              </h2>
              {result.ticket ? (
                <>
                  <h3>{result.ticket.name}</h3>
                  <p>{result.ticket.id}</p>
                  <Badge tone={result.ticket.member ? 'teal' : 'gold'}>
                    {result.ticket.member ? 'Skyline member' : 'Standard ticket'}
                  </Badge>
                </>
              ) : (
                <p>Check the ticket ID and selected event, then try again.</p>
              )}
              <Button
                variant="secondary"
                icon="ScanLine"
                onClick={() => {
                  setResult(null);
                  setQuery('');
                  lastCode.current = '';
                }}
              >
                Next guest
              </Button>
            </section>
          )}
        </aside>
      </div>
      {mode === 'ticket' && (
        <section className="card table-card checkin-guests">
          <div className="table-toolbar">
            <h2>Your guests</h2>
            <span className="muted">{filtered.length} tickets in this demo</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Ticket reference</th>
                  <th>Membership</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id}>
                    <td>
                      <div className="member-cell">
                        <Avatar name={t.name} index={i} />
                        <span>
                          <strong>{t.name}</strong>
                          <small>{t.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>{t.id}</td>
                    <td>{t.member ? 'Member' : 'Non-member'}</td>
                    <td>
                      <Badge tone={t.checkedIn ? 'green' : 'gold'}>
                        {t.checkedIn ? 'Checked in' : 'Expected'}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        onClick={() => scan(t.id)}
                        icon={t.checkedIn ? 'CircleCheck' : 'UserCheck'}
                      >
                        {t.checkedIn ? 'View status' : 'Check in'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <Empty title="No matching guests" description="Try a different name or ticket ID." />
          )}
        </section>
      )}
    </>
  );
}
