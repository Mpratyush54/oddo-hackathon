self.addEventListener('push', (event) => {
  let message;
  try {
    message = event.data.json();
  } catch {
    return;
  }
  const path =
    typeof message.url === 'string' && message.url.startsWith('/app/')
      ? message.url
      : '/app/communications';
  const target = new URL(path, self.location.origin);
  if (typeof message.clubId === 'string')
    target.searchParams.set('notificationClub', message.clubId);
  event.waitUntil(
    self.registration.showNotification(String(message.title || 'Skyline'), {
      body: String(message.body || ''),
      tag: String(message.tag || 'skyline'),
      icon: '/favicon.svg',
      data: { url: target.href },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || '/app/communications',
    self.location.origin,
  );
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const client = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (client) {
        await client.navigate(target.href);
        return client.focus();
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
