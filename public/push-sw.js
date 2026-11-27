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

  // The sender's profile photo, fetched with this user's session (the avatar
  // route needs sign-in) and handed to the notification as a data: URL.
  // Any failure just drops the photo; the alert itself always shows.
  function loadIcon(url) {
    if (!url) return Promise.resolve(null);
    var timeout = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 3000); });
    var load = fetch(url, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) return null;
      var type = res.headers.get('Content-Type') || 'image/png';
      if (type.indexOf('image/') !== 0) return null;
      return res.arrayBuffer().then(function (buf) {
        if (buf.byteLength > 300000) return null;
        var bytes = new Uint8Array(buf);
        var bin = '';
        for (var i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return 'data:' + type + ';base64,' + btoa(bin);
      });
    }).catch(function () { return null; });
    return Promise.race([load, timeout]);
  }

  self.addEventListener('push', function (event) {
    var data = parsePayload(event);
    var style = STYLES[data.category] || { vibrate: [200, 100, 200], sticky: false, open: 'Open' };
    var title = data.title || 'AUSTWise';
    var silent = data.silent === true;
    var options = {
      body: data.body || '',
      // No fallback icon: Android already shows the AUSTWise app icon, so
      // the large icon is only the sender's photo (logo shown once).
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
    // Attendance prompt: answer right from the notification.
    if (data.attendance && data.attendance.token) {
      options.actions = [
        { action: 'present', title: '✅ Present' },
        { action: 'absent', title: '❌ Absent' },
      ];
      options.data.attendance = data.attendance;
    }
    if (data.image) options.image = data.image;
    event.waitUntil(
      (data.skipIfVisible ? hasVisibleClient() : Promise.resolve(false)).then(function (visible) {
        // The open app already shows it (e.g. the chat you are reading).
        if (visible) return undefined;
        return loadIcon(data.icon).then(function (icon) {
          if (icon) options.icon = icon;
          return self.registration.showNotification(title, options);
        });
      })
    );
  });

  // Pages report whether they run as the installed app (standalone) or in a
  // browser tab, so a notification tap goes to the app window, not a tab.
  // Persisted in Cache Storage: the worker is often stopped between the
  // report and the tap, which would wipe an in-memory list.
  var standaloneClients = new Set();
  var browserClients = new Set();
  var MODE_CACHE = 'austwise-display-modes';
  var MODE_KEY = '/__display-modes__';
  var modesLoaded = null;
  function loadModes() {
    if (!modesLoaded) {
      modesLoaded = caches.open(MODE_CACHE).then(function (c) { return c.match(MODE_KEY); }).then(function (res) {
        return res ? res.json() : null;
      }).then(function (saved) {
        (saved && saved.app || []).forEach(function (id) { standaloneClients.add(id); });
        (saved && saved.tab || []).forEach(function (id) { browserClients.add(id); });
      }).catch(function () {});
    }
    return modesLoaded;
  }
  function saveModes() {
    return caches.open(MODE_CACHE).then(function (c) {
      return c.put(MODE_KEY, new Response(JSON.stringify({
        app: Array.from(standaloneClients).slice(-20),
        tab: Array.from(browserClients).slice(-20),
      }), { headers: { 'Content-Type': 'application/json' } }));
    }).catch(function () {});
  }
  self.addEventListener('message', function (event) {
    var msg = event.data;
    if (!msg || msg.type !== 'austwise-display-mode' || !event.source) return;
    var id = event.source.id;
    event.waitUntil(loadModes().then(function () {
      if (msg.standalone) { standaloneClients.add(id); browserClients.delete(id); }
      else { browserClients.add(id); standaloneClients.delete(id); }
      return saveModes();
    }));
  });

  // Remember where a tap should land, for an app that is cold-started at its
  // home page (the page reads and clears this on boot).
  function rememberTarget(url) {
    return caches.open('austwise-pending-nav').then(function (cache) {
      return cache.put('/__pending-nav__', new Response(JSON.stringify({ url: url, at: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      }));
    }).catch(function () {});
  }

  // Send a Present / Absent answer, then say how it went. If Telegram (or
  // another device) answered first, the server refuses it as already marked.
  function answerAttendance(att, attended) {
    return fetch('/api/web-push/attendance', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: att.token, attended: attended }),
    }).then(function (res) { return res.json().catch(function () { return {}; }); })
      .catch(function () { return { status: 'offline' }; })
      .then(function (r) {
        var course = att.course || 'Class';
        var text;
        if (r.status === 'saved') text = course + ' marked ' + (attended ? 'Present' : 'Absent') + '.';
        else if (r.status === 'already') text = course + ' was already marked ' + (r.attended ? 'Present' : 'Absent') + '.';
        else if (r.status === 'expired') text = 'This attendance prompt has expired.';
        else if (r.status === 'offline') text = 'Could not reach AUSTWise. Mark it from the app.';
        else text = 'This attendance prompt is no longer valid.';
        return self.registration.showNotification('Attendance', {
          body: text,
          badge: '/notification-badge.png',
          tag: 'att-result',
          silent: true,
          data: { url: '/dashboard/attendance' },
        });
      });
  }

  self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    if (event.action === 'dismiss') return;
    var att = event.notification.data && event.notification.data.attendance;
    if (att && (event.action === 'present' || event.action === 'absent')) {
      event.waitUntil(answerAttendance(att, event.action === 'present'));
      return;
    }
    var url = (event.notification.data && event.notification.data.url) || '/';
    var target = new URL(url, self.location.origin).href;
    event.waitUntil(
      loadModes().then(function () {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      }).then(function (clients) {
        var mine = clients.filter(function (c) { return c.url.indexOf(self.location.origin) === 0; });
        // Prefer the installed-app window. If the app was never seen on this
        // device (not installed), reuse an open browser tab. If it was seen
        // but isn't open now, let the OS open the link, which on Android
        // launches the installed app instead of a browser tab.
        var win = null;
        for (var i = 0; i < mine.length; i += 1) {
          if (standaloneClients.has(mine[i].id)) { win = mine[i]; break; }
        }
        if (!win && standaloneClients.size === 0 && mine.length) win = mine[0];
        if (win && 'focus' in win) {
          // The page's router opens the target (client.navigate() is
          // unreliable on Android and reloads the whole app).
          win.postMessage({ type: 'austwise-navigate', url: target });
          return rememberTarget(target).then(function () {
            return win.focus();
          }).catch(function () {
            return self.clients.openWindow(target);
          });
        }
        return rememberTarget(target).then(function () {
          return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
        });
      })
    );
  });
})();
