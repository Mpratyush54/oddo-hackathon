import { useEffect, useState } from 'react';
import { backendPost, backendRequest, cloudMode } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import { disableBrowserNotifications } from '../api/browser-notifications';
type Settings = { configured: boolean; publicKey: string; subscriptions: { endpoint: string }[] };
export function BrowserNotifications() {
  const { toast } = useStore();
  const { user } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  useEffect(() => {
    let active = true;
    setEnabled(false);
    setError('');
    if (!cloudMode || !supported) return;
    void backendRequest<Settings>('/notifications/browser')
      .then(async (result) => {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        if (active) {
          setSettings(result);
          setEnabled(
            !!subscription &&
              result.subscriptions.some((s) => s.endpoint === subscription.endpoint),
          );
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [supported, user.id]);
  async function enable() {
    if (!settings || busy) return;
    setBusy(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted')
        throw new Error(
          'Notifications are blocked. Allow them in your browser’s site settings, then try again.',
        );
      const registration = await navigator.serviceWorker.register('/notifications-sw.js');
      await navigator.serviceWorker.ready;
      const bytes = Uint8Array.from(
        atob(settings.publicKey.replaceAll('-', '+').replaceAll('_', '/')),
        (character) => character.charCodeAt(0),
      );
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes.buffer,
        }));
      await backendPost('/notifications/browser', subscription.toJSON());
      setEnabled(true);
      toast('Browser notifications enabled for this account on this device.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not enable browser notifications.');
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    setError('');
    try {
      await disableBrowserNotifications();
      setEnabled(false);
      toast('Browser notifications disabled on this device.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not disable notifications.');
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    setError('');
    try {
      const subscription = await (
        await navigator.serviceWorker.getRegistration('/')
      )?.pushManager.getSubscription();
      const result = await backendPost<{ status: string; detail: string }>(
        '/notifications/browser/test',
        { endpoint: subscription?.endpoint },
      );
      toast(result.detail);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Notification test failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="portal-panel">
      <CardHeader
        title="Browser notifications"
        subtitle="Event reminders and club updates on this device."
      />
      <p>
        {!cloudMode
          ? 'Browser push requires the connected AWS app.'
          : !supported
            ? 'This browser does not support push notifications. On iPhone or iPad, add the website to your Home Screen and open it there.'
            : enabled
              ? 'Enabled. You can receive updates even when this page is closed, subject to your browser and device settings.'
              : 'Enable notifications to receive club updates and reminders. Your browser will ask for permission.'}
      </p>
      {cloudMode && supported && (
        <div className="success-actions">
          <Button onClick={enabled ? disable : enable} disabled={busy || !settings?.configured}>
            {busy
              ? 'Saving…'
              : enabled
                ? 'Disable browser notifications'
                : 'Enable browser notifications'}
          </Button>
          {enabled && (
            <Button variant="secondary" disabled={busy} onClick={test}>
              Send test notification
            </Button>
          )}
        </div>
      )}
      {settings && !settings.configured && <p>Browser push setup is pending on the server.</p>}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
