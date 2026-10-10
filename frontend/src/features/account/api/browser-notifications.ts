import { backendPost } from '../../../shared/api/client';
export async function disableBrowserNotifications() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    try {
      await backendPost('/notifications/browser/disable', { endpoint: subscription.endpoint });
    } finally {
      await subscription.unsubscribe();
    }
  }
}
