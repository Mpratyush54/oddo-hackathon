import { Link } from 'react-router-dom';
import { Badge } from '../../../shared/ui/Badge';
import { Icon } from '../../../shared/ui/Icon';
import { useSession } from '../../auth/session';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { usePersonal } from '../../account/hooks/usePersonal';

export function MemberPreview() {
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
