import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Avatar,
  Badge,
  Button,
  CardHeader,
  Empty,
  Field,
  Icon,
  LinkButton,
  Logo,
  PageHeader,
  Progress,
  StatCard,
} from '../components';
import { date, money, today, uid, useStore } from '../store';
import { useSession } from '../session';
import { cloudMode } from '../backend';
import { CloudAuth } from './CloudAuth';
import { CloudCollege } from './CloudCollege';
import '../portal.css';
import '../landing-stage.css';
import { cancelEventTicket } from './Commerce';
import { LandingEvents } from '../components/LandingEvents';
import { Revealed } from '../components/PageMotion';

const accentColor = (tone: string) =>
  ({ teal: 'var(--primary)', purple: 'var(--purple)', gold: 'var(--gold)' })[tone] ||
  'var(--primary)';
const roles = [
  {
    role: 'member',
    title: 'Student & volunteer',
    text: 'My membership, tickets and assignments',
    icon: 'UserRound',
  },
  {
    role: 'organizer',
    title: 'Event organizer',
    text: 'Event readiness, guests and check-in',
    icon: 'CalendarDays',
  },
  {
    role: 'treasurer',
    title: 'Treasurer',
    text: 'Receipts, approvals and club finances',
    icon: 'Wallet',
  },
  {
    role: 'admin',
    title: 'Club president',
    text: 'People, events and the whole club',
    icon: 'ShieldCheck',
  },
  {
    role: 'college',
    title: 'College administrator',
    text: 'A clear view across campus clubs',
    icon: 'Globe',
  },
] as const;
function QR({ value }: { value: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: 220,
      margin: 2,
      color: { dark: '#123f38', light: '#ffffff' },
    }).then((url) => {
      if (active) setSrc(url);
    });
    return () => {
      active = false;
    };
  }, [value]);
  return src ? (
    <img className="portal-qr" src={src} alt="Scannable QR code" />
  ) : (
    <span>Generating QR…</span>
  );
}
function usePersonal() {
  const { data } = useStore();
  const { user } = useSession();
  const member = data.members.find((m) => m.email.toLowerCase() === user.email.toLowerCase());
  return {
    data,
    user,
    member,
    tickets: data.tickets.filter(
      (t) => t.email.toLowerCase() === user.email.toLowerCase() && t.status !== 'Cancelled',
    ),
    orders: data.orders.filter((o) => o.name === user.name),
    tasks: data.tasks.filter((t) => t.assignee === user.name),
  };
}
function MemberPreview() {
  const { user, member } = usePersonal();
  const { clubs, clubId } = useSession();
  return (
    <div className="portal-membership">
      <div>
        <span className="portal-kicker">YOUR CAMPUS PASS</span>
        <h2>{clubs.find((c) => c.id === clubId)?.name}</h2>
        <p>{user.name}</p>
      </div>
      <div className="portal-membership-bottom">
        <Badge tone={member?.status === 'Active' ? 'teal' : 'gold'}>
          {member?.status || 'Not a member'}
        </Badge>
        <Link to="/app/my-card">
          View member card <Icon name="ArrowUpRight" size={18} />
        </Link>
      </div>
    </div>
  );
}
function EventList({ limit = 3 }: { limit?: number }) {
  const { data } = useStore();
  const events = [...data.events]
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
  return (
    <div className="portal-event-list">
      {events.map((e) => (
        <Link to={`/app/events/${e.id}`} className="portal-event" key={e.id}>
          <img src={e.image} alt="" />
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

export function RoleDashboard() {
  const { role, user } = useSession();
  const { data } = useStore();
  const personal = usePersonal();
  const membershipActive = personal.member?.status === 'Active' && personal.member.expires >= today;
  if (role === 'college') return <CollegeDashboard />;
  const completed = data.transactions.filter((t) => t.status === 'Completed');
  const balance = completed.reduce((n, t) => n + t.amount, 0);
  const pending = data.transactions.filter((t) => t.status === 'Pending');
  if (role === 'treasurer')
    return (
      <div className="role-stage treasurer-stage">
        <header className="treasurer-hero dark-hero-card">
          <div className="treasurer-hero-main">
            <span className="role-kicker">
              <Icon name="Wallet" size={16} /> TREASURER DESK & APPROVAL STAGE
            </span>
            <h1>Good morning, {user.name.split(' ')[0]}.</h1>
            <p>Every rupee accounted for. Keep club spending clean and transparent.</p>
            <div className="treasurer-hero-actions">
              <LinkButton to="/app/finance" icon="ArrowUpRight">
                Open Ledger
              </LinkButton>
              <LinkButton to="/app/finance?action=request" variant="secondary" icon="Plus">
                Record Reimbursement
              </LinkButton>
            </div>
          </div>
          <div className="treasurer-hero-badge-card">
            <span className="treasurer-badge-label">Available Balance</span>
            <strong className="treasurer-badge-amount">{money(balance)}</strong>
            <div className="treasurer-balance-split">
              <div>
                <small>Income</small>
                <span>
                  +{money(completed.filter((t) => t.amount > 0).reduce((n, t) => n + t.amount, 0))}
                </span>
              </div>
              <div>
                <small>Expenses</small>
                <span>
                  -
                  {money(
                    Math.abs(
                      completed.filter((t) => t.amount < 0).reduce((n, t) => n + t.amount, 0),
                    ),
                  )}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="portal-columns" style={{ marginTop: '24px' }}>
          <section className="portal-panel approval-stage-panel">
            <CardHeader
              title={`Approval Queue (${pending.length})`}
              subtitle="Pending expenses awaiting treasurer approval."
              action={
                <Link to="/app/finance" className="text-link">
                  Open full ledger →
                </Link>
              }
            />
            {pending.map((t) => (
              <div className="approval-stage-row" key={t.id}>
                <span className="icon-tile gold">
                  <Icon name="Receipt" />
                </span>
                <div className="approval-stage-info">
                  <strong>{t.title}</strong>
                  <small>
                    {t.receipt ? `Receipt: ${t.receipt}` : 'Receipt required'} · {date(t.date)}
                  </small>
                </div>
                <div className="approval-stage-action">
                  <strong>{money(Math.abs(t.amount))}</strong>
                  <Link to="/app/finance" className="button secondary small-btn">
                    Review
                  </Link>
                </div>
              </div>
            ))}
            {!pending.length && (
              <Empty
                title="Ledger is clean"
                description="There are no pending expenses to review."
              />
            )}
          </section>

          <section className="portal-panel">
            <CardHeader title="Finance in context" subtitle="Follow activity behind the ledger." />
            <div className="treasurer-context-cards">
              <Link className="portal-action-card" to="/app/events">
                <Icon name="Ticket" />
                <div>
                  <h3>Event revenue & bookings</h3>
                  <p>Compare capacity, ticket revenue, and budget caps.</p>
                </div>
                <Icon name="ArrowUpRight" />
              </Link>
              <Link className="portal-action-card" to="/app/merchandise">
                <Icon name="ShoppingBag" />
                <div>
                  <h3>Merch inventory & orders</h3>
                  <p>Check sales and cash flow before next inventory run.</p>
                </div>
                <Icon name="ArrowUpRight" />
              </Link>
            </div>
            <div className="portal-note" style={{ marginTop: '16px' }}>
              <Icon name="ShieldCheck" size={18} />
              <p>All transactions are mirrored on campus ledger with immutable audit logs.</p>
            </div>
          </section>
        </div>
      </div>
    );

  if (role === 'organizer')
    return (
      <div className="role-stage organizer-stage">
        <header className="organizer-door-hero dark-hero-card">
          <div className="organizer-hero-info">
            <span className="role-kicker">
              <Icon name="ScanLine" size={16} /> ORGANIZER DOOR BOARD & DISPATCH
            </span>
            <h1>Let's make it happen, {user.name.split(' ')[0]}.</h1>
            <p>Live attendance readiness, guests arriving, and team assignments for tonight.</p>
            <div className="organizer-hero-actions">
              <LinkButton to="/app/check-in" icon="ScanLine">
                Launch QR Door Station
              </LinkButton>
              <LinkButton to="/app/events/manage?create=true" variant="secondary" icon="Plus">
                Create Event
              </LinkButton>
            </div>
          </div>
          <div className="organizer-door-meter">
            <div className="door-meter-circle">
              <Icon name="Users" size={28} />
              <strong>
                {data.tickets.filter((t) => t.checkedIn).length} / {data.tickets.length}
              </strong>
              <small>Checked in at door</small>
            </div>
            <div className="door-meter-stats">
              <div>
                <strong>{data.events.filter((e) => e.date >= today).length}</strong>
                <span>Active events</span>
              </div>
              <div>
                <strong>{data.tasks.filter((t) => t.status !== 'Done').length}</strong>
                <span>Open tasks</span>
              </div>
            </div>
          </div>
        </header>

        <div className="portal-columns" style={{ marginTop: '24px' }}>
          <section className="portal-panel">
            <CardHeader
              title="Door & Event Readiness"
              subtitle="Live event capacity & attendee count."
              action={
                <Link className="text-link" to="/app/events">
                  All events →
                </Link>
              }
            />
            {data.events.map((e) => (
              <Link className="portal-readiness" key={e.id} to={`/app/events/${e.id}`}>
                <div>
                  <h3>{e.title}</h3>
                  <small>
                    {date(e.date)} · {e.venue}
                  </small>
                </div>
                <div>
                  <Badge tone={e.sold >= e.capacity ? 'gold' : 'teal'}>
                    {e.sold >= e.capacity ? 'Full' : `${e.capacity - e.sold} spaces left`}
                  </Badge>
                  <Progress value={(e.sold / e.capacity) * 100} />
                  <small>
                    {e.sold} / {e.capacity} booked
                  </small>
                </div>
              </Link>
            ))}
          </section>

          <section className="portal-panel">
            <CardHeader
              title="Dispatch & Team Tasks"
              subtitle="High priority checklist"
              action={
                <Link to="/app/tasks" className="text-link">
                  Open board →
                </Link>
              }
            />
            {data.tasks
              .filter((t) => t.status !== 'Done')
              .slice(0, 4)
              .map((t) => (
                <Link className="portal-row" to="/app/tasks" key={t.id}>
                  <Avatar name={t.assignee} small />
                  <div>
                    <strong>{t.title}</strong>
                    <small>
                      {t.assignee} · due {date(t.due)}
                    </small>
                  </div>
                  <Badge
                    tone={t.priority === 'High' ? 'red' : t.priority === 'Medium' ? 'gold' : 'teal'}
                  >
                    {t.priority}
                  </Badge>
                </Link>
              ))}
          </section>
        </div>
      </div>
    );

  // Default: Member Pass Vibe landing
  return (
    <div className="role-stage member-stage">
      <section className="member-pass-hero dark-hero-card">
        <div className="member-pass-hero-content">
          <span className="role-kicker">
            <Icon name="BadgeCheck" size={16} /> OFFICIAL CAMPUS PASS
          </span>
          <h1>Welcome back, {user.name.split(' ')[0]}.</h1>
          <p>
            {membershipActive
              ? 'Your pass is active. Explore student workshops, merchandise perks, and campus socials.'
              : personal.member
                ? 'Your enrollment is saved. Membership benefits become available when your dues are recorded.'
                : 'Join this club to receive your campus membership pass.'}
          </p>
          <div className="member-pass-pills">
            <span className="member-pass-pill">
              <Icon name="Ticket" size={15} /> {personal.tickets.length} Booked Events
            </span>
            <span className="member-pass-pill">
              <Icon name="HeartHandshake" size={15} />{' '}
              {personal.tasks.filter((t) => t.status === 'Done').length} Volunteering Done
            </span>
            <span className="member-pass-pill">
              <Icon name="ShoppingBag" size={15} /> {personal.orders.length} Club Orders
            </span>
          </div>
        </div>
        <div className="member-pass-card-widget">
          <MemberPreview />
        </div>
      </section>

      <div className="portal-columns" style={{ marginTop: '24px' }}>
        <section className="portal-panel">
          <CardHeader
            title="Coming up on campus"
            subtitle="Events with member rates"
            action={
              <Link to="/app/events" className="text-link">
                All events →
              </Link>
            }
          />
          <EventList />
        </section>

        <div className="portal-stack">
          <section className="portal-panel">
            <CardHeader
              title="Your assigned tasks"
              subtitle="Current volunteer duties"
              action={
                <Link className="text-link" to="/app/tasks">
                  View board →
                </Link>
              }
            />
            {personal.tasks
              .filter((t) => t.status !== 'Done')
              .slice(0, 3)
              .map((t) => (
                <Link className="portal-row" key={t.id} to="/app/tasks">
                  <Icon name="ListTodo" />
                  <div>
                    <strong>{t.title}</strong>
                    <small>
                      Due {date(t.due)} · {t.priority} priority
                    </small>
                  </div>
                  <Badge tone={t.status === 'In progress' ? 'gold' : 'teal'}>{t.status}</Badge>
                </Link>
              ))}
            {!personal.tasks.some((t) => t.status !== 'Done') && (
              <p className="portal-muted">
                Nothing assigned right now. You're completely free to enjoy campus!
              </p>
            )}
          </section>

          <section className="portal-panel">
            <CardHeader
              title="Club announcements"
              action={
                <Link to="/app/announcements" className="text-link">
                  Feed →
                </Link>
              }
            />
            {data.announcements.slice(0, 2).map((a) => (
              <Link className="portal-row" to="/app/announcements" key={a.id}>
                <span className="icon-tile">
                  <Icon name="Megaphone" />
                </span>
                <div>
                  <strong>{a.title}</strong>
                  <small>
                    {a.author} · {date(a.date)}
                  </small>
                </div>
                <Icon name="ArrowUpRight" size={16} />
              </Link>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

export function PersonalProfile() {
  const { user, member, tasks, tickets, orders } = usePersonal();
  const { role, clubs, clubId } = useSession();
  return (
    <>
      <PageHeader
        eyebrow="MY ACCOUNT"
        title="A little more about you."
        description="Your identity, your community, and the part you play."
      />
      <section className="portal-profile">
        <Avatar name={user.name} />
        <div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <Badge>{roles.find((r) => r.role === role)?.title}</Badge>
        </div>
        <LinkButton to="/app/settings" variant="secondary" icon="Settings2">
          Account settings
        </LinkButton>
      </section>
      <div className="portal-columns">
        <section className="portal-panel">
          <CardHeader title="Your membership" />
          <dl className="portal-details">
            <div>
              <dt>Organization</dt>
              <dd>{clubs.find((c) => c.id === clubId)?.name}</dd>
            </div>
            <div>
              <dt>Student course</dt>
              <dd>{member?.course || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>{member ? date(member.joined) : 'Not enrolled'}</dd>
            </div>
            <div>
              <dt>Valid until</dt>
              <dd>{member ? date(member.expires) : '—'}</dd>
            </div>
            <div>
              <dt>Membership status</dt>
              <dd>{member?.status || 'Not a member'}</dd>
            </div>
          </dl>
          <LinkButton to="/app/my-card" icon="QrCode" variant="secondary">
            Open digital card
          </LinkButton>
        </section>
        <section className="portal-panel">
          <CardHeader title="Your campus activity" />
          <Link className="portal-row" to="/app/my-tickets">
            <Icon name="Ticket" />
            <div>
              <strong>My tickets</strong>
              <small>{tickets.length} personal bookings</small>
            </div>
            <Icon name="ChevronRight" />
          </Link>
          <Link className="portal-row" to="/app/my-orders">
            <Icon name="ShoppingBag" />
            <div>
              <strong>My orders</strong>
              <small>{orders.length} merchandise orders</small>
            </div>
            <Icon name="ChevronRight" />
          </Link>
          <Link className="portal-row" to="/app/tasks">
            <Icon name="HeartHandshake" />
            <div>
              <strong>Volunteering</strong>
              <small>{tasks.filter((t) => t.status === 'Done').length} completed assignments</small>
            </div>
            <Icon name="ChevronRight" />
          </Link>
        </section>
      </div>
      <NotificationPreferences />
    </>
  );
}
export function MemberCard() {
  const { user, member } = usePersonal();
  const { update, toast } = useStore();
  const { clubs, clubId } = useSession();
  const valid =
    !!member &&
    (member.status === 'Active' || member.status === 'Expiring') &&
    member.expires >= today;
  return (
    <>
      <PageHeader
        eyebrow="MY MEMBERSHIP"
        title="Your community. In your pocket."
        description="Show this card at the door to verify your club membership."
      />
      <div className="portal-card-layout">
        <section className="portal-digital-card">
          <div className="portal-card-top">
            <Logo />
            <span>STUDENT MEMBERSHIP</span>
          </div>
          <span className="portal-card-label">{clubs.find((c) => c.id === clubId)?.name}</span>
          <h2>{user.name}</h2>
          <p>{member?.course || 'Student'}</p>
          <div className="portal-card-qr">
            {member ? (
              <QR value={`SKYLINE:MEMBER:${clubId}:${member.id}`} />
            ) : (
              <Icon name="UserRoundPlus" size={60} />
            )}
            <div>
              <Badge tone={valid ? 'teal' : 'gold'}>
                {valid ? 'Valid membership' : 'Membership pending'}
              </Badge>
              <strong>{member?.id || 'Not enrolled'}</strong>
              <small>Expires {member ? date(member.expires) : '—'}</small>
            </div>
          </div>
          <div className="portal-card-footer">
            <span>Belong here. Build together.</span>
            <Icon name="ShieldCheck" size={22} />
          </div>
        </section>
        <section className="portal-panel">
          <CardHeader
            title="More than a membership"
            subtitle="Your benefits follow you around campus."
          />
          <div className="portal-benefit">
            <Icon name="Ticket" />
            <div>
              <h3>Member ticket prices</h3>
              <p>Get the member rate on eligible club events.</p>
            </div>
          </div>
          <div className="portal-benefit">
            <Icon name="Shirt" />
            <div>
              <h3>Merchandise discounts</h3>
              <p>Your club identity, at a little less.</p>
            </div>
          </div>
          <div className="portal-benefit">
            <Icon name="UsersRound" />
            <div>
              <h3>A place to contribute</h3>
              <p>Volunteer, share an idea, or help organize the next big thing.</p>
            </div>
          </div>
          <div className="portal-note">
            <Icon name="CircleHelp" />
            <p>
              {valid
                ? 'The door team checks your membership status and expiry when scanning this code.'
                : 'Membership benefits become available once your dues are recorded. Contact the club team for renewal.'}
            </p>
          </div>
          <LinkButton to="/app/events" icon="ArrowRight">
            Find your next event
          </LinkButton>
          {member && (!valid || member.status === 'Expiring') && (
            <Button
              variant="secondary"
              onClick={() => {
                if (
                  !window.confirm(
                    'Record a simulated ₹500 annual membership payment? No real payment is taken.',
                  )
                )
                  return;
                update((d) => ({
                  ...d,
                  members: d.members.map((m) =>
                    m.id === member.id ? { ...m, status: 'Active', expires: '2027-07-31' } : m,
                  ),
                  transactions: [
                    ...d.transactions,
                    {
                      id: uid('TX'),
                      title: `Membership dues · ${user.name} (demo payment)`,
                      category: 'Membership',
                      amount: 500,
                      date: today,
                      status: 'Completed',
                      createdBy: user.id,
                    },
                  ],
                }));
                toast('Demo dues recorded. Membership card updated.');
              }}
            >
              Record demo dues · ₹500
            </Button>
          )}
        </section>
      </div>
    </>
  );
}
function NotificationPreferences() {
  const { member } = usePersonal();
  const { update, toast } = useStore();
  const [phone, setPhone] = useState(member?.phone || '');
  const [optIn, setOptIn] = useState(!!member?.whatsappOptIn);
  const [error, setError] = useState('');
  useEffect(() => {
    setPhone(member?.phone || '');
    setOptIn(!!member?.whatsappOptIn);
  }, [member?.id, member?.phone, member?.whatsappOptIn]);
  return (
    <section className="portal-panel portal-latest">
      <CardHeader title="Keep me in the loop" subtitle="Choose how your club can reach you." />
      {member ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (optIn && !/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
              setError('Enter a phone number with country code, for example +919876543210.');
              return;
            }
            setError('');
            update((d) => ({
              ...d,
              members: d.members.map((m) =>
                m.id === member.id ? { ...m, phone: phone.trim(), whatsappOptIn: optIn } : m,
              ),
            }));
            toast('Preferences saved. WhatsApp sending requires a configured provider.');
          }}
        >
          <div className="portal-consent-fields">
            <Field label="WhatsApp phone number" hint="Include your country code.">
              <input
                type="tel"
                placeholder="+919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <label className="portal-consent-check">
              <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
              <span>
                I agree to receive club announcements and membership reminders on WhatsApp. I can
                turn this off at any time.
              </span>
            </label>
          </div>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" icon="Check">
            Save preferences
          </Button>
          <p className="portal-muted portal-consent-hint">
            Consent is saved locally for this demo. No WhatsApp message is sent from this form.
          </p>
        </form>
      ) : (
        <p className="portal-muted">
          Join this club to manage your membership communication preferences.
        </p>
      )}
    </section>
  );
}
export function MyTickets() {
  const { data, tickets, user } = usePersonal();
  const { update, applyServerPatch, toast, selectedClub } = useStore();
  return (
    <>
      <PageHeader
        eyebrow="MY BOOKINGS"
        title="Good things on your calendar."
        description="Only tickets booked with your account email appear here."
        action={
          <LinkButton to="/app/events" icon="Plus">
            Browse events
          </LinkButton>
        }
      />
      <div className="portal-ticket-grid">
        {tickets.map((t) => {
          const e = data.events.find((e) => e.id === t.eventId);
          return (
            <section className="portal-ticket" key={t.id}>
              <div className="portal-ticket-image" style={{ backgroundImage: `url(${e?.image})` }}>
                <Badge>{t.checkedIn ? 'Checked in' : 'Ready for entry'}</Badge>
              </div>
              <div className="portal-ticket-body">
                <small>{e ? `${date(e.date)} · ${e.time}` : 'Event details unavailable'}</small>
                <h2>{e?.title || t.eventId}</h2>
                <p>{e?.venue}</p>
                <div className="portal-ticket-code">
                  <QR value={t.id} />
                  <div>
                    <strong>{t.name}</strong>
                    <small>{t.id}</small>
                    <span>
                      {money(t.amount)} · {t.member ? 'Member ticket' : 'Standard ticket'}
                    </span>
                  </div>
                </div>
                {e && (
                  <Link to={`/app/events/${e.id}`} className="text-link">
                    View event →
                  </Link>
                )}
                {!t.checkedIn && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (
                        !window.confirm(
                          'Cancel this demo booking? Your payment will be credited in the demo ledger, and the next waitlisted guest is auto-promoted.',
                        )
                      )
                        return;
                      void (async () => {
                        try {
                          const { clubRequest } = await import('../api');
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
                              ? `Cancelled. ${reply.promoted.name} was auto-promoted from the waitlist.`
                              : 'Ticket cancelled. Demo payment credited to the ledger.',
                          );
                        } catch (error) {
                          if (cloudMode) {
                            toast(error instanceof Error ? error.message : 'Cancellation failed.');
                            return;
                          }
                          update((d) => cancelEventTicket(d, t.id, user.id));
                          toast('Ticket cancelled locally. Demo payment credited to the ledger.');
                        }
                      })();
                    }}
                  >
                    Cancel booking
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {!tickets.length && (
        <section className="portal-panel">
          <Empty
            title="Your first good memory is waiting"
            description="Explore club events and book a place. Your ticket and QR will appear here."
            action={<LinkButton to="/app/events">Discover events</LinkButton>}
          />
        </section>
      )}
    </>
  );
}
export function MyOrders() {
  const { data, orders } = usePersonal();
  return (
    <>
      <PageHeader
        eyebrow="MY ORDERS"
        title="Wear your community."
        description="Your merchandise orders, all in one place."
        action={
          <LinkButton to="/app/merchandise" icon="ShoppingBag">
            Visit the shop
          </LinkButton>
        }
      />
      <section className="portal-panel">
        {orders.map((o) => (
          <div className="portal-row" key={o.id}>
            <span className="icon-tile">
              <Icon name="ShoppingBag" />
            </span>
            <div>
              <strong>
                {data.products.find((p) => p.id === o.productId)?.name || o.productId}
              </strong>
              <small>
                {o.id} · Size {o.size} · {date(o.date)}
              </small>
            </div>
            <strong>{money(o.amount)}</strong>
          </div>
        ))}
        {!orders.length && (
          <Empty
            title="A fresh wardrobe starts here"
            description="Your club shop orders will appear here after checkout."
            action={<LinkButton to="/app/merchandise">Explore merchandise</LinkButton>}
          />
        )}
      </section>
    </>
  );
}

export function CollegeDashboard() {
  return cloudMode ? <CloudCollege /> : <DemoCollegeDashboard />;
}
function DemoCollegeDashboard() {
  const { allClubs, organizations } = useStore();
  const unique = new Set(
    Object.values(allClubs).flatMap((d) => d.members.map((m) => m.email.toLowerCase())),
  );
  const events = Object.values(allClubs)
    .flatMap((d) => d.events)
    .filter((e) => e.date >= today);
  const balance = Object.values(allClubs)
    .flatMap((d) => d.transactions)
    .filter((t) => t.status === 'Completed')
    .reduce((n, t) => n + t.amount, 0);
  const { selectClub } = useSession();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        eyebrow="SKYLINE COLLEGE · CAMPUS OVERVIEW"
        title="A campus full of possibility."
        description="See how independent student communities contribute to one connected campus."
      />
      <div className="portal-stat-grid">
        <StatCard icon="UsersRound" label="Student organizations" value={organizations.length} />
        <StatCard
          icon="UserCheck"
          label="Unique participants"
          value={unique.size}
          note="Deduplicated by student email"
        />
        <StatCard
          icon="CalendarDays"
          label="Upcoming campus events"
          value={events.length}
          tone="gold"
        />
        <StatCard
          icon="Wallet"
          label="Combined club balance"
          value={money(balance)}
          tone="purple"
        />
      </div>
      <section className="portal-panel">
        <CardHeader
          title="The campus community"
          subtitle="Aggregate club summaries. Select an organization to inspect its workspace."
        />
        <div className="discovery-crosslink">
          <LinkButton to="/events" icon="CalendarDays" variant="secondary">
            See all campus events
          </LinkButton>
        </div>
        <div className="portal-club-grid">
          {organizations.map((c) => {
            const d = allClubs[c.id];
            return (
              <article className="portal-club" key={c.id}>
                <span className="portal-club-symbol" style={{ background: accentColor(c.accent) }}>
                  {c.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <h2>{c.name}</h2>
                <p>{c.description}</p>
                <div className="portal-club-metrics">
                  <span>
                    <strong>{d?.members.length || 0}</strong> memberships
                  </span>
                  <span>
                    <strong>{d?.events.length || 0}</strong> events
                  </span>
                </div>
                <Button
                  variant="secondary"
                  icon="ArrowUpRight"
                  onClick={() => {
                    selectClub(c.id);
                    navigate('/app/club-summary');
                  }}
                >
                  View club
                </Button>
              </article>
            );
          })}
        </div>
      </section>
      <div className="portal-note portal-latest">
        <Icon name="ShieldCheck" />
        <p>
          This college view shows aggregate participation and club balances. Individual receipts
          belong in the authorized club finance workspace.
        </p>
      </div>
    </>
  );
}
export function AuthPage({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  return cloudMode ? <CloudAuth mode={mode} /> : <DemoAuthPage mode={mode} />;
}
function DemoAuthPage({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const { switchPersona } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [selectedRole, setSelectedRole] = useState<(typeof roles)[number]['role']>('member');
  const requested = params.get('returnTo');
  const returnTo =
    requested?.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\')
      ? requested
      : null;
  const selected = roles.find((role) => role.role === selectedRole)!;
  return (
    <div className="portal-auth streamlined-auth">
      <aside>
        <Logo />
        <span className="portal-kicker">YOUR CAMPUS, CONNECTED</span>
        <h1>
          Make plans.
          <br />
          Meet people.
          <br />
          <em>Show up.</em>
        </h1>
        <p>Your events, tickets and community in one place.</p>
        <div className="portal-auth-proof">
          <div className="avatar-stack">
            {['Alex Morgan', 'Priya Sharma', 'Jordan Lee', 'Aisha Patel'].map((n, i) => (
              <Avatar key={n} name={n} index={i} small />
            ))}
          </div>
          <div>
            <strong>120+ active student leaders</strong>
            <small style={{ display: 'block', color: '#9fb8a4', marginTop: '2px' }}>
              Organizing events & managing clubs today
            </small>
          </div>
        </div>
        <div className="auth-testimonial-card">
          <Icon name="Quote" size={18} />
          <p>
            "Skyline replaced three spreadsheets and an email list for our club. Everything just
            works."
          </p>
          <small>— Priya Sharma, Skyline Lead Organizer</small>
        </div>
        <Link to="/events">← Keep exploring events</Link>
      </aside>
      <main>
        <Badge tone="gold">Demo workspace</Badge>
        <h1>{mode === 'signup' ? 'Try your campus workspace' : 'Welcome back'}</h1>
        <p>
          {returnTo
            ? 'Continue to your selected event or item after choosing a demo view.'
            : 'Select your role or persona below to instantly experience the tailored workspace.'}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            switchPersona(selectedRole);
            navigate(selectedRole === 'college' ? '/app/college' : returnTo || '/app');
          }}
        >
          <div className="auth-persona-selector">
            <label className="field-label">Select persona & role</label>
            <div className="auth-role-grid" role="radiogroup" aria-label="Select demo role">
              {roles.map((role) => {
                const isSelected = selectedRole === role.role;
                return (
                  <button
                    key={role.role}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`auth-role-tile ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedRole(role.role)}
                  >
                    <span className="icon-tile">
                      <Icon name={role.icon} />
                    </span>
                    <div className="auth-role-tile-info">
                      <strong>{role.title}</strong>
                      <small>{role.text}</small>
                    </div>
                    {isSelected && (
                      <span className="auth-role-check">
                        <Icon name="Check" size={16} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="auth-demo-credentials">
            <Field label="Active Persona Email (Demo Mode)">
              <input
                type="text"
                readOnly
                value={
                  selectedRole === 'member'
                    ? 'alex@skyline.edu'
                    : selectedRole === 'organizer'
                      ? 'priya@skyline.edu'
                      : selectedRole === 'treasurer'
                        ? 'jordan@skyline.edu'
                        : selectedRole === 'college'
                          ? 'admin@campus.edu'
                          : 'president@skyline.edu'
                }
              />
            </Field>
          </div>

          <Button type="submit" icon="ArrowRight" className="full-width">
            Continue as {selected.title}
          </Button>
        </form>
        <p className="login-demo-note">
          This opens a seeded demo persona. Real account authentication is not connected; changes
          are saved on this device.
        </p>
        <Link className="text-link" to="/events">
          Browse events without signing in <Icon name="ArrowUpRight" size={16} />
        </Link>
      </main>
    </div>
  );
}
const CLUB_STORIES: Record<string, {
  image: string;
  category: string;
  tagline: string;
  stats: string;
  cadence: string;
}> = {
  skyline: {
    image: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=85',
    category: 'Campus Life & Leadership',
    tagline: 'Bridging connections across campus, curating marquee traditions, and driving community impact.',
    stats: '1,200+ Active Members',
    cadence: 'Thursdays • 6:00 PM',
  },
  codecraft: {
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=85',
    category: 'Tech, Makers & Hackers',
    tagline: 'Building open-source tools, hosting overnight hackathons, and demoing ambitious prototypes.',
    stats: '480+ Makers & Devs',
    cadence: 'Tuesdays • 7:30 PM',
  },
  canvas: {
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=85',
    category: 'Design, Studio & Arts',
    tagline: 'From experimental typography to gallery exhibitions, elevating creative expression campus-wide.',
    stats: '310+ Artists & Designers',
    cadence: 'Fridays • 5:00 PM',
  },
};

export function ClubsPage() {
  const { organizations } = useStore();
  const navigate = useNavigate();
  return (
    <div className="portal-public">
      <PublicNav />
      <main className="portal-discover">
        <span className="portal-kicker">FIND YOUR PEOPLE</span>
        <h1>
          There's a community
          <br />
          with your name on it.
        </h1>
        <p>Explore student-led clubs, meet your next team, and make campus your own.</p>
        <div className="discovery-crosslink">
          <LinkButton to="/events" icon="CalendarDays" variant="secondary">
            See all campus events
          </LinkButton>
        </div>
        <div className="portal-club-grid club-stories-grid">
          {organizations.map((c, idx) => {
            const story = CLUB_STORIES[c.id] || {
              image: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=85',
              category: 'Student Organization',
              tagline: c.description,
              stats: 'Active Community',
              cadence: 'Weekly on campus',
            };
            return (
              <Revealed key={c.id} delay={idx * 90}>
                <article
                  className="portal-club club-story-card"
                  onClick={() => navigate(`/clubs/${c.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      navigate(`/clubs/${c.id}`);
                    }
                  }}
                >
                  <div className="club-story-hero">
                    <img src={story.image} alt={c.name} className="club-story-image" loading="lazy" />
                    <div className="club-story-overlay" />
                    <span className="club-category-pill">{story.category}</span>
                  </div>
                  <div className="club-story-body">
                    <div className="club-story-meta">
                      <h2>{c.name}</h2>
                      <span className="club-cadence-badge">{story.cadence}</span>
                    </div>
                    <p className="club-story-desc">{story.tagline || c.description}</p>
                    <div className="club-story-footer">
                      <span className="club-stats-pill">
                        <Icon name="Users" size={14} />
                        {story.stats}
                      </span>
                      <Button
                        icon="ArrowRight"
                        onClick={() => {
                          navigate(`/clubs/${c.id}`);
                        }}
                      >
                        Explore this club
                      </Button>
                    </div>
                  </div>
                </article>
              </Revealed>
            );
          })}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
export function PublicNav({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!nav.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        nav.current?.querySelector<HTMLButtonElement>('.public-menu-toggle')?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <nav
      ref={nav}
      className={`portal-public-nav public-navigation ${className}`.trim()}
      aria-label="Public navigation"
    >
      <Logo />
      <button
        className="public-menu-toggle icon-button"
        aria-label={open ? 'Close site menu' : 'Open site menu'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name={open ? 'X' : 'Menu'} />
      </button>
      <div className={open ? 'public-links is-open' : 'public-links'}>
        <Link to="/events" onClick={() => setOpen(false)}>
          Events
        </Link>
        <Link to="/clubs" onClick={() => setOpen(false)}>
          Clubs
        </Link>
        <Link to="/shop" onClick={() => setOpen(false)}>
          Shop
        </Link>
        <Link to="/login" onClick={() => setOpen(false)}>
          Login
        </Link>
      </div>
    </nav>
  );
}
function PublicFooter() {
  return (
    <footer className="portal-public-footer">
      <Logo />
      <span>Made for student communities. Built to bring people together.</span>
      <Link to="/clubs">Find your club →</Link>
    </footer>
  );
}
const mosaicExtras = [
  {
    image:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80',
    club: 'SKYLINE',
    title: 'NIGHT STAGE',
    tag: 'MUSIC',
    year: '2026',
  },
  {
    image:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80',
    club: 'CANVAS',
    title: 'OPEN MIC',
    tag: 'CULTURE',
    year: '2026',
  },
  {
    image:
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=900&q=80',
    club: 'CODECRAFT',
    title: 'BUILDERS',
    tag: 'TECH',
    year: '2026',
  },
  {
    image:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',
    club: 'SKYLINE',
    title: 'CAMPUS',
    tag: 'COMMUNITY',
    year: '2026',
  },
];

export function LandingPage() {
  const { allClubs, organizations } = useStore();
  const afterRef = useRef<HTMLDivElement>(null);
  const mosaic = [
    ...organizations.flatMap((org) =>
      (allClubs[org.id]?.events || []).map((event) => ({
        id: `${org.id}-${event.id}`,
        href: `/e/${org.id}/${event.id}`,
        image: event.image,
        club: org.name.split(' ')[0].toUpperCase(),
        title: event.title.split(' ').slice(0, 2).join(' ').toUpperCase(),
        tag: event.category.toUpperCase(),
        year: event.date.slice(0, 4),
      })),
    ),
    ...mosaicExtras.map((item, i) => ({
      id: `extra-${i}`,
      href: '/events',
      ...item,
    })),
  ].slice(0, 14);

  return (
    <div className="portal-public landing-root">
      <section className="landing-stage" aria-label="Skyline home">
        <PublicNav className="landing-stage-nav" />
        <div className="landing-mosaic-viewport" aria-hidden="true">
          <div className="landing-mosaic">
            {mosaic.map((card, i) => (
              <Link
                key={card.id}
                to={card.href}
                className="landing-mosaic-card"
                style={{ '--pop-delay': `${Math.min(420, i * 35)}ms` } as CSSProperties}
                tabIndex={-1}
              >
                <img src={card.image} alt="" loading={i < 6 ? 'eager' : 'lazy'} />
                <div className="landing-mosaic-meta">
                  <span className="tl">{card.club}</span>
                  <span className="tr">{card.title}</span>
                  <span className="bl">{card.tag}</span>
                  <span className="br">{card.year}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="landing-stage-veil" />
        <div className="landing-stage-copy">
          <div className="landing-stage-panel">
            <span className="landing-stage-kicker">
              <span className="live-dot" /> The student community operating system
            </span>
            <h1 className="landing-stage-headline">
              Less chasing.
              <br />
              More <em>belonging.</em>
            </h1>
            <p className="landing-stage-lede">
              Events worth showing up for. People worth knowing. Money everyone can account for. Run
              your whole student organization in one thoughtful space.
            </p>
            <div className="landing-stage-actions">
              <LinkButton to="/events" icon="ArrowRight">
                Browse campus events
              </LinkButton>
              <LinkButton to="/clubs" variant="secondary">
                Find your community
              </LinkButton>
            </div>
            <div className="landing-stage-caption">
              <div className="avatar-stack">
                {['Alex Morgan', 'Priya Sharma', 'Jordan Lee', 'Aisha Patel'].map((n, i) => (
                  <Avatar key={n} name={n} index={i} small />
                ))}
              </div>
              <span>
                Built for busy students.
                <br />
                <strong>Every role has a place.</strong>
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="landing-stage-scroll"
          onClick={() => afterRef.current?.scrollIntoView({ behavior: 'smooth' })}
        >
          Scroll to explore
          <Icon name="ChevronDown" size={18} />
        </button>
      </section>

      <div className="landing-after-stage" ref={afterRef}>
        <Revealed>
          <section className="portal-proof">
            <span>ONE CONNECTED CAMPUS.</span>
            {organizations.map((c) => (
              <span key={c.id}>
                <Icon name="Sprout" size={18} />
                {c.name}
              </span>
            ))}
          </section>
        </Revealed>
        <LandingEvents />
        <Revealed>
          <section className="portal-feature-section" id="how-it-works">
            <span className="portal-kicker">EVERYTHING YOUR CLUB NEEDS</span>
            <h2>
              Good things happen
              <br />
              when everything comes together.
            </h2>
            <div className="portal-features">
              {[
                {
                  icon: 'UsersRound',
                  title: 'A home for your people',
                  body: 'Membership, renewals, digital cards and student benefits. Know who belongs and help them feel it.',
                  label: 'MEMBERSHIP',
                },
                {
                  icon: 'Ticket',
                  title: 'From idea to a full room',
                  body: 'Member pricing, capacity, digital tickets and quick check-in. Give every event a strong start.',
                  label: 'EVENTS & EXPERIENCES',
                },
                {
                  icon: 'Wallet',
                  title: 'Money that makes sense',
                  body: 'Dues, sales, receipts and approvals in a shared ledger. Close the semester with confidence.',
                  label: 'FINANCE & TRUST',
                },
              ].map((f, i) => (
                <Revealed key={f.title} delay={i * 70} pop as="article">
                  <span className="icon-tile">
                    <Icon name={f.icon} size={26} />
                  </span>
                  <small>{f.label}</small>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </Revealed>
              ))}
            </div>
          </section>
        </Revealed>
        <Revealed>
          <section className="portal-roles-section">
            <div>
              <span className="portal-kicker">THE RIGHT VIEW FOR EVERY RESPONSIBILITY</span>
              <h2>
                One campus.
                <br />
                Five ways to make it better.
              </h2>
              <p>
                Students need their next ticket. Treasurers need their next approval. College teams
                need the bigger picture. Skyline gives each person a useful starting point.
              </p>
              <LinkButton to="/login" icon="ArrowRight">
                Try a different perspective
              </LinkButton>
            </div>
            <div className="portal-role-list">
              {roles.map((r, i) => (
                <Revealed key={r.role} delay={i * 50} pop>
                  <Link to="/login">
                    <span>0{i + 1}</span>
                    <Icon name={r.icon} />
                    <div>
                      <strong>{r.title}</strong>
                      <small>{r.text}</small>
                    </div>
                    <Icon name="ArrowUpRight" size={20} />
                  </Link>
                </Revealed>
              ))}
            </div>
          </section>
        </Revealed>
        <Revealed>
          <section className="portal-public-cta">
            <span className="portal-kicker">MAKE THIS SEMESTER COUNT</span>
            <h2>
              Your next big thing
              <br />
              starts with your people.
            </h2>
            <LinkButton to="/login" icon="ArrowRight">
              Step into Skyline
            </LinkButton>
          </section>
        </Revealed>
        <PublicFooter />
      </div>
    </div>
  );
}
