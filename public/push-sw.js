/**
 * Web Push handlers for AUSTWise.
 * Loaded by the Workbox-generated service worker via `workbox.importScripts`.
 * Keep this dependency-free — it runs in the SW scope, not in the page.
 */
(function () {
  function parsePayload(event) {
    if (!event.data) return {};
    try {
      return typeof event.data.json === 'function' ? event.data.json() : JSON.parse(event.data.text());
    } catch {
      return { body: String(event.data.text ? event.data.text() : '') };
    }
  }

  self.addEventListener('push', function (event) {
    var data = parsePayload(event);
    var title = data.title || 'AUSTWise';
    var options = {
      body: data.body || '',
      icon: data.icon || '/austwise_icon_final.svg',
      badge: '/austwise_icon_final.svg',
      tag: data.tag || 'austwise',
      renotify: true,
      data: { url: data.url || '/' },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  });

  self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    var url = (event.notification.data && event.notification.data.url) || '/';
    var target = new URL(url, self.location.origin).href;
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
        for (var i = 0; i < clients.length; i += 1) {
          var client = clients[i];
          if (client.url === target && 'focus' in client) return client.focus();
        }
        return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
      })
    );
  });
})();
