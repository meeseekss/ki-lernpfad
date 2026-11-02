// Edge Function „push“: schickt dem Partner eine Mitteilung aufs Handy.
//
// Zwei Wege hinein:
// 1. Die App ruft sie nach einer Aktion auf (z. B. Umarmung). Die Funktion prüft, wer anfragt,
//    sucht den Partner im selben Paar und schickt an alle seine Geräte eine Web-Push-Nachricht.
//    Den Text baut die Funktion selbst; die App schickt nur die Art der Aktion.
// 2. Der tägliche Job in der Datenbank (pg_cron, 8 Uhr deutscher Zeit) ruft sie mit dem
//    Geheimnis aus push_schluessel.cron_geheimnis auf. Dann meldet sie alle Fragen, die
//    gestern oder früher für heute eingeplant wurden.

import webpush from 'npm:web-push@3.6.7';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

const KOPF = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STIMMUNGEN: Record<string, string> = {
  arm: '🫂 Würde gerne in deinem Arm liegen',
  gut: '☀️ Richtig gut drauf',
  platt: '🪫 Platt',
  down: '🌧️ Ein bisschen down',
  gestresst: '🌀 Gestresst',
  unproduktiv: '🦥 Unproduktiv',
  abgefuckt: '😵‍💫 Abgefuckt',
  stimme: '📞 Würde gerne deine Stimme hören',
};

function nachricht(art: string, ich: { stimmung: string | null }) {
  switch (art) {
    case 'umarmung': return { text: 'schickt dir eine Umarmung 🫂', ziel: './#heute' };
    case 'anruf': return { text: 'ruft dich gleich an 📞', ziel: './#heute' };
    case 'stimmung': return ich.stimmung && STIMMUNGEN[ich.stimmung]
      ? { text: STIMMUNGEN[ich.stimmung], ziel: './#heute' } : null;
    case 'frage': return { text: 'hat sich eine Frage für euch ausgedacht ❓', ziel: './#fragen' };
    case 'antwort': return { text: 'hat eine Frage beantwortet 💬', ziel: './#fragen' };
    case 'eher': return { text: 'hat bei „Was würdest du eher?“ gewählt', ziel: './#eher' };
    case 'foto': return { text: 'hat ein Foto des Tages gepostet 📸', ziel: './#foto' };
    default: return null;
  }
}

function antwort(daten: unknown, status = 200) {
  return new Response(JSON.stringify(daten), { status, headers: { ...KOPF, 'Content-Type': 'application/json' } });
}

const berlinTag = (datum: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(datum);

type Schluessel = { oeffentlich: string; privat: string; cron_geheimnis: string };

// An alle Geräte einer Person schicken; abgemeldete Geräte werden aufgeräumt.
async function sendeAn(admin: SupabaseClient, schluessel: Schluessel, nutzerId: string, nutzlast: string) {
  const { data: abos } = await admin.from('push_abos').select('endpoint, p256dh, auth').eq('nutzer', nutzerId);
  if (!abos?.length) return 0;
  webpush.setVapidDetails('https://meeseekss.github.io/ki-lernpfad/', schluessel.oeffentlich, schluessel.privat);
  let gesendet = 0;
  await Promise.all(abos.map(async (abo) => {
    try {
      await webpush.sendNotification(
        { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
        nutzlast,
        { TTL: 60 * 60 * 12, urgency: 'high' },
      );
      gesendet += 1;
    } catch (fehler) {
      const code = (fehler as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from('push_abos').delete().eq('endpoint', abo.endpoint);
      else console.error('Push fehlgeschlagen', code, (fehler as Error).message);
    }
  }));
  return gesendet;
}

// Täglicher Job: eingeplante Fragen für heute melden.
async function geplanteFragenMelden(admin: SupabaseClient, schluessel: Schluessel) {
  const heute = berlinTag(new Date());
  const { data: fragen } = await admin.from('fragen').select('autor, paar_id, erstellt_am').eq('tag', heute);
  // Fragen, die erst heute gestellt wurden, haben schon beim Stellen eine Mitteilung ausgelöst.
  const geplant = (fragen ?? []).filter((f) => berlinTag(new Date(f.erstellt_am)) < heute);
  let gesendet = 0;
  for (const frage of geplant) {
    const { data: profile } = await admin.from('profile').select('id, name').eq('paar_id', frage.paar_id);
    const autor = profile?.find((p) => p.id === frage.autor);
    const partner = profile?.find((p) => p.id !== frage.autor);
    if (!autor || !partner) continue;
    const nutzlast = JSON.stringify({ titel: autor.name, text: 'hat dir eine Frage für heute gestellt ☀️', ziel: './#fragen', art: 'frage' });
    gesendet += await sendeAn(admin, schluessel, partner.id, nutzlast);
  }
  return { fragen: geplant.length, gesendet };
}

Deno.serve(async (anfrage) => {
  if (anfrage.method === 'OPTIONS') return new Response('ok', { headers: KOPF });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: schluessel } = await admin.from('push_schluessel')
    .select('oeffentlich, privat, cron_geheimnis').eq('id', 1).single<Schluessel>();
  if (!schluessel) return antwort({ fehler: 'keine Schlüssel' }, 500);

  // Weg 2: täglicher Job
  const cron = anfrage.headers.get('x-wir-zwei-cron');
  if (cron !== null) {
    if (cron !== schluessel.cron_geheimnis) return antwort({ fehler: 'falsches Geheimnis' }, 401);
    return antwort(await geplanteFragenMelden(admin, schluessel));
  }

  // Weg 1: Aufruf aus der App
  const nutzerSb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: anfrage.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await nutzerSb.auth.getUser();
  if (!user) return antwort({ fehler: 'nicht angemeldet' }, 401);

  const { art } = await anfrage.json().catch(() => ({ art: null }));

  // Profile über die Zugriffsregeln lesen: so sieht man nur sich selbst und den Partner.
  const { data: profile } = await nutzerSb.from('profile').select('id, name, stimmung');
  const ich = profile?.find((p) => p.id === user.id);
  const partner = profile?.find((p) => p.id !== user.id);
  if (!ich || !partner) return antwort({ gesendet: 0 });

  const inhalt = nachricht(String(art), ich);
  if (!inhalt) return antwort({ fehler: 'unbekannte Art' }, 400);

  const nutzlast = JSON.stringify({ titel: ich.name, text: inhalt.text, ziel: inhalt.ziel, art });
  return antwort({ gesendet: await sendeAn(admin, schluessel, partner.id, nutzlast) });
});
