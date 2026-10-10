import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { backendPost } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { useSession } from '../session';

export function VerifyEmail() {
  const [token] = useState(() => window.location.hash.slice(1));
  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname);
  }, []);
  const [message, setMessage] = useState('Confirm your email to complete verification.');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const { signedIn, reloadAuth } = useSession();
  return (
    <main className="email-verification-page card">
      <h1>Verify your email</h1>
      <p role="status">{message}</p>
      {!verified && (
        <Button
          disabled={busy || !token}
          onClick={async () => {
            setBusy(true);
            try {
              await backendPost('/auth/verify-email', { token });
              setVerified(true);
              setMessage('Your email is verified.');
              if (signedIn) await reloadAuth();
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Verification failed.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Verifying…' : 'Confirm email'}
        </Button>
      )}
      {!token && !verified && (
        <p>
          Open the full verification link from your email, or request a new one in account settings.
        </p>
      )}
      <p>
        <Link to={signedIn ? '/app/settings' : '/login'}>
          {signedIn ? 'Account settings' : 'Sign in'}
        </Link>
      </p>
    </main>
  );
}
