import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { date, money } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { cloudMode } from '../../../shared/api/client';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { cancelEventTicket } from '../utils/cancel-ticket';
import { QR } from '../../../shared/components/QRCode';
import { usePersonal } from '../../account/hooks/usePersonal';

export function MyTickets() {
  const navigate = useNavigate();
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
                <Badge>
                  {t.refundPending
                    ? 'Refund processing'
                    : t.checkedIn
                      ? 'Checked in'
                      : 'Ready for entry'}
                </Badge>
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
                      if (cloudMode && t.paymentId) {
                        navigate(
                          `/app/refunds${t.refundPending ? '' : '?payment=' + encodeURIComponent(t.paymentId)}`,
                        );
                        return;
                      }
                      if (
                        !window.confirm(
                          'Cancel this demo booking? Your payment will be credited in the demo ledger, and the next waitlisted guest is auto-promoted.',
                        )
                      )
                        return;
                      void (async () => {
                        try {
                          const { clubRequest } = await import('../../commerce/api/commerce.api');
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
                    {cloudMode && t.paymentId
                      ? t.refundPending
                        ? 'View refund'
                        : 'Request refund'
                      : 'Cancel booking'}
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
