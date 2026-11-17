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
        // Android draws only the badge's alpha channel: a white fox glyph on transparent
        badge: '/badge-96x96.png',
        tag: `${payload.type || 'melding'}-${payload.id || Date.now()}`,
        requireInteraction: !!payload.urgent,
        // "Happy hour voorbij" (non-urgent) and "weer huntbaar" are quiet
        silent: payload.type === 'hunt-cooldown' || (payload.type === 'happy-hour' && payload.urgent === false),
        // type (and articleId once the server sends it) let the app open what was tapped (notificationclick below)
        data: { url: payload.url || '/', type: payload.type, articleId: payload.data && payload.data.articleId },
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
      if (existing) {
        // The open app routes it like a toast's "Openen" (Layout.tsx): the Hints page on a phone, the Intel window on a laptop
        existing.postMessage({ type: 'notification-click', data: event.notification.data || {} });
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
