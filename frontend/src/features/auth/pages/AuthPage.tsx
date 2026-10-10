import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar } from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { Icon } from '../../../shared/ui/Icon';
import { Logo } from '../../../shared/ui/Logo';
import { useSession } from '../session';
import { cloudMode } from '../../../shared/api/client';
import { CloudAuth } from './CloudAuth';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { roles } from '../config/roles';

export function AuthPage({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  return cloudMode ? <CloudAuth mode={mode} /> : <DemoAuthPage mode={mode} />;
}

export function DemoAuthPage({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const { switchPersona } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [selectedRole, setSelectedRole] = useState<(typeof roles)[number]['role']>('member');
  const requested = params.get('returnTo');
  const returnTo =
    requested?.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\')
      ? requested
      : null;
  const selected = roles.find((role) => role.role === selectedRole)!;
  return (
    <div className="portal-auth streamlined-auth">
      <aside>
        <Logo />
        <span className="portal-kicker">YOUR CAMPUS, CONNECTED</span>
        <h1>
          Make plans.
          <br />
          Meet people.
          <br />
          <em>Show up.</em>
        </h1>
        <p>Your events, tickets and community in one place.</p>
        <div className="portal-auth-proof">
          <div className="avatar-stack">
            {['Alex Morgan', 'Priya Sharma', 'Jordan Lee', 'Aisha Patel'].map((n, i) => (
              <Avatar key={n} name={n} index={i} small />
            ))}
          </div>
          <div>
            <strong>120+ active student leaders</strong>
            <small style={{ display: 'block', color: '#9fb8a4', marginTop: '2px' }}>
              Organizing events & managing clubs today
            </small>
          </div>
        </div>
        <div className="auth-testimonial-card">
          <Icon name="Quote" size={18} />
          <p>
            "Skyline replaced three spreadsheets and an email list for our club. Everything just
            works."
          </p>
          <small>— Priya Sharma, Skyline Lead Organizer</small>
        </div>
        <Link to="/events">← Keep exploring events</Link>
      </aside>
      <main>
        <Badge tone="gold">Demo workspace</Badge>
        <h1>{mode === 'signup' ? 'Try your campus workspace' : 'Welcome back'}</h1>
        <p>
          {returnTo
            ? 'Continue to your selected event or item after choosing a demo view.'
            : 'Select your role or persona below to instantly experience the tailored workspace.'}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            switchPersona(selectedRole);
            navigate(selectedRole === 'college' ? '/app/college' : returnTo || '/app');
          }}
        >
          <div className="auth-persona-selector">
            <label className="field-label">Select persona & role</label>
            <div className="auth-role-grid" role="radiogroup" aria-label="Select demo role">
              {roles.map((role) => {
                const isSelected = selectedRole === role.role;
                return (
                  <button
                    key={role.role}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`auth-role-tile ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedRole(role.role)}
                  >
                    <span className="icon-tile">
                      <Icon name={role.icon} />
                    </span>
                    <div className="auth-role-tile-info">
                      <strong>{role.title}</strong>
                      <small>{role.text}</small>
                    </div>
                    {isSelected && (
                      <span className="auth-role-check">
                        <Icon name="Check" size={16} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="auth-demo-credentials">
            <Field label="Active Persona Email (Demo Mode)">
              <input
                type="text"
                readOnly
                value={
                  selectedRole === 'member'
                    ? 'alex@skyline.edu'
                    : selectedRole === 'organizer'
                      ? 'priya@skyline.edu'
                      : selectedRole === 'treasurer'
                        ? 'jordan@skyline.edu'
                        : selectedRole === 'college'
                          ? 'admin@campus.edu'
                          : 'president@skyline.edu'
                }
              />
            </Field>
          </div>

          <Button type="submit" icon="ArrowRight" className="full-width">
            Continue as {selected.title}
          </Button>
        </form>
        <p className="login-demo-note">
          This opens a seeded demo persona. Real account authentication is not connected; changes
          are saved on this device.
        </p>
        <Link className="text-link" to="/events">
          Browse events without signing in <Icon name="ArrowUpRight" size={16} />
        </Link>
      </main>
    </div>
  );
}
