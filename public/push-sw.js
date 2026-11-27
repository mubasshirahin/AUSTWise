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

  // Per-category look: a vibration
  // rhythm people learn to recognise, and whether the alert stays until seen.
  var STYLES = {
    messages:     { vibrate: [120, 60, 120],           sticky: false, open: 'Reply' },
    notices:      { vibrate: [250, 120, 250],          sticky: true,  open: 'Read notice' },
    results:      { vibrate: [300, 120, 300, 120, 300], sticky: true,  open: 'View result' },
    applications: { vibrate: [200, 100, 200],          sticky: false, open: 'Review' },
    gaming:       { vibrate: [80, 50, 80, 50, 160],     sticky: false, open: 'Open' },
  };

  self.addEventListener('push', function (event) {
    var data = parsePayload(event);
    var style = STYLES[data.category] || { vibrate: [200, 100, 200], sticky: false, open: 'Open' };
    var title = data.title || 'AUSTWise';
    var silent = data.silent === true;
    var options = {
      body: data.body || '',
      icon: data.icon || '/icon-192x192.png',
      // Android draws the badge as a white silhouette in the status bar.
      badge: '/notification-badge.png',
      tag: data.tag || 'austwise',
      renotify: !silent,
      silent: silent,
      vibrate: silent ? [] : (Array.isArray(data.vibrate) && data.vibrate.length ? style.vibrate : []),
      requireInteraction: data.requireInteraction != null ? Boolean(data.requireInteraction) : style.sticky,
      timestamp: data.timestamp || Date.now(),
      lang: 'en',
      dir: 'auto',
      actions: [
        { action: 'open', title: style.open },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      data: { url: data.url || '/', category: data.category || '' },
    };
    if (data.image) options.image = data.image;
    event.waitUntil(
      (data.skipIfVisible ? hasVisibleClient() : Promise.resolve(false)).then(function (visible) {
        // The open app already shows it (e.g. the chat you are reading).
        if (visible) return undefined;
        return self.registration.showNotification(title, options);
      })
    );
  });

  // Pages report whether they run as the installed app (standalone) or in a
  // browser tab, so a notification tap goes to the app window, not a tab.
  var standaloneClients = new Set();
  self.addEventListener('message', function (event) {
    var msg = event.data;
    if (!msg || msg.type !== 'austwise-display-mode' || !event.source) return;
    if (msg.standalone) standaloneClients.add(event.source.id);
    else standaloneClients.delete(event.source.id);
  });

  self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    if (event.action === 'dismiss') return;
    var url = (event.notification.data && event.notification.data.url) || '/';
    var target = new URL(url, self.location.origin).href;
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
        var app = null;
        for (var i = 0; i < clients.length; i += 1) {
          if (standaloneClients.has(clients[i].id)) { app = clients[i]; break; }
        }
        if (app) {
          if (app.url === target) return app.focus();
          return app.focus().then(function (w) { return (w || app).navigate(target); }).catch(function () {
            return self.clients.openWindow(target);
          });
        }
        // No known app window: let the OS open the link. On Android with the
        // app installed this launches the installed app, not a browser tab.
        // Only reuse a browser tab when no tab-vs-app info was ever reported
        // and a tab already shows this exact page.
        for (var j = 0; j < clients.length; j += 1) {
          if (clients[j].url === target && 'focus' in clients[j] && standaloneClients.size === 0) {
            return clients[j].focus();
          }
        }
        return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
      })
    );
  });
})();
