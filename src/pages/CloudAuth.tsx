import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Field, Logo } from '../components';
import { backendPost } from '../backend';
import { useSession } from '../session';

export function CloudAuth({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const navigate = useNavigate(),
    [params] = useSearchParams(),
    { reloadAuth } = useSession();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const target = params.get('returnTo');
  const returnTo =
    target?.startsWith('/') && !target.startsWith('//') && !target.includes('\\') ? target : '/app';
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
        <Link to="/events">← Keep exploring events</Link>
      </aside>
      <main>
        <Badge>Campus account</Badge>
        <h1>{mode === 'signup' ? 'Join your campus' : 'Welcome back'}</h1>
        <p>
          {mode === 'signup'
            ? 'Create your account, then join a club in your workspace.'
            : 'Sign in to your clubs, tickets and requests.'}
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            setError('');
            try {
              await backendPost(`/auth/${mode}`, {
                name: form.get('name'),
                email: form.get('email'),
                password: form.get('password'),
              });
              await reloadAuth();
              navigate(returnTo);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Sign-in failed.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === 'signup' && (
            <Field label="Your name">
              <input name="name" autoComplete="name" required minLength={2} maxLength={80} />
            </Field>
          )}
          <Field label="Email address">
            <input type="email" name="email" autoComplete="email" required maxLength={254} />
          </Field>
          <Field
            label="Password"
            hint={mode === 'signup' ? 'Use at least 12 characters.' : undefined}
          >
            <input
              type="password"
              name="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'signup' ? 12 : 1}
              maxLength={128}
            />
          </Field>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="full-width">
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>
        </form>
        <p>
          {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
          <Link
            className="text-link"
            to={`${mode === 'signup' ? '/login' : '/signup'}?returnTo=${encodeURIComponent(returnTo)}`}
          >
            {mode === 'signup' ? 'Sign in' : 'Create account'}
          </Link>
        </p>
        <Link className="text-link" to="/events">
          Browse campus events →
        </Link>
      </main>
    </div>
  );
}
