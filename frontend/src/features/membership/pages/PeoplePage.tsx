import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../auth/session';
import { UsersPage } from '../../admin/pages/UsersPage';
import { MembersPage } from './MembersPage';

export function PeoplePage() {
  const { clubId } = useSession();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'access' ? 'access' : 'members';
  const setView = (next: 'members' | 'access') => {
    const updated = new URLSearchParams(params);
    if (next === 'access') updated.set('view', 'access');
    else updated.delete('view');
    setParams(updated, { replace: true });
  };
  return (
    <>
      <div className="segmented people-view-tabs" role="tablist" aria-label="People views">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'members'}
          className={view === 'members' ? 'selected' : ''}
          onClick={() => setView('members')}
        >
          Members
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'access'}
          className={view === 'access' ? 'selected' : ''}
          onClick={() => setView('access')}
        >
          Users & access
        </button>
      </div>
      {view === 'access' ? <UsersPage key={clubId} /> : <MembersPage />}
    </>
  );
}
