import { useState } from 'react';
import { Avatar } from '../../../shared/ui/Avatar';
import { Button } from '../../../shared/ui/Button';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Field } from '../../../shared/ui/Field';
import { Icon } from '../../../shared/ui/Icon';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { formValues } from '../../../shared/ui/formValues';
import { useStore } from '../../../app/state/StoreProvider';

export function SettingsPage() {
  const { data, update, toast } = useStore();
  const [tab, setTab] = useState('Profile');
  return (
    <>
      <PageHeader
        eyebrow="MAKE YOURSELF AT HOME"
        title="Settings"
        description="The little details that make your workspace yours."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {[
            ['UserRound', 'Profile'],
            ['Bell', 'Notifications'],
            ['ShieldCheck', 'Workspace'],
          ].map(([icon, title]) => (
            <button
              key={title}
              className={tab === title ? 'active' : ''}
              onClick={() => setTab(title)}
            >
              <Icon name={icon} size={19} />
              {title}
            </button>
          ))}
        </nav>
        <section className="card settings-card">
          {tab === 'Profile' ? (
            <>
              <CardHeader title="Your profile" subtitle="Let your community know who you are." />
              <div className="profile-avatar">
                <Avatar name={data.profile.name} />
                <div>
                  <strong>{data.profile.name}</strong>
                  <p>{data.profile.role}</p>
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  const f = formValues(e);
                  update((d) => ({
                    ...d,
                    profile: { name: f.name.trim(), email: f.email.trim(), role: f.role },
                  }));
                  toast('Your profile is looking good. Changes saved.');
                }}
              >
                <Field label="Full name">
                  <input name="name" defaultValue={data.profile.name} required />
                </Field>
                <Field label="Email address">
                  <input name="email" type="email" defaultValue={data.profile.email} required />
                </Field>
                <Field label="Role">
                  <select name="role" defaultValue={data.profile.role}>
                    <option>Club president</option>
                    <option>Treasurer</option>
                    <option>Events lead</option>
                    <option>Volunteer</option>
                    <option>Member</option>
                  </select>
                </Field>
                <div className="form-footer">
                  <Button type="submit" icon="Check">
                    Save changes
                  </Button>
                </div>
              </form>
            </>
          ) : tab === 'Notifications' ? (
            <>
              <CardHeader
                title="Stay in the loop"
                subtitle="Choose what you would like to hear about."
              />
              {(
                [
                  ['email', 'Community announcements', 'Receive updates from your club.'],
                  [
                    'renewals',
                    'Membership reminders',
                    'A friendly reminder before membership expires.',
                  ],
                  ['weekly', 'Weekly roundup', 'Events and project updates, all in one place.'],
                ] as const
              ).map(([key, title, description]) => (
                <div className="switch-row" key={key}>
                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={data.preferences[key]}
                    aria-label={title}
                    className={`switch ${data.preferences[key] ? 'on' : ''}`}
                    onClick={() => {
                      update((d) => ({
                        ...d,
                        preferences: { ...d.preferences, [key]: !d.preferences[key] },
                      }));
                      toast('Notification preference saved.');
                    }}
                  >
                    <span />
                  </button>
                </div>
              ))}
              <p className="form-note">
                Preferences are saved locally. Automatic emails and scheduled reminders will need a
                connected backend.
              </p>
            </>
          ) : (
            <>
              <CardHeader
                title="Your shared workspace"
                subtitle="A simple home for the Skyline Student Association."
              />
              <dl className="detail-list">
                <div>
                  <dt>Organization</dt>
                  <dd>Skyline Student Association</dd>
                </div>
                <div>
                  <dt>Academic year</dt>
                  <dd>2026–2027</dd>
                </div>
                <div>
                  <dt>Annual dues</dt>
                  <dd>₹500</dd>
                </div>
                <div>
                  <dt>Currency</dt>
                  <dd>Indian Rupee (INR)</dd>
                </div>
                <div>
                  <dt>Data storage</dt>
                  <dd>This browser · local demo</dd>
                </div>
                <div>
                  <dt>Workspace access</dt>
                  <dd>Demonstration · no login required</dd>
                </div>
              </dl>
              <div className="info-banner">
                <Icon name="ShieldCheck" size={24} />
                <p>
                  This is a working frontend prototype. A production rollout needs a backend,
                  role-based access, email delivery, and a payment provider.
                </p>
              </div>
              <Button
                variant="secondary"
                icon="Download"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
                  );
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'skyline-workspace.json';
                  a.click();
                  URL.revokeObjectURL(url);
                  toast('Workspace backup downloaded.');
                }}
              >
                Download workspace data
              </Button>
            </>
          )}
        </section>
      </div>
    </>
  );
}
