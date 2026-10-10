import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Icon } from '../../../shared/ui/Icon';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { useStore } from '../../../app/state/StoreProvider';
import { roleLabels, useSession } from '../../auth/session';
import { backendPost, cloudMode } from '../../../shared/api/client';

type Health = {
  ai: { configured: boolean; provider: string };
  whatsapp: { configured: boolean; template: string };
};

const TABS = [
  ['Bell', 'Preferences'],
  ['UserRound', 'Account'],
  ['ShieldCheck', 'Integrations'],
] as const;

export function AccountSettings({ embedded = false }: { embedded?: boolean } = {}) {
  const { data, update, toast } = useStore();
  const { user, role, can, clubId } = useSession();
  const [tab, setTab] = useState<(typeof TABS)[number][1]>('Preferences');
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const base =
        (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL || '/api';
      const response = await fetch(`${base}/health`);
      if (!response.ok) throw new Error();
      setHealth(await response.json());
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const backup = () => {
    const records = can('manage_members')
      ? data
      : can('view_finance')
        ? { transactions: data.transactions, audit: data.audit }
        : {
            memberships: data.members.filter((m) => m.email === user.email),
            tickets: data.tickets.filter((t) => t.email === user.email),
            orders: data.orders.filter((o) => o.name === user.name),
            tasks: data.tasks.filter((t) => t.assignee === user.name),
          };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `skyline-${clubId}-${role}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Your permitted workspace records have been exported.');
  };

  const panel = (
    <>
      {tab === 'Preferences' ? (
        <>
          {embedded ? (
            <header className="settings-panel-head">
              <h3>Notifications</h3>
              <p>Applies to the selected club on this device.</p>
            </header>
          ) : (
            <CardHeader
              title="Stay in the loop"
              subtitle="Preferences apply to the selected club on this device."
            />
          )}
          <div className="settings-switch-list">
            {(
              [
                ['email', 'Community announcements', 'Email updates from your community.'],
                ['renewals', 'Membership reminders', 'A nudge before membership runs out.'],
                ['events', 'Event reminders', 'A reminder before your booked event starts.'],
                ['weekly', 'Weekly roundup', 'Events and community projects in one digest.'],
              ] as const
            ).map(([key, title, description]) => (
              <div className="switch-row" key={key}>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={data.preferences[key] ?? key === 'events'}
                  aria-label={title}
                  className={`switch ${(data.preferences[key] ?? key === 'events') ? 'on' : ''}`}
                  onClick={() => {
                    update((d) => ({
                      ...d,
                      preferences: {
                        ...d.preferences,
                        [key]: !(d.preferences[key] ?? key === 'events'),
                      },
                    }));
                    toast('Preference saved for this club.');
                  }}
                >
                  <span />
                </button>
              </div>
            ))}
          </div>
          {embedded ? (
            <p className="settings-quiet-note">
              WhatsApp number and message consent are managed on your profile below this dialog.
            </p>
          ) : (
            <div className="info-banner">
              <Icon name="Megaphone" />
              <p>
                Manage your WhatsApp number and explicit message consent in{' '}
                <Link className="text-link" to="/app/profile">
                  My profile
                </Link>
                . Automatic schedules will require the AWS backend.
              </p>
            </div>
          )}
        </>
      ) : tab === 'Account' ? (
        <>
          {embedded ? (
            <header className="settings-panel-head">
              <h3>Your account</h3>
              <p>Role, sign-in, and a personal export.</p>
            </header>
          ) : (
            <CardHeader
              title="Your campus identity"
              subtitle="A different responsibility should have a different view."
            />
          )}
          <div className="profile-avatar">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <p>{user.email}</p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Current role</dt>
              <dd>{roleLabels[role]}</dd>
            </div>
            <div>
              <dt>Account mode</dt>
              <dd>{cloudMode ? 'Campus account' : 'Seeded demo persona'}</dd>
            </div>
            <div>
              <dt>Data storage</dt>
              <dd>{cloudMode ? 'AWS DynamoDB · club-scoped' : 'This browser · club-scoped'}</dd>
            </div>
          </dl>
          <p className="form-note">
            {cloudMode
              ? 'Your account uses secure JWT sessions. Campus administrators assign staff roles.'
              : 'Use the account menu to explore another demo persona. Profile edits do not grant staff permissions.'}
          </p>
          {cloudMode && (
            <form
              className="settings-password-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const element = event.currentTarget;
                setPasswordBusy(true);
                try {
                  await backendPost('/auth/password', {
                    currentPassword: form.get('currentPassword'),
                    password: form.get('password'),
                  });
                  element.reset();
                  toast('Password changed. Other sessions have been signed out.');
                } catch (error) {
                  toast(error instanceof Error ? error.message : 'Password change failed.');
                } finally {
                  setPasswordBusy(false);
                }
              }}
            >
              <label>
                Current password
                <input
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <Button type="submit" disabled={passwordBusy}>
                {passwordBusy ? 'Saving…' : 'Change password'}
              </Button>
            </form>
          )}
          <div className="form-footer">
            {!embedded && (
              <Link to="/app/profile" className="button secondary">
                <Icon name="UserRound" size={17} />
                Open my profile
              </Link>
            )}
            <Button icon="Download" variant="secondary" onClick={backup}>
              Export my records
            </Button>
          </div>
        </>
      ) : (
        <>
          {embedded ? (
            <header className="settings-panel-head">
              <h3>Connections</h3>
              <p>Provider status only — secrets stay on the server.</p>
            </header>
          ) : (
            <CardHeader
              title="Connected when you’re ready"
              subtitle="Your provider secrets are kept on the server."
            />
          )}
          <div className="settings-integration-list">
            {[
              [
                'OpenRouter free AI',
                health?.ai.configured,
                'Announcement drafts, reviewed before publishing.',
              ],
              [
                'Meta WhatsApp test API',
                health?.whatsapp.configured,
                'Verified test recipients and an approved template.',
              ],
              [
                'AWS shared workspace',
                cloudMode,
                cloudMode
                  ? 'Shared data in DynamoDB with a private API.'
                  : 'Available through the AWS deployment.',
              ],
            ].map(([title, configured, description]) => (
              <div className="integration-setting" key={String(title)}>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
                <Badge tone={configured ? 'green' : 'gold'}>
                  {configured
                    ? 'Configured'
                    : title === 'AWS shared workspace'
                      ? 'Not deployed'
                      : 'Setup needed'}
                </Badge>
              </div>
            ))}
          </div>
          <p className="form-note">
            OpenRouter and Meta credentials go in the local .env file. This view never exposes
            provider secrets to the browser.
          </p>
          <div className="form-footer">
            <Button
              variant="secondary"
              icon="ArrowDownUp"
              disabled={loading}
              onClick={() => void refresh()}
            >
              {loading ? 'Checking…' : 'Refresh connections'}
            </Button>
          </div>
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="settings-sheet">
        <div
          className="segmented settings-sheet-tabs"
          role="tablist"
          aria-label="Settings sections"
        >
          {TABS.map(([icon, title]) => (
            <button
              key={title}
              type="button"
              role="tab"
              aria-selected={tab === title}
              className={tab === title ? 'selected' : ''}
              onClick={() => setTab(title)}
            >
              <Icon name={icon} size={15} />
              {title}
            </button>
          ))}
        </div>
        <section className="settings-sheet-panel">{panel}</section>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="YOUR ACCOUNT"
        title="Settings"
        description="Preferences for this club, sign-in details, and workspace export."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {TABS.map(([icon, title]) => (
            <button
              key={title}
              className={tab === title ? 'active' : ''}
              onClick={() => setTab(title)}
            >
              <Icon name={icon} size={18} />
              {title}
            </button>
          ))}
        </nav>
        <section className="card settings-card">{panel}</section>
      </div>
    </>
  );
}
