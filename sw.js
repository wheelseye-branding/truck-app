/* WheelsEye Truck Branding — keeps the app on the phone so it opens without internet.
   Change VERSION whenever index.html / config.js change, so phones pick up the new copy. */
var VERSION = 'tb-app-v17';
var SHELL = ['./', './index.html', './config.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                       // data calls to Apps Script go straight to the network
  var url = new URL(req.url);

  // The app's own files: open from the phone at once, refresh the saved copy in the background.
  // Only the app page itself and its files — any other page (like admin/) goes straight to the network.
  if (url.origin === self.location.origin) {
    var scope = new URL(self.registration.scope).pathname;          // e.g. /truck-app/
    var isAppPage = url.pathname === scope || url.pathname === scope + 'index.html';
    var isAppFile = SHELL.some(function (f) { return f !== './' && url.pathname === scope + f.slice(2); });
    if (!isAppPage && !isAppFile) return;
    var key = isAppPage ? './index.html' : req;
    var isIcon = /\.png$/i.test(url.pathname);

    e.respondWith(caches.open(VERSION).then(function (c) {
      return c.match(key, { ignoreSearch: true }).then(function (hit) {
        // Icons: from the phone first (they almost never change)
        if (isIcon && hit) return hit;

        // Page, config, manifest: always the NEWEST version when there is internet
        // (waits up to 4 s for the network, then falls back to the saved copy)
        var net = fetch(req, { cache: 'no-store' }).then(function (res) {
          if (res && res.ok) c.put(key, res.clone());
          return res;
        });
        if (!hit) return net;
        var slow = new Promise(function (resolve) { setTimeout(function () { resolve(hit); }, 4000); });
        return Promise.race([net.catch(function () { return hit; }), slow]);
      });
    }));
    return;
  }

  // Google Fonts: keep a copy so the app looks the same offline
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION + '-fonts').then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { c.put(req, res.clone()); return res; });
      });
    }).catch(function () { return fetch(req); }));
  }
});
