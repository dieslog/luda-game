// Service worker: makes the game installable and playable offline.
//
// Strategy: network-first for same-origin GETs (so a normal visit, and any
// code change while developing, always gets the fresh files) with the cache as
// the fallback when the network is unavailable. Bump CACHE when the file list
// changes.
var CACHE = 'luda-v1';

var ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './css/main.css',
    './js/util.js',
    './js/rng.js',
    './js/storage.js',
    './js/settings.js',
    './js/audio.js',
    './js/confetti.js',
    './js/board.js',
    './js/timer.js',
    './js/score.js',
    './js/stats.js',
    './js/achievements.js',
    './js/feedback.js',
    './js/hud.js',
    './js/preview.js',
    './js/game.js',
    './js/victory.js',
    './js/menu.js',
    './js/main.js',
    './audio/close.mp3',
    './audio/remove.mp3',
    './images/favicon.png',
    './images/icon-180.png',
    './images/icon-192.png',
    './images/icon-512.png',
    './images/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE).then(function (cache) {
            // best effort: one missing file must not break the install
            return Promise.all(ASSETS.map(function (url) {
                return cache.add(url).catch(function () { /* ignore */ });
            }));
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.filter(function (k) {
                return k !== CACHE;
            }).map(function (k) {
                return caches.delete(k);
            }));
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
        return;
    }
    event.respondWith(
        fetch(req).then(function (res) {
            if (res && res.ok) {
                var copy = res.clone();
                caches.open(CACHE).then(function (cache) {
                    cache.put(req, copy);
                });
            }
            return res;
        }).catch(function () {
            return caches.match(req).then(function (hit) {
                return hit || caches.match('./index.html');
            });
        })
    );
});
