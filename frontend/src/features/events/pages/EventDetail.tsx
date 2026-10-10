import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Empty } from '../../../shared/ui/Empty';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Progress } from '../../../shared/ui/Progress';
import { SearchField } from '../../../shared/ui/SearchField';
import { StatCard } from '../../../shared/ui/StatCard';
import { date, exportCSV, money, uid } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import { cloudMode } from '../../../shared/api/client';
import { eventEnd, eventPhase, eventStart } from '../utils/event-time';
import '../../finance/styles/finance.css';
import type { ClubEvent } from '../../../shared/types/domain';
import { cancelEventTicket } from '../../tickets/utils/cancel-ticket';

export function eventCalendar(event: ClubEvent) {
  const esc = (value: string) =>
    value
      .replaceAll('\\', '\\\\')
      .replaceAll('\n', '\\n')
      .replaceAll(',', '\\,')
      .replaceAll(';', '\\;');
  const start = eventStart(event);
  const end = eventEnd(event);
  const stamp = (d: Date) =>
    d.toISOString().slice(0, 19).replaceAll('-', '').replaceAll(':', '') + 'Z';
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
  const { data, update, applyServerPatch, toast, selectedClub } = useStore();
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
    if (eventPhase(event) === 'past') {
      toast('This event has ended. Reservations and the waitlist are closed.');
      return;
    }
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
  const ticketAction = past ? (
    <Button disabled>Event ended · bookings closed</Button>
  ) : !full || offer ? (
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
                                  void (async () => {
                                    try {
                                      const { clubRequest } =
                                        await import('../../commerce/api/commerce.api');
                                      const reply = await clubRequest<{
                                        patch: Parameters<typeof applyServerPatch>[1];
                                        promoted?: { name: string } | null;
                                      }>(selectedClub, '/tickets/cancel', {
                                        snapshot: data,
                                        actor: user,
                                        body: { ticketId: t.id },
                                      });
                                      applyServerPatch(selectedClub, reply.patch);
                                      toast(
                                        reply.promoted
                                          ? `Cancelled. ${reply.promoted.name} received a waitlist seat offer.`
                                          : 'Ticket cancelled. No one was waiting.',
                                      );
                                    } catch (error) {
                                      if (cloudMode) {
                                        toast(
                                          error instanceof Error
                                            ? error.message
                                            : 'Cancellation failed.',
                                        );
                                        return;
                                      }
                                      update((d) => cancelEventTicket(d, t.id, user.id));
                                      toast(
                                        'Ticket cancelled. Any waiting student has received an in-app seat offer.',
                                      );
                                    }
                                  })();
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
