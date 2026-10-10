import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Button } from '../../../shared/ui/Button';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Empty } from '../../../shared/ui/Empty';
import { Field } from '../../../shared/ui/Field';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ProductArt } from '../../../shared/ui/ProductArt';
import { formValues } from '../../../shared/ui/formValues';
import { date, exportInvoicePdf, money, today, uid } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import { backendPost, cloudMode } from '../../../shared/api/client';
import { eventPhase } from '../../events/utils/event-time';
import '../../finance/styles/finance.css';
import type { Store, Ticket } from '../../../shared/types/domain';

export function CheckoutPage() {
  const [params] = useSearchParams();
  const { data, update, applyServerPatch, toast } = useStore();
  const { user, can, clubId } = useSession();
  const [email, setEmail] = useState(user.email),
    [result, setResult] = useState<{
      id: string;
      amount: number;
      name: string;
      ticket: boolean;
    } | null>(null),
    [qr, setQr] = useState(''),
    [joinMembership, setJoinMembership] = useState(false);
  const [processing, setProcessing] = useState(false);
  const cloudAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
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
  const memberRate = item?.memberPrice || 0;
  const treatedAsMember = !!member || (!!product && joinMembership);
  const itemTotal = treatedAsMember ? memberRate : regular;
  const membershipFee = !member && product && joinMembership ? 500 : 0;
  const amount = itemTotal + membershipFee;
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
    exportInvoicePdf(`${result.id}-invoice.pdf`, {
      title: result.ticket ? 'Skyline ticket invoice' : 'Skyline merchandise invoice',
      reference: result.id,
      customer: result.name,
      email,
      lines: [
        { label: 'Item', value: event?.title || product?.name || 'Order' },
        ...(result.ticket
          ? [{ label: 'Ticket ID', value: result.id }]
          : [{ label: 'Size', value: size || '—' }]),
        { label: 'Payment', value: 'Demo payment — no money charged' },
      ],
      total: money(result.amount),
    });
  };
  if (event && eventPhase(event) === 'past' && !result)
    return (
      <Empty
        title="This event has already ended"
        description="Reservations are closed. View the event recap or find your next campus plan."
        action={<LinkButton to={`/app/events/${event.id}`}>View event recap</LinkButton>}
      />
    );
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
            {treatedAsMember && regular > memberRate && (
              <div className="discount-row">
                <dt>
                  Member discount <Icon name="BadgeCheck" size={14} />
                </dt>
                <dd>−{money(regular - memberRate)}</dd>
              </div>
            )}
            {membershipFee > 0 && (
              <div>
                <dt>Annual membership</dt>
                <dd>{money(membershipFee)}</dd>
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
              : product
                ? 'Not a member yet? Add membership below to unlock member rates.'
                : 'Members get a little extra. Use your member email.'}
          </span>
        </section>
        <section className="card checkout-form">
          <CardHeader
            title="A little about you"
            subtitle="We’ll keep your ticket or order under this name."
          />
          <form
            onSubmit={async (e) => {
              const f = formValues(e);
              if ((event && eventPhase(event) === 'past') || soldOut || unavailable) {
                toast('This item is no longer available. Please choose another.');
                return;
              }
              const reference = uid(event ? 'SKY' : 'ORD');
              if (cloudMode) {
                if (processing) return;
                setProcessing(true);
                try {
                  const command = {
                    type: event ? 'tickets.book' : 'orders',
                    args: event
                      ? { eventId: event.id }
                      : { productId: product?.id, size, quantity: 1, joinMembership },
                  };
                  const fingerprint = JSON.stringify(command);
                  if (cloudAttempt.current?.fingerprint !== fingerprint)
                    cloudAttempt.current = { fingerprint, key: crypto.randomUUID() };
                  const reply = await backendPost<{
                    state: Store;
                    ticket?: Ticket;
                    orders?: { id: string }[];
                    total?: number;
                  }>(`/clubs/${clubId}/actions`, {
                    ...command,
                    idempotencyKey: cloudAttempt.current.key,
                  });
                  applyServerPatch(clubId, reply.state);
                  setResult({
                    id: reply.ticket?.id || reply.orders?.[0]?.id || '',
                    amount: reply.ticket?.amount ?? reply.total ?? 0,
                    name: user.name,
                    ticket: !!event,
                  });
                  cloudAttempt.current = null;
                } catch (error) {
                  toast(error instanceof Error ? error.message : 'Booking could not be confirmed.');
                } finally {
                  setProcessing(false);
                }
                return;
              }
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
                update((d) => {
                  let members = d.members;
                  const transactions = [
                    {
                      id: uid('TX'),
                      title: `${product.name} · ${f.name.trim()}`,
                      category: 'Merchandise',
                      amount: itemTotal,
                      date: today,
                      status: 'Completed' as const,
                      createdBy: user.id,
                    },
                    ...d.transactions,
                  ];
                  if (!member && joinMembership) {
                    const existing = d.members.find(
                      (m) => m.email.toLowerCase() === email.trim().toLowerCase(),
                    );
                    members = existing
                      ? d.members.map((m) =>
                          m.id === existing.id
                            ? { ...m, status: 'Active' as const, expires: '2027-07-31' }
                            : m,
                        )
                      : [
                          ...d.members,
                          {
                            id: uid('MEM'),
                            name: f.name.trim(),
                            email: email.trim(),
                            course: 'Campus community',
                            status: 'Active' as const,
                            joined: today,
                            expires: '2027-07-31',
                            role: 'Member',
                            participationPoints: 0,
                            volunteerPoints: 0,
                            contributionPoints: 0,
                          },
                        ];
                    transactions.unshift({
                      id: uid('TX'),
                      title: `Annual membership · ${f.name.trim()}`,
                      category: 'Membership',
                      amount: 500,
                      date: today,
                      status: 'Completed',
                      createdBy: user.id,
                    });
                  }
                  return {
                    ...d,
                    members,
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
                        amount: itemTotal,
                        date: today,
                      },
                      ...d.orders,
                    ],
                    transactions,
                  };
                });
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
                  : product
                    ? 'Non-members pay the standard rate — or add membership below.'
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
            {product && !member && (
              <label className="check-label shop-membership-offer">
                <input
                  type="checkbox"
                  checked={joinMembership}
                  onChange={(e) => setJoinMembership(e.target.checked)}
                />
                <span>
                  <strong>Add annual club membership · ₹500</strong>
                  <small>
                    Unlock the member price for this order
                    {regular > memberRate
                      ? ` (save ${money(regular - memberRate)} on this piece)`
                      : ''}{' '}
                    and future eligible purchases.
                  </small>
                </span>
              </label>
            )}
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
              disabled={soldOut || unavailable || processing}
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
