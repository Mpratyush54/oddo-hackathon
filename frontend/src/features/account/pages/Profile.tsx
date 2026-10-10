import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Avatar } from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { Modal } from '../../../shared/ui/Modal';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { date } from '../../../shared/utils/format';
import { useSession } from '../../auth/session';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { roles } from '../../auth/config/roles';
import { usePersonal } from '../hooks/usePersonal';
import { NotificationPreferences } from '../components/NotificationPreferences';
import { AccountSettings } from './AccountSettings';

export function PersonalProfile() {
  const { user, member, tasks, tickets, orders } = usePersonal();
  const { role, clubs, clubId } = useSession();
  const [params, setParams] = useSearchParams();
  const [settingsOpen, setSettingsOpen] = useState(params.get('settings') === '1');
  useEffect(() => {
    setSettingsOpen(params.get('settings') === '1');
  }, [params]);
  const closeSettings = () => {
    setSettingsOpen(false);
    if (params.get('settings')) {
      params.delete('settings');
      setParams(params, { replace: true });
    }
  };
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
        <Button
          variant="secondary"
          icon="Settings2"
          onClick={() => {
            setSettingsOpen(true);
            setParams({ settings: '1' }, { replace: true });
          }}
        >
          Account settings
        </Button>
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
      {settingsOpen && (
        <Modal title="Account settings" onClose={closeSettings} wide>
          <AccountSettings embedded />
        </Modal>
      )}
    </>
  );
}
