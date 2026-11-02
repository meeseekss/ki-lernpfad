// Edge Function „aufraeumen“: löscht alle Fotos von gestern und früher.
//
// Der Datenbank-Job „fotos-aufraeumen“ (pg_cron) ruft sie stündlich auf und weist sich mit
// dem Geheimnis aus push_schluessel.cron_geheimnis aus. Gelöscht werden die Bilder im
// Storage-Bucket „fotos“ (auch nie gepostete Reste) und die Einträge in der Tabelle fotos.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const berlinTag = (datum: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(datum);

function antwort(daten: unknown, status = 200) {
  return new Response(JSON.stringify(daten), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (anfrage) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: schluessel } = await admin.from('push_schluessel').select('cron_geheimnis').eq('id', 1).single();
  if (!schluessel || anfrage.headers.get('x-wir-zwei-cron') !== schluessel.cron_geheimnis) {
    return antwort({ fehler: 'nicht erlaubt' }, 401);
  }

  const heute = berlinTag(new Date());
  const lager = admin.storage.from('fotos');
  let geloeschteDateien = 0;

  // Ordner: <paar_id>/<tag>/…  → alle Tage vor heute leeren
  const { data: paare } = await admin.from('paare').select('id');
  for (const paar of paare ?? []) {
    const { data: tage } = await lager.list(paar.id, { limit: 1000 });
    for (const tag of tage ?? []) {
      if (!(tag.name < heute)) continue;
      const { data: dateien } = await lager.list(`${paar.id}/${tag.name}`, { limit: 1000 });
      const pfade = (dateien ?? []).map((d) => `${paar.id}/${tag.name}/${d.name}`);
      if (pfade.length) {
        const { error } = await lager.remove(pfade);
        if (error) console.error('Löschen fehlgeschlagen', error.message);
        else geloeschteDateien += pfade.length;
      }
    }
  }

  const { count } = await admin.from('fotos').delete({ count: 'exact' }).lt('tag', heute);
  return antwort({ heute, geloeschteDateien, geloeschteEintraege: count ?? 0 });
});
