// Echte Daten über Supabase. Gleiche Schnittstelle wie daten-demo.js.

import { heute, tagPlus } from './hilfen.js';

// Feste Version, damit sich nichts unbemerkt ändert.
const SUPABASE_MODUL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

function pruefe({ data, error }) {
  if (error) throw new Error(uebersetzeFehler(error.message));
  return data;
}

function uebersetzeFehler(text = '') {
  if (/rate limit|security purposes/i.test(text)) return 'Bitte kurz warten und es dann noch einmal versuchen.';
  if (/invalid login credentials/i.test(text)) return 'E-Mail oder Passwort stimmt nicht.';
  if (/already registered|already exists/i.test(text)) return 'Diese E-Mail ist schon registriert. Melde dich einfach an.';
  if (/password should be|password.*at least/i.test(text)) return 'Das Passwort braucht mindestens 8 Zeichen.';
  if (/email not confirmed/i.test(text)) return 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Mail.';
  if (/signups? not allowed|signup.*disabled/i.test(text)) return 'Neue Konten sind in Supabase gerade abgeschaltet.';
  if (/invalid.*email|email.*invalid/i.test(text)) return 'Diese E-Mail-Adresse sieht nicht richtig aus.';
  if (/duplicate key/i.test(text)) return 'Das hast du schon gespeichert.';
  if (/row-level security/i.test(text)) return 'Das ist leider nicht erlaubt.';
  if (/failed to fetch|network/i.test(text)) return 'Keine Verbindung. Bist du online?';
  return text;
}

export async function erstelleSupabaseDaten(url, schluessel) {
  const { createClient } = await import(SUPABASE_MODUL);
  const sb = createClient(url, schluessel, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  let ichId = null;
  let kanal = null;

  return {
    demo: false,

    async status() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return 'abgemeldet';
      ichId = session.user.id;
      const profile = pruefe(await sb.from('profile').select('id, paar_id'));
      const ich = profile.find((p) => p.id === ichId);
      if (!ich?.paar_id) return 'kein-paar';
      return profile.some((p) => p.id !== ichId) ? 'bereit' : 'wartet';
    },

    // Anmeldung mit E-Mail und Passwort. So braucht es keinen Code per Mail,
    // und iPhone/Mac können das Passwort im Schlüsselbund speichern.
    async registrieren(email, passwort) {
      const daten = pruefe(await sb.auth.signUp({ email, password: passwort }));
      // Ist in Supabase „Confirm email“ eingeschaltet, gibt es noch keine Sitzung.
      return daten.session ? 'angemeldet' : 'bestaetigen';
    },

    async anmelden(email, passwort) {
      pruefe(await sb.auth.signInWithPassword({ email, password: passwort }));
    },

    async paarErstellen(name) {
      return pruefe(await sb.rpc('paar_erstellen', { p_name: name }));
    },

    async paarBeitreten(code, name) {
      pruefe(await sb.rpc('paar_beitreten', { p_code: code, p_name: name }));
    },

    async laden() {
      const h = heute();
      const [profile, paare, fragen, antworten, eher, partnerStatus] = await Promise.all([
        sb.from('profile').select('id, name, stimmung, stimmung_seit'),
        sb.from('paare').select('code'),
        sb.from('fragen').select('id, autor, tag, text').gte('tag', tagPlus(h, -60)).order('tag', { ascending: false }),
        sb.from('antworten').select('frage_id, autor, text, erstellt_am').gte('erstellt_am', `${tagPlus(h, -62)}T00:00:00Z`),
        sb.from('eher_antworten').select('tag, autor, wahl').gte('tag', tagPlus(h, -120)),
        sb.rpc('partner_status'),
      ].map((p) => p.then(pruefe)));

      const person = (p) => p && { id: p.id, name: p.name, stimmung: p.stimmung, stimmungSeit: p.stimmung_seit };
      return {
        ich: person(profile.find((p) => p.id === ichId)),
        partner: person(profile.find((p) => p.id !== ichId)) ?? null,
        paarCode: paare[0]?.code ?? '',
        fragen,
        antworten: antworten.map((a) => ({ frageId: a.frage_id, autor: a.autor, text: a.text })),
        partnerHatBeantwortet: partnerStatus.fragen ?? [],
        eher,
        partnerEherHeute: Boolean(partnerStatus.eher_heute),
      };
    },

    async stimmungSetzen(schluessel) {
      pruefe(await sb.from('profile')
        .update({ stimmung: schluessel, stimmung_seit: new Date().toISOString() })
        .eq('id', ichId));
    },

    async nameSetzen(name) {
      pruefe(await sb.from('profile').update({ name }).eq('id', ichId));
    },

    async frageStellen(text, tag) {
      const paarId = pruefe(await sb.rpc('mein_paar'));
      pruefe(await sb.from('fragen').insert({ paar_id: paarId, autor: ichId, tag, text }));
    },

    async antworten(frageId, text) {
      const paarId = pruefe(await sb.rpc('mein_paar'));
      pruefe(await sb.from('antworten').insert({ frage_id: frageId, autor: ichId, paar_id: paarId, text }));
    },

    async eherWaehlen(wahl) {
      const paarId = pruefe(await sb.rpc('mein_paar'));
      pruefe(await sb.from('eher_antworten').insert({ autor: ichId, paar_id: paarId, tag: heute(), wahl }));
    },

    async gesteSenden(art) {
      const paarId = pruefe(await sb.rpc('mein_paar'));
      pruefe(await sb.from('gesten').insert({ paar_id: paarId, von: ichId, art }));
    },

    // ── Push-Mitteilungen
    async pushAbonnieren(abo) {
      const { endpoint, keys } = abo.toJSON();
      pruefe(await sb.from('push_abos').upsert(
        { endpoint, p256dh: keys.p256dh, auth: keys.auth },
        { onConflict: 'endpoint', ignoreDuplicates: true },
      ));
    },

    async pushAbmelden(endpoint) {
      pruefe(await sb.from('push_abos').delete().eq('endpoint', endpoint));
    },

    // Dem Partner Bescheid geben. Läuft im Hintergrund; ein Fehler stört die App nicht.
    benachrichtigen(art) {
      sb.functions.invoke('push', { body: { art } }).catch(() => {});
    },

    // Echtzeit: Jede Änderung im Paar löst ein Neuladen aus, Gesten zusätzlich eine Animation.
    abonnieren(beiAenderung, beiGeste) {
      if (kanal) sb.removeChannel(kanal);
      kanal = sb.channel('wir-zwei');
      for (const tabelle of ['profile', 'fragen', 'antworten', 'eher_antworten']) {
        kanal.on('postgres_changes', { event: '*', schema: 'public', table: tabelle }, () => beiAenderung());
      }
      kanal.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gesten' }, ({ new: geste }) => {
        if (geste.von !== ichId) beiGeste(geste.art);
      });
      kanal.subscribe();
    },

    async abmelden() {
      if (kanal) sb.removeChannel(kanal);
      kanal = null;
      await sb.auth.signOut();
    },
  };
}
