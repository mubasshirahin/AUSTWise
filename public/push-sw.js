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

  // Is a window of this app open and on screen right now?
  function hasVisibleClient() {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      for (var i = 0; i < clients.length; i += 1) {
        if (clients[i].visibilityState === 'visible') return true;
      }
      return false;
    }).catch(function () { return false; });
  }

  self.addEventListener('push', function (event) {
    var data = parsePayload(event);
    var title = data.title || 'AUSTWise';
    var silent = data.silent === true;
    var options = {
      body: data.body || '',
      icon: data.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: data.tag || 'austwise',
      renotify: !silent,
      silent: silent,
      vibrate: silent ? [] : (Array.isArray(data.vibrate) && data.vibrate.length ? data.vibrate : [200, 100, 200]),
      timestamp: Date.now(),
      data: { url: data.url || '/' },
    };
    event.waitUntil(
      (data.skipIfVisible ? hasVisibleClient() : Promise.resolve(false)).then(function (visible) {
        // The open app already shows it (e.g. the chat you are reading).
        if (visible) return undefined;
        return self.registration.showNotification(title, options);
      })
    );
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
