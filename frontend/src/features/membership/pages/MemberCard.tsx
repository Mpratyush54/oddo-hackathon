import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { Logo } from '../../../shared/ui/Logo';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { date, today, uid } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { QR } from '../../../shared/components/QRCode';
import { usePersonal } from '../../account/hooks/usePersonal';

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
