// Service Worker: macht die App installierbar und startet sie auch ohne Netz.
// Strategie „erst Netz, dann Zwischenspeicher“: Neue Versionen kommen sofort an,
// offline wird die zuletzt geladene Version gezeigt.

const SPEICHER = 'wir-zwei-v1';
const GRUNDGERUEST = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/hilfen.js',
  './js/inhalte.js',
  './js/konfig.js',
  './js/daten-demo.js',
  './js/daten-supabase.js',
  './icons/icon.svg',
  './icons/icon-192.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(SPEICHER).then((c) => c.addAll(GRUNDGERUEST)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== SPEICHER).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  const anfrage = ev.request;
  // Nur eigene Dateien; Supabase und CDN laufen ungestört am Service Worker vorbei.
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;
  ev.respondWith(
    fetch(anfrage)
      .then((antwort) => {
        const kopie = antwort.clone();
        caches.open(SPEICHER).then((c) => c.put(anfrage, kopie));
        return antwort;
      })
      .catch(() => caches.match(anfrage).then((treffer) => treffer ?? caches.match('./index.html'))),
  );
});
