import { useState } from 'react';
import { backendPost, cloudMode } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { useSession } from './session';

export function EmailVerificationNotice() {
  const { user, reloadAuth } = useSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Verify your email to confirm ownership of your account.');
  if (!cloudMode || user.emailVerified) return null;
  return (
    <aside className="email-verification-notice">
      <div>
        <strong>Email verification pending</strong>
        <p role="status">{message}</p>
      </div>
      <div className="users-actions">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await backendPost<{ message?: string; verified?: boolean }>(
                '/auth/verification',
                {},
              );
              if (result.verified) await reloadAuth();
              else setMessage(result.message || 'Check your inbox and spam folder.');
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Could not send email.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Sending…' : 'Send verification email'}
        </Button>
        <Button variant="secondary" onClick={() => void reloadAuth()}>
          Refresh status
        </Button>
      </div>
    </aside>
  );
}
