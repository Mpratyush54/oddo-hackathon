import { Link } from 'react-router-dom';
import { hasActiveMembership } from '../../../../../shared/membership.js';
import { Badge } from '../../../shared/ui/Badge';
import { Icon } from '../../../shared/ui/Icon';
import { today } from '../../../shared/utils/format';
import { useSession } from '../../auth/session';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { usePersonal } from '../../account/hooks/usePersonal';

export function MemberPreview() {
  const { user, member } = usePersonal();
  const { clubs, clubId } = useSession();
  const active = hasActiveMembership(member, today);
  const awaitingApproval = !!member && member.joinApproved === false;
  const label = active
    ? 'Active'
    : awaitingApproval
      ? 'Awaiting approval'
      : member
        ? 'Pay dues for card'
        : 'Not a member';
  return (
    <div className="portal-membership">
      <div>
        <span className="portal-kicker">{active ? 'YOUR CAMPUS PASS' : 'MEMBERSHIP'}</span>
        <h2>{clubs.find((c) => c.id === clubId)?.name}</h2>
        <p>{user.name}</p>
      </div>
      <div className="portal-membership-bottom">
        <Badge tone={active ? 'teal' : 'gold'}>{label}</Badge>
        <Link to="/app/my-card">
          {active ? 'View member card' : 'Open membership'} <Icon name="ArrowUpRight" size={18} />
        </Link>
      </div>
    </div>
  );
}
