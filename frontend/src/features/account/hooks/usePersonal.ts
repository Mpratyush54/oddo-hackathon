import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';

export function usePersonal() {
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
