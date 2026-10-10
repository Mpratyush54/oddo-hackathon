import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession, roleLabels } from '../../auth/session';
import type { Role } from '../../auth/session';
import type { Store } from '../../../shared/types/domain';
import { backendPost, backendRequest, cloudMode } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { Field } from '../../../shared/ui/Field';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { SearchField } from '../../../shared/ui/SearchField';

type ClubUser = {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  accessRole: Role;
  course: string;
  status: string;
  expires: string;
  role: string;
};
const emailSchema = z.email();
export function UsersPage() {
  const { clubId, user } = useSession();
  const { applyServerPatch, toast } = useStore();
  const [users, setUsers] = useState<ClubUser[]>([]);
  const [editing, setEditing] = useState<ClubUser | null>(null);
  const [removing, setRemoving] = useState<ClubUser | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const refresh = async () => {
    try {
      const result = await backendRequest<{ users: ClubUser[] }>(`/clubs/${clubId}/users`);
      setUsers(result.users);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load users.');
    }
  };
  useEffect(() => {
    setUsers([]);
    setEditing(null);
    setRemoving(null);
    setAdding(false);
    if (cloudMode) void refresh();
  }, [clubId]);
  const save = async (path: string, input: unknown) => {
    setBusy(true);
    setError('');
    try {
      const result = await backendPost<{ state: Store }>(`/clubs/${clubId}/users/${path}`, input);
      applyServerPatch(clubId, result.state);
      setEditing(null);
      setRemoving(null);
      await refresh();
      toast('Club user updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  };
  if (!cloudMode) return <p>User administration is available in the AWS workspace.</p>;
  return (
    <>
      <PageHeader
        eyebrow="CLUB MANAGEMENT"
        title="Users & access"
        description="Manage club roles, membership status and expiry. Staff must verify their email before promotion."
      />
      <div className="card users-card">
        <div className="users-toolbar">
          <SearchField placeholder="Search name or email" value={query} onChange={setQuery} />
          <Button
            icon="UserPlus"
            onClick={() => {
              setError('');
              setAdding(true);
            }}
          >
            Add registered user
          </Button>
        </div>
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Access role</th>
                <th>Membership</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()))
                .map((u) => (
                  <tr key={u.userId || u.email}>
                    <td>{u.name}</td>
                    <td>
                      {u.email}
                      <small className="user-email-status">
                        {u.emailVerified ? 'Verified' : 'Email not verified'}
                      </small>
                    </td>
                    <td>{roleLabels[u.accessRole]}</td>
                    <td>{u.status}</td>
                    <td>{u.expires}</td>
                    <td>
                      <div className="users-actions">
                        <Button
                          variant="secondary"
                          disabled={!u.userId}
                          onClick={() => {
                            setError('');
                            setEditing(u);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={!u.userId || u.userId === user.id}
                          onClick={() => {
                            setError('');
                            setRemoving(u);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!users.length && !error && <p>No users enrolled in this club yet.</p>}
      </div>
      {adding && (
        <Modal
          title="Add a registered user"
          description="The person must create a Skyline account first."
          onClose={() => {
            if (!busy) setAdding(false);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const email = String(new FormData(e.currentTarget).get('email') || '')
                .trim()
                .toLowerCase();
              if (!emailSchema.safeParse(email).success) {
                setError('Enter a valid email.');
                return;
              }
              setBusy(true);
              setError('');
              try {
                const found = await backendPost<
                  Pick<ClubUser, 'userId' | 'name' | 'email' | 'emailVerified'>
                >(`/clubs/${clubId}/users/lookup`, { email });
                setAdding(false);
                setEditing(
                  users.find((u) => u.userId === found.userId) || {
                    ...found,
                    accessRole: 'member',
                    course: 'Campus community',
                    status: 'Pending',
                    expires: new Date().toISOString().slice(0, 10),
                    role: 'Member',
                  },
                );
              } catch (err) {
                setError(err instanceof Error ? err.message : 'User not found.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Account email">
              <input name="email" type="email" required />
            </Field>
            {error && <p role="alert">{error}</p>}
            <Button type="submit" disabled={busy}>
              Find account
            </Button>
          </form>
        </Modal>
      )}
      {editing && (
        <Modal
          title={`Manage ${editing.name}`}
          description={editing.email}
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save('update', {
                userId: editing.userId,
                role: f.get('accessRole'),
                status: f.get('status'),
                course: f.get('course'),
                expires: f.get('expires'),
                memberRole: f.get('memberRole'),
              });
            }}
          >
            <Field
              label="Access role"
              hint="Club roles: student, organizer, treasurer, admin. College admin is campus-wide."
            >
              <select name="accessRole" defaultValue={editing.accessRole}>
                {(['member', 'organizer', 'treasurer', 'admin', 'college'] as Role[]).map((r) => (
                  <option key={r} value={r} disabled={r === 'college'}>
                    {roleLabels[r]}
                    {r === 'college' ? ' — campus grant only' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Membership status">
              <select name="status" defaultValue={editing.status}>
                {['Pending', 'Active', 'Expiring', 'Expired'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Membership type">
              <select
                name="memberRole"
                defaultValue={
                  [
                    'Member',
                    'Volunteer',
                    'Events lead',
                    'Treasurer',
                    'President',
                  ].includes(editing.role)
                    ? editing.role
                    : 'Member'
                }
              >
                <option>Member</option>
                <option>Volunteer</option>
                <option>Events lead</option>
                <option>Treasurer</option>
                <option>President</option>
              </select>
            </Field>
            <Field label="Course">
              <input name="course" defaultValue={editing.course} required maxLength={120} />
            </Field>
            <Field label="Expires">
              <input name="expires" type="date" defaultValue={editing.expires} required />
            </Field>
            <p>Activating membership here waives dues. No payment is recorded.</p>
            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save user'}
            </Button>
          </form>
        </Modal>
      )}
      {removing && (
        <Modal
          title="Remove club access?"
          description={`Remove ${removing.name} from this club? Their account and historical tickets and payments are retained. They may join again as a member.`}
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
        >
          {error && <p role="alert">{error}</p>}
          <div className="users-actions">
            <Button variant="secondary" disabled={busy} onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() => void save('remove', { userId: removing.userId })}
            >
              Remove from club
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
