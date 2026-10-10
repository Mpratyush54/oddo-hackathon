import { useEffect, useRef, useState } from 'react';
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
import '../portal.css';
import { cancelEventTicket } from './Commerce';
import { LandingEvents } from '../components/LandingEvents';

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
  if (role === 'college') return <CollegeDashboard />;
  const completed = data.transactions.filter((t) => t.status === 'Completed');
  const balance = completed.reduce((n, t) => n + t.amount, 0);
  const pending = data.transactions.filter((t) => t.status === 'Pending');
  if (role === 'treasurer')
    return (
      <>
        <PageHeader
          eyebrow="FINANCE WORKSPACE"
          title={`Good morning, ${user.name.split(' ')[0]}.`}
          description="Every rupee accounted for. Start with the decisions waiting on you."
          action={
            <LinkButton to="/app/finance" icon="ArrowUpRight">
              Open ledger
            </LinkButton>
          }
        />
        <div className="portal-stat-grid">
          <StatCard
            icon="Wallet"
            label="Available balance"
            value={money(balance)}
            note="Completed ledger entries"
          />
          <StatCard
            icon="Receipt"
            label="Awaiting review"
            value={pending.length}
            note={`${money(Math.abs(pending.reduce((n, t) => n + t.amount, 0)))} pending`}
            tone="gold"
          />
          <StatCard
            icon="TrendingUp"
            label="Recorded income"
            value={money(completed.filter((t) => t.amount > 0).reduce((n, t) => n + t.amount, 0))}
          />
          <StatCard
            icon="ArrowUpRight"
            label="Approved expenses"
            value={money(
              Math.abs(completed.filter((t) => t.amount < 0).reduce((n, t) => n + t.amount, 0)),
            )}
            tone="purple"
          />
        </div>
        <div className="portal-columns">
          <section className="portal-panel">
            <CardHeader
              title="Your approval queue"
              subtitle="Review the receipt before recording an expense."
              action={
                <Link to="/app/finance" className="text-link">
                  Review all →
                </Link>
              }
            />
            {pending.map((t) => (
              <Link className="portal-row" to="/app/finance" key={t.id}>
                <span className="icon-tile gold">
                  <Icon name="Receipt" />
                </span>
                <div>
                  <strong>{t.title}</strong>
                  <small>
                    {t.receipt ? `Receipt: ${t.receipt}` : 'Receipt required'} · {date(t.date)}
                  </small>
                </div>
                <strong>{money(Math.abs(t.amount))}</strong>
              </Link>
            ))}
            {!pending.length && (
              <Empty title="All caught up" description="There are no pending expenses to review." />
            )}
          </section>
          <section className="portal-panel">
            <CardHeader
              title="Money in context"
              subtitle="Follow the activity behind the ledger."
            />
            <Link className="portal-action-card" to="/app/events">
              <Icon name="Ticket" />
              <div>
                <h3>Event revenue & readiness</h3>
                <p>Open each event to compare capacity and bookings.</p>
              </div>
              <Icon name="ArrowUpRight" />
            </Link>
            <Link className="portal-action-card" to="/app/merchandise">
              <Icon name="ShoppingBag" />
              <div>
                <h3>Merchandise inventory</h3>
                <p>Review stock before your next production order.</p>
              </div>
              <Icon name="ArrowUpRight" />
            </Link>
            <div className="portal-note">
              <Icon name="CircleHelp" size={18} />
              <p>Pending expenses are excluded from the available balance until approved.</p>
            </div>
          </section>
        </div>
      </>
    );
  if (role === 'organizer')
    return (
      <>
        <PageHeader
          eyebrow="EVENTS WORKSPACE"
          title={`Let's make it happen, ${user.name.split(' ')[0]}.`}
          description="A clear picture of your next event, your team, and the door."
          action={
            <LinkButton to="/app/check-in" icon="ScanLine">
              Open check-in
            </LinkButton>
          }
        />
        <div className="portal-stat-grid">
          <StatCard
            icon="CalendarDays"
            label="Upcoming events"
            value={data.events.filter((e) => e.date >= today).length}
          />
          <StatCard icon="Ticket" label="Issued tickets" value={data.tickets.length} />
          <StatCard
            icon="UserCheck"
            label="Checked in"
            value={data.tickets.filter((t) => t.checkedIn).length}
            tone="green"
          />
          <StatCard
            icon="ListTodo"
            label="Open team tasks"
            value={data.tasks.filter((t) => t.status !== 'Done').length}
            tone="gold"
          />
        </div>
        <div className="portal-columns">
          <section className="portal-panel">
            <CardHeader
              title="Event readiness"
              subtitle="Capacity and bookings at a glance."
              action={
                <Link className="text-link" to="/app/events">
                  Manage events →
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
                    {e.sold >= e.capacity ? 'Full' : `${e.capacity - e.sold} spaces`}
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
              title="Team checklist"
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
                  <Badge tone={t.priority === 'High' ? 'gold' : 'teal'}>{t.status}</Badge>
                </Link>
              ))}
          </section>
        </div>
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="YOUR STUDENT SPACE"
        title={`Hey ${user.name.split(' ')[0]}, you're in good company.`}
        description="Your people, your plans, and everything you need for campus life."
        action={
          <LinkButton to="/app/events" icon="CalendarPlus">
            Explore events
          </LinkButton>
        }
      />
      <div className="portal-stat-grid">
        <StatCard
          icon="BadgeCheck"
          label="Membership"
          value={personal.member?.status || 'Not joined'}
        />
        <StatCard icon="Ticket" label="My bookings" value={personal.tickets.length} />
        <StatCard
          icon="ListTodo"
          label="My open tasks"
          value={personal.tasks.filter((t) => t.status !== 'Done').length}
          tone="gold"
        />
        <StatCard
          icon="ShoppingBag"
          label="My orders"
          value={personal.orders.length}
          tone="purple"
        />
      </div>
      <div className="portal-columns">
        <section className="portal-panel">
          <CardHeader
            title="Coming up on campus"
            subtitle="Make room for something good."
            action={
              <Link to="/app/events" className="text-link">
                All events →
              </Link>
            }
          />
          <EventList />
        </section>
        <div className="portal-stack">
          <MemberPreview />
          <section className="portal-panel">
            <CardHeader
              title="Your next contribution"
              action={
                <Link className="text-link" to="/app/tasks">
                  My tasks →
                </Link>
              }
            />
            {personal.tasks
              .filter((t) => t.status !== 'Done')
              .slice(0, 2)
              .map((t) => (
                <Link className="portal-row" key={t.id} to="/app/tasks">
                  <Icon name="ListTodo" />
                  <div>
                    <strong>{t.title}</strong>
                    <small>
                      Due {date(t.due)} · {t.status}
                    </small>
                  </div>
                  <Icon name="ChevronRight" size={16} />
                </Link>
              ))}
            {!personal.tasks.some((t) => t.status !== 'Done') && (
              <p className="portal-muted">
                Nothing assigned right now. Join a project to lend a hand.
              </p>
            )}
          </section>
        </div>
      </div>
      <section className="portal-panel portal-latest">
        <CardHeader
          title="From your community"
          action={
            <Link to="/app/announcements" className="text-link">
              All announcements →
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
            <Icon name="ArrowUpRight" size={18} />
          </Link>
        ))}
      </section>
    </>
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
  const { update, toast } = useStore();
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
                        window.confirm(
                          'Cancel this demo booking? Your payment will be credited in the demo ledger.',
                        )
                      ) {
                        update((d) => cancelEventTicket(d, t.id, user.id));
                        toast('Ticket cancelled. Demo payment credited to the ledger.');
                      }
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
        <Link to="/events">← Keep exploring events</Link>
      </aside>
      <main>
        <Badge tone="gold">Demo workspace</Badge>
        <h1>{mode === 'signup' ? 'Try your campus workspace' : 'Welcome back'}</h1>
        <p>
          {returnTo
            ? 'Continue to your selected event or item after choosing a demo view.'
            : 'Start with your student view. Club teams can choose their role below.'}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            switchPersona(selectedRole);
            navigate(selectedRole === 'college' ? '/app/college' : returnTo || '/app');
          }}
        >
          <Field label="Choose a demo view">
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as typeof selectedRole)}
            >
              {roles.map((role) => (
                <option key={role.role} value={role.role}>
                  {role.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="login-role-summary">
            <span className="icon-tile">
              <Icon name={selected.icon} />
            </span>
            <div>
              <strong>{selected.title}</strong>
              <p>{selected.text}</p>
            </div>
          </div>
          <Button type="submit" icon="ArrowRight" className="full-width">
            Continue to workspace
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
        <div className="portal-club-grid">
          {organizations.map((c) => (
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
              <Badge>Student-led community</Badge>
              <Button
                icon="ArrowRight"
                onClick={() => {
                  navigate(`/clubs/${c.id}`);
                }}
              >
                Explore this club
              </Button>
            </article>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
export function PublicNav() {
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
    <nav ref={nav} className="portal-public-nav public-navigation" aria-label="Public navigation">
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
        <LinkButton to="/login" icon="UserRound" variant="secondary">
          Sign in
        </LinkButton>
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
export function LandingPage() {
  const { data, organizations, selectedClub } = useStore();
  const event = data.events.find(
    (event) => new Date(`${event.date}T${event.time}:00+05:30`) > new Date(),
  );
  return (
    <div className="portal-public">
      <PublicNav />
      <section className="portal-public-hero">
        <div>
          <span className="portal-kicker">
            <span className="live-dot" /> THE STUDENT COMMUNITY OPERATING SYSTEM
          </span>
          <h1>
            Less chasing.
            <br />
            More <em>belonging.</em>
          </h1>
          <p>
            Events worth showing up for. People worth knowing. Money everyone can account for. Run
            your whole student organization in one thoughtful space.
          </p>
          <div className="portal-hero-buttons">
            <LinkButton to="/events" icon="ArrowRight">
              Browse campus events
            </LinkButton>
            <LinkButton to="/clubs" variant="secondary">
              Find your community
            </LinkButton>
          </div>
          <div className="portal-hero-caption">
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
        <div className="portal-preview motion-float">
          <div className="portal-preview-top">
            <span className="portal-preview-dots">● ● ●</span>
            <span>your campus, connected</span>
            <Icon name="ShieldCheck" size={16} />
          </div>
          <div className="portal-preview-content">
            <div className="portal-preview-greeting">
              <span>SKYLINE ASSOCIATION</span>
              <h2>A good day to build something.</h2>
              <p>Your community is moving. Here's the latest.</p>
            </div>
            <div className="portal-preview-stats">
              <div>
                <Icon name="UsersRound" />
                <strong>{data.members.length}</strong>
                <small>members, one community</small>
              </div>
              <div>
                <Icon name="CalendarDays" />
                <strong>{data.events.length}</strong>
                <small>moments to look forward to</small>
              </div>
            </div>
            <Link
              to={`/e/${selectedClub}/${event?.id || 'EVT-001'}`}
              className="portal-preview-event"
            >
              <img src={event?.image} alt="A warmly lit gala venue" />
              <div>
                <Badge tone="gold">UP NEXT</Badge>
                <h3>{event?.title || 'The Skyline Gala'}</h3>
                <p>Music, memories & your people.</p>
                <span>
                  {event ? date(event.date) : 'Coming soon'} <Icon name="ArrowUpRight" size={15} />
                </span>
              </div>
            </Link>
            <div className="portal-preview-task">
              <span className="icon-tile">
                <Icon name="CircleCheck" />
              </span>
              <div>
                <strong>Everyone knows their next step.</strong>
                <small>Tasks assigned. Receipts recorded. You're ready.</small>
              </div>
            </div>
          </div>
          <div className="portal-floating-card">
            <Icon name="QrCode" size={32} />
            <div>
              <strong>Your membership, verified.</strong>
              <small>One scan. You're part of it.</small>
            </div>
            <Icon name="BadgeCheck" size={24} />
          </div>
        </div>
      </section>
      <section className="portal-proof">
        <span>ONE CONNECTED CAMPUS.</span>
        {organizations.map((c) => (
          <span key={c.id}>
            <Icon name="Sprout" size={18} />
            {c.name}
          </span>
        ))}
      </section>
      <LandingEvents />
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
          ].map((f) => (
            <article key={f.title}>
              <span className="icon-tile">
                <Icon name={f.icon} size={26} />
              </span>
              <small>{f.label}</small>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="portal-roles-section">
        <div>
          <span className="portal-kicker">THE RIGHT VIEW FOR EVERY RESPONSIBILITY</span>
          <h2>
            One campus.
            <br />
            Five ways to make it better.
          </h2>
          <p>
            Students need their next ticket. Treasurers need their next approval. College teams need
            the bigger picture. Skyline gives each person a useful starting point.
          </p>
          <LinkButton to="/login" icon="ArrowRight">
            Try a different perspective
          </LinkButton>
        </div>
        <div className="portal-role-list">
          {roles.map((r, i) => (
            <Link to="/login" key={r.role}>
              <span>0{i + 1}</span>
              <Icon name={r.icon} />
              <div>
                <strong>{r.title}</strong>
                <small>{r.text}</small>
              </div>
              <Icon name="ArrowUpRight" size={20} />
            </Link>
          ))}
        </div>
      </section>
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
      <PublicFooter />
    </div>
  );
}
