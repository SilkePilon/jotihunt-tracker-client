/* Push handling, imported into the generated Workbox service worker (vite.config.ts → workbox.importScripts). */

const IOS = /iPad|iPhone|iPod/.test(self.navigator.userAgent);

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // A focused app plays the sound and shows a toast itself. iOS revokes subscriptions whose pushes show
      // nothing, so there a notification is always shown.
      if (!IOS && windows.some((client) => client.focused)) return;
      await self.registration.showNotification(payload.title || 'Jotihunt Tracker', {
        body: payload.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        tag: `${payload.type || 'melding'}-${payload.id || Date.now()}`,
        requireInteraction: !!payload.urgent,
        data: { url: payload.url || '/' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => client.url.startsWith(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })(),
  );
});
