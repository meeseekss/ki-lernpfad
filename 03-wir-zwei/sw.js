// Service Worker: macht die App installierbar und startet sie auch ohne Netz.
// Strategie „erst Netz, dann Zwischenspeicher“: Neue Versionen kommen sofort an,
// offline wird die zuletzt geladene Version gezeigt.

const SPEICHER = 'wir-zwei-v6';
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
  './js/kamera.js',
  './js/vendor/supabase-2.45.4.js',
  './icons/icon.svg',
  './icons/icon-192.png',
];

self.addEventListener('install', (ev) => {
  // cache: 'reload' holt jede Datei frisch vom Server, damit im Speicher garantiert eine
  // zusammenpassende Version liegt (keine Mischung aus alten und neuen Dateien).
  ev.waitUntil(
    caches.open(SPEICHER)
      .then((c) => c.addAll(GRUNDGERUEST.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== SPEICHER).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// ── Push-Mitteilungen: kommen von der Supabase-Funktion „push“.
self.addEventListener('push', (ev) => {
  let daten = {};
  try { daten = ev.data?.json() ?? {}; } catch { daten = { text: ev.data?.text() }; }
  ev.waitUntil(self.registration.showNotification(daten.titel || 'Wir zwei', {
    body: daten.text || 'Es gibt etwas Neues.',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: daten.art || 'wir-zwei', // gleiche Art ersetzt die alte Mitteilung statt zu stapeln
    renotify: true,
    data: { ziel: daten.ziel || './' },
  }));
});

// Tippen auf die Mitteilung öffnet die App an der passenden Stelle.
self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  const ziel = new URL(ev.notification.data?.ziel || './', self.registration.scope).href;
  ev.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const f of fenster) {
      if ('focus' in f) {
        await f.focus();
        if ('navigate' in f) await f.navigate(ziel).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(ziel);
  })());
});

self.addEventListener('fetch', (ev) => {
  const anfrage = ev.request;
  // Nur eigene Dateien; Supabase und CDN laufen ungestört am Service Worker vorbei.
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;
  ev.respondWith(
    // cache: 'no-cache' fragt immer beim Server nach, ob es eine neue Version gibt
    // (sonst liefert der Browser bis zu 10 Minuten lang die alte Datei von GitHub Pages).
    fetch(anfrage.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((antwort) => {
        // Nur einwandfreie Antworten merken – keine Fehlerseiten in den Speicher legen.
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(SPEICHER).then((c) => c.put(anfrage, kopie));
        }
        return antwort;
      })
      .catch(async () => {
        const treffer = await caches.match(anfrage);
        if (treffer) return treffer;
        // Die Startseite als Ersatz nur beim Öffnen einer Seite, nie für eine JavaScript- oder
        // CSS-Datei (sonst bekommt der Browser HTML statt Code: „Importing a module script failed“).
        if (anfrage.mode === 'navigate') return (await caches.match('./index.html')) ?? Response.error();
        return Response.error();
      }),
  );
});
