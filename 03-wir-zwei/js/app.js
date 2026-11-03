// Wir zwei · Hauptlogik: Zustand halten, Ansichten zeichnen, Klicks verarbeiten.

import { konfig } from './konfig.js';
import { STIMMUNGEN, stimmung, FRAGEN_IDEEN } from './inhalte.js';
import {
  esc, heute, tagPlus, tagLang, tagKurz, vorWieLange, eherFrageFuer,
  serieBerechnen, anfangsbuchstabe, zusammenSeit, herzRegen, zeigeHinweis, vibrieren,
} from './hilfen.js';
import { erstelleDemoDaten } from './daten-demo.js';
import { kameraOeffnen } from './kamera.js';

const wurzel = document.getElementById('app');
const TABS = ['heute', 'fragen', 'foto', 'eher', 'archiv'];

const z = {
  phase: 'laden', // laden | fehler | abgemeldet | kein-paar | wartet | bereit
  tab: tabAusAdresse(),
  fotoGetauscht: {}, // pro Person: großes und kleines Bild vertauscht?
  email: '',
  anmeldeModus: 'anmelden', // anmelden | registrieren
  bestaetigen: false,
  paarCode: '',
  daten: null,
  fehler: '',
  beschaeftigt: false,
  gesteGesendet: null,
  einstellungen: false,
  pushAn: false,
  pushKarteWeg: lokalLesen('wir-zwei-push-karte') === 'weg',
};

function lokalLesen(schluessel) {
  try { return localStorage.getItem(schluessel); } catch { return null; }
}
function lokalSchreiben(schluessel, wert) {
  try { localStorage.setItem(schluessel, wert); } catch { /* egal */ }
}
let quelle = null;
let warteTimer = null;
const merker = new Map(); // Eingaben überleben das Neuzeichnen

// ───────────────────────── Symbole ─────────────────────────

const HERZ_PFAD = 'M12 21s-8-4.9-8-11.2A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8 3.1C20 16.1 12 21 12 21z';
const S = {
  herz: (gr = 18, gefuellt = true) => `<svg width="${gr}" height="${gr}" viewBox="0 0 24 24" aria-hidden="true" ${gefuellt ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"'}><path d="${HERZ_PFAD}"/></svg>`,
  frage: (gr = 20, dick = 2) => `<svg width="${gr}" height="${gr}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${dick}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L4 20l1-4.4A8.5 8.5 0 1 1 21 11.5z"/><path d="M10 9.3a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1.2.8-1.2 1.6"/><path d="M12 15.8h.01"/></svg>`,
  tausch: (gr = 20, dick = 2) => `<svg width="${gr}" height="${gr}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${dick}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3.5-3.5"/><path d="M20 16H7l3.5 3.5"/></svg>`,
  schloss: (gr = 16) => `<svg width="${gr}" height="${gr}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  haken: (gr = 14, dick = 2.5) => `<svg width="${gr}" height="${gr}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${dick}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  pfeil: () => '<svg class="pfeil" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  zahnrad: () => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  kamera: (gr = 20) => `<svg width="${gr}" height="${gr}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7.5 6.5H4.5A2.5 2.5 0 0 0 2 9v9a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 22 18V9a2.5 2.5 0 0 0-2.5-2.5h-3z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
  buch: (gr = 20, dick = 2) => `<svg width="${gr}" height="${gr}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${dick}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z"/><path d="M4 19.5A2 2 0 0 0 6 21.5h13v-3.5"/><path d="M12 7.5s-2-1.6-3.2-.3c-1.1 1.2.3 2.7 3.2 4.3 2.9-1.6 4.3-3.1 3.2-4.3C14 5.9 12 7.5 12 7.5z"/></svg>`,
  glocke: (gr = 20) => `<svg width="${gr}" height="${gr}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  funken: () => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>',
};

const HERZ_DEKO = `<svg class="herz-deko" width="96" height="80" viewBox="0 0 96 80" aria-hidden="true" style="color: var(--akzent)">
  <path d="M70 30s-9-5.6-9-12.8a5.2 5.2 0 0 1 9-3.4 5.2 5.2 0 0 1 9 3.4C79 24.4 70 30 70 30z" fill="currentColor" opacity="0.2"/>
  <path d="M44 22s-5-3.1-5-7.1a2.9 2.9 0 0 1 5-1.9 2.9 2.9 0 0 1 5 1.9c0 4-5 7.1-5 7.1z" fill="currentColor" opacity="0.13"/>
  <path d="M84 52s-4-2.5-4-5.7a2.3 2.3 0 0 1 4-1.5 2.3 2.3 0 0 1 4 1.5c0 3.2-4 5.7-4 5.7z" fill="currentColor" opacity="0.15"/>
</svg>`;

// ───────────────────────── Start ─────────────────────────

async function start() {
  render();
  try {
    // „?demo“ in der Adresse erzwingt den Demo-Modus (für Tests und zum Herzeigen).
    const demoErzwungen = new URLSearchParams(location.search).has('demo');
    if (konfig.supabaseUrl && konfig.supabaseKey && !demoErzwungen) {
      const { erstelleSupabaseDaten } = await import('./daten-supabase.js');
      quelle = await erstelleSupabaseDaten(konfig.supabaseUrl, konfig.supabaseKey);
    } else {
      quelle = erstelleDemoDaten();
    }
    await statusPruefen();
  } catch (fehler) {
    z.phase = 'fehler';
    z.fehler = fehler?.message ?? String(fehler);
    render();
  }
}

async function statusPruefen() {
  clearInterval(warteTimer);
  z.phase = await quelle.status();
  if (z.phase === 'bereit') {
    await neuLaden();
    quelle.abonnieren(() => neuLaden(), gesteEmpfangen);
    pushPruefen();
  } else if (z.phase === 'wartet') {
    z.paarCode = (await quelle.laden()).paarCode;
    // Warten, bis der Schatz den Code eingegeben hat.
    warteTimer = setInterval(async () => {
      try { if ((await quelle.status()) === 'bereit') statusPruefen(); } catch { /* nächster Versuch */ }
    }, 5000);
  }
  render();
}

let ladeAuftrag = null;
async function neuLaden() {
  // Mehrere Echtzeit-Ereignisse kurz hintereinander zu einem Laden zusammenfassen.
  if (ladeAuftrag) { ladeAuftrag.nochmal = true; return ladeAuftrag.fertig; }
  let erledigt;
  ladeAuftrag = { nochmal: false, fertig: new Promise((r) => { erledigt = r; }) };
  try {
    do {
      ladeAuftrag.nochmal = false;
      z.daten = await quelle.laden();
    } while (ladeAuftrag.nochmal);
    render();
  } catch (fehler) {
    zeigeHinweis(fehler.message);
  } finally {
    ladeAuftrag = null;
    erledigt();
  }
}

// ───────────────────────── Push-Mitteilungen ─────────────────────────
// Auf dem iPhone nur möglich, wenn die App vom Home-Bildschirm aus geöffnet wurde (ab iOS 16.4).

function pushZustand() {
  if (!quelle || quelle.demo || !konfig.pushSchluessel) return 'unpassend';
  const moeglich = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!moeglich) return /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'homescreen' : 'unpassend';
  if (Notification.permission === 'denied') return 'blockiert';
  return z.pushAn ? 'an' : 'aus';
}

// Beim Start nachsehen, ob dieses Gerät schon angemeldet ist, und das Abo auffrischen.
async function pushPruefen() {
  if (pushZustand() === 'unpassend' || pushZustand() === 'homescreen') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const abo = await reg?.pushManager.getSubscription();
    z.pushAn = Boolean(abo) && Notification.permission === 'granted';
    if (z.pushAn) await quelle.pushAbonnieren(abo);
    render();
  } catch { /* ohne Mitteilungen weiter */ }
}

function schluesselBytes(text) {
  const b64 = (text + '='.repeat((4 - (text.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (zeichen) => zeichen.charCodeAt(0));
}

let stimmungTimer;
function stimmungMelden() {
  // Wer schnell mehrere Stimmungen durchtippt, schickt nur eine Mitteilung (die letzte).
  clearTimeout(stimmungTimer);
  stimmungTimer = setTimeout(() => quelle.benachrichtigen('stimmung'), 3000);
}

function gesteEmpfangen(art) {
  const name = z.daten?.partner?.name ?? 'Dein Schatz';
  if (art === 'anruf') {
    zeigeHinweis(`📞 ${name} ruft dich gleich an`);
    vibrieren([20, 60, 20]);
  } else {
    herzRegen();
    zeigeHinweis(`${name} schickt dir eine Umarmung`);
    vibrieren([15, 40, 15]);
  }
}

// ───────────────────────── Zeichnen ─────────────────────────

function render() {
  const aktiv = document.activeElement;
  const fokusId = aktiv && wurzel.contains(aktiv) ? aktiv.id : null;
  const auswahl = fokusId && 'selectionStart' in aktiv ? [aktiv.selectionStart, aktiv.selectionEnd] : null;
  // Scrollstand im Einstellungsblatt merken, damit es beim Neuzeichnen nicht nach oben springt
  const blattScroll = document.querySelector('.blatt-unten')?.scrollTop ?? 0;

  wurzel.innerHTML = ansicht();

  document.body.classList.toggle('blatt-offen', z.einstellungen);
  const blatt = document.querySelector('.blatt-unten');
  if (blatt) blatt.scrollTop = blattScroll;
  z.blattFrisch = false; // Hochfahr-Animation nur beim Öffnen, nicht bei jedem Neuzeichnen

  for (const [id, wert] of merker) {
    const feld = document.getElementById(id);
    if (feld) feld.value = wert;
  }
  if (fokusId) {
    const feld = document.getElementById(fokusId);
    if (feld) {
      feld.focus({ preventScroll: true });
      if (auswahl && 'setSelectionRange' in feld) {
        try { feld.setSelectionRange(...auswahl); } catch { /* nicht jedes Feld */ }
      }
    }
  }
}

function ansicht() {
  switch (z.phase) {
    case 'laden': return ansichtLaden();
    case 'fehler': return ansichtFehler();
    case 'abgemeldet': return ansichtAnmelden();
    case 'kein-paar': return ansichtKeinPaar();
    case 'wartet': return ansichtWartet();
    default: return z.daten ? ansichtApp() : ansichtLaden();
  }
}

const aus = () => (z.beschaeftigt ? 'disabled' : '');

function ansichtLaden() {
  return `<main class="einstieg" aria-busy="true"><div class="logo pulsieren">${S.herz(40)}</div><p class="leise">Einen Moment …</p></main>`;
}

function ansichtFehler() {
  return `<main class="einstieg">
    <div class="logo">${S.herz(40)}</div>
    <h1>Hoppla</h1>
    <p class="leise">Die App konnte nicht starten. Bist du online? Stimmen die Zugangsdaten in <code>js/konfig.js</code>?</p>
    <div class="karte"><p class="klein leise">${esc(z.fehler)}</p></div>
    <button class="knopf haupt" data-aktion="neu-starten">Noch mal versuchen</button>
  </main>`;
}

function ansichtAnmelden() {
  const neu = z.anmeldeModus === 'registrieren';
  if (z.bestaetigen) {
    return `<main class="einstieg">
      <div class="logo">${S.herz(40)}</div>
      <h1>Fast geschafft</h1>
      <p class="leise">Wir haben dir eine Mail an ${esc(z.email)} geschickt. Klick auf den Link darin und melde dich danach hier an.</p>
      <button class="knopf haupt" data-aktion="zur-anmeldung">Zur Anmeldung</button>
    </main>`;
  }
  return `<main class="einstieg">
    <div class="logo">${S.herz(40)}</div>
    <h1>Wir zwei</h1>
    <p class="leise">Eure kleine App für jeden Tag.</p>
    <form data-form="${neu ? 'registrieren' : 'anmelden'}" class="karte formular">
      <label for="email">E-Mail-Adresse</label>
      <input id="email" name="email" type="email" autocomplete="username" required data-merken placeholder="du@beispiel.de">
      <label for="passwort">Passwort</label>
      <input id="passwort" name="passwort" type="password" data-merken autocomplete="${neu ? 'new-password' : 'current-password'}" required minlength="${neu ? 8 : 1}" placeholder="${neu ? 'Mindestens 8 Zeichen' : ''}">
      <button class="knopf haupt" ${aus()}>${neu ? 'Konto erstellen' : 'Anmelden'}</button>
    </form>
    <button class="knopf text" data-aktion="anmelde-modus">${neu ? 'Ich habe schon ein Konto' : 'Neu hier? Konto erstellen'}</button>
  </main>`;
}

function ansichtKeinPaar() {
  return `<main class="einstieg">
    <div class="logo">${S.herz(40)}</div>
    <h1>Fast geschafft</h1>
    <p class="leise">Wie soll dich dein Schatz in der App sehen?</p>
    <div class="karte formular">
      <label for="name-eingabe">Dein Name</label>
      <input id="name-eingabe" type="text" maxlength="30" autocomplete="given-name" data-merken placeholder="Vorname">
    </div>
    <form data-form="paar-neu" class="karte formular">
      <h2>Neues Paar</h2>
      <p class="klein leise">Du bekommst einen Code, den du deinem Schatz schickst.</p>
      <button class="knopf haupt" ${aus()}>Paar erstellen</button>
    </form>
    <form data-form="paar-beitreten" class="karte formular">
      <h2>Ich habe einen Code</h2>
      <label for="paar-code">Einladungscode</label>
      <input id="paar-code" name="code" type="text" class="code-feld" maxlength="6" autocapitalize="characters" autocomplete="off" required data-merken placeholder="ABC123">
      <button class="knopf zweit" ${aus()}>Beitreten</button>
    </form>
  </main>`;
}

function ansichtWartet() {
  return `<main class="einstieg">
    <div class="logo pulsieren">${S.herz(40)}</div>
    <h1>Jetzt fehlt nur noch dein Schatz</h1>
    <p class="leise">Schick diesen Code. Sobald er in der App eingegeben ist, geht es hier automatisch los.</p>
    <div class="karte">
      <div class="code-gross" aria-label="Einladungscode">${esc(z.paarCode)}</div>
      <button class="knopf haupt" data-aktion="code-teilen">Code teilen</button>
    </div>
    <button class="knopf text" data-aktion="abmelden">Abmelden</button>
  </main>`;
}

function ansichtApp() {
  const d = z.daten;
  const ansichten = { fragen: ansichtFragen, eher: ansichtEher, foto: ansichtFoto, archiv: ansichtArchivTab };
  const inhalt = (ansichten[z.tab] ?? ansichtHeute)(d);
  return `<main class="inhalt" id="inhalt">
      ${quelle.demo ? '<div class="demo-band">Demo-Modus · Daten bleiben auf diesem Gerät</div>' : ''}
      ${inhalt}
    </main>
    ${tabLeiste(d)}
    ${z.einstellungen ? ansichtEinstellungen(d) : ''}`;
}

// ── Gemeinsame Bausteine

function avatar(person, rolle, groesse = '') {
  return `<span class="avatar ${rolle} ${groesse}" aria-hidden="true">${esc(anfangsbuchstabe(person?.name))}</span>`;
}

function kopf(titel, ueberzeile, rechts = '', unterzeile = '') {
  return `<header class="kopf ${titel.length > 14 ? 'titel-lang' : ''}">
    <p class="ueberzeile">${esc(ueberzeile)}</p>
    <div class="kopf-zeile"><h1>${esc(titel)}</h1>${rechts}</div>
    ${unterzeile}
  </header>`;
}

// Dezente Zeile unter „Heute“: seit wann ihr zusammen seid (an besonderen Tagen rosa).
function zusammenZeile(d) {
  const info = zusammenSeit(d.zusammenSeit);
  if (!info) {
    return `<button class="zusammen-zeile leer" data-aktion="einstellungen">${S.herz(14, false)} Seit wann seid ihr zusammen? Eintragen</button>`;
  }
  return `<p class="zusammen-zeile ${info.besonders ? 'besonders' : ''}">${S.herz(14)}<span>${esc(info.text)}</span></p>`;
}

function blase(person, rolle, text) {
  return `<div class="blase-zeile">${avatar(person, rolle, 'klein')}<div class="blase ${rolle === 'partner' ? 'partner' : ''}">${esc(text)}</div></div>`;
}

function antwortVon(d, frageId, autor) {
  return d.antworten.find((a) => a.frageId === frageId && a.autor === autor) ?? null;
}

function eherHeute(d) {
  const h = heute();
  const meine = d.eher.find((e) => e.tag === h && e.autor === d.ich.id)?.wahl ?? null;
  const ihre = d.eher.find((e) => e.tag === h && e.autor === d.partner?.id)?.wahl ?? null;
  return { meine, ihre, partnerFertig: d.partnerEherHeute || ihre !== null };
}

// Was ist bei den Fragen heute noch für mich zu tun?
function fragenOffen(d) {
  const h = heute();
  const heuteFragen = d.fragen.filter((f) => f.tag === h);
  const unbeantwortet = heuteFragen.filter((f) => !antwortVon(d, f.id, d.ich.id));
  const eigeneGestellt = heuteFragen.some((f) => f.autor === d.ich.id);
  return { unbeantwortet, eigeneGestellt, heuteFragen };
}

function tabLeiste(d) {
  const offen = fragenOffen(d);
  const punktFragen = offen.unbeantwortet.length > 0 || !offen.eigeneGestellt;
  const punktEher = eherHeute(d).meine === null;
  const punktFoto = !d.fotos.some((f) => f.autor === d.ich.id);
  const tab = (id, titel, symbol, punkt) => {
    const aktiv = z.tab === id;
    return `<a class="tab" href="#${id}" ${aktiv ? 'aria-current="page"' : ''}>
      ${symbol(aktiv)}${punkt ? '<span class="punkt"></span><span class="nur-vorlesen">, etwas Neues</span>' : ''}
      <span>${titel}</span>
    </a>`;
  };
  // Die Kamera sitzt als runder Knopf in der Mitte.
  const fotoTab = `<a class="tab tab-kamera" href="#foto" aria-label="Foto des Tages${punktFoto ? ', noch nicht gepostet' : ''}" ${z.tab === 'foto' ? 'aria-current="page"' : ''}>
      <span class="kamera-kreis">${S.kamera(26)}</span>${punktFoto ? '<span class="punkt"></span>' : ''}
    </a>`;
  return `<nav class="tabs" aria-label="Hauptnavigation"><div class="tabs-innen">
    ${tab('heute', 'Heute', (a) => S.herz(26, a), false)}
    ${tab('fragen', 'Fragen', (a) => S.frage(26, a ? 2.2 : 1.8), punktFragen)}
    ${fotoTab}
    ${tab('eher', 'Eher', (a) => S.tausch(26, a ? 2.2 : 1.8), punktEher)}
    ${tab('archiv', 'Archiv', (a) => S.buch(26, a ? 2.2 : 1.8), false)}
  </div></nav>`;
}

// ── Pflanze: wächst mit jedem Tag, an dem ihr beide die Eher-Frage beantwortet habt.

function pflanze(serie) {
  const stufe = serie >= 14 ? 4 : serie >= 7 ? 3 : serie >= 3 ? 2 : serie >= 1 ? 1 : 0;
  const oben = 76 - [0, 18, 30, 42, 50][stufe];
  const blatt = (y, seite, gr) => {
    const cx = 60 + seite * gr * 0.55;
    return `<ellipse cx="${cx}" cy="${y}" rx="${gr * 0.55}" ry="${gr * 0.27}" transform="rotate(${-seite * 28} ${cx} ${y})" fill="var(--blatt)"/>`;
  };
  let teile = '';
  if (stufe === 0) {
    teile = '<ellipse cx="60" cy="74" rx="5" ry="3.5" fill="var(--blatt-dunkel)"/>';
  } else {
    teile += `<path d="M60 77V${oben}" stroke="var(--blatt-dunkel)" stroke-width="3" stroke-linecap="round"/>`;
    teile += blatt(oben + 5, -1, 12) + blatt(oben + 5, 1, 12);
    if (stufe >= 2) teile += blatt(oben + 17, -1, 16) + blatt(oben + 17, 1, 16);
    if (stufe >= 3) teile += blatt(oben + 30, -1, 19) + blatt(oben + 30, 1, 19);
    if (stufe === 3) teile += `<circle cx="60" cy="${oben - 2}" r="4.5" fill="var(--akzent)" opacity="0.75"/>`;
    if (stufe === 4) teile += `<path transform="translate(48 ${oben - 20}) scale(1)" d="${HERZ_PFAD}" fill="var(--akzent)"/>`;
  }
  const texte = [
    'Euer Samen wartet. Beantwortet heute beide die Eher-Frage.',
    'Es keimt! Bleibt dran.',
    'Sie wächst und wächst.',
    'Schon richtig buschig.',
    'Sie blüht, so wie ihr zwei.',
  ];
  return `<section class="karte pflanze-karte" aria-label="Eure Pflanze">
    <svg width="84" height="84" viewBox="0 0 120 120" aria-hidden="true">
      <g class="pflanze-wippen">${teile}</g>
      <rect x="34" y="76" width="52" height="10" rx="4" fill="var(--topf-rand)"/>
      <path d="M38 85h44l-5 23a4 4 0 0 1-4 3H47a4 4 0 0 1-4-3z" fill="var(--topf)"/>
    </svg>
    <div class="pflanze-text">
      <span class="serie-zahl">${serie} ${serie === 1 ? 'Tag' : 'Tage'} in Folge</span>
      <span class="klein leise">${texte[stufe]}</span>
    </div>
  </section>`;
}

// ───────────────────────── Tab: Heute ─────────────────────────

function ansichtHeute(d) {
  const p = d.partner;
  const ps = stimmung(p.stimmung);
  const geste = p.stimmung === 'stimme' ? 'anruf' : 'umarmung';
  const gesendet = z.gesteGesendet === geste;
  const gesteText = gesendet
    ? (geste === 'anruf' ? `${S.haken(18)} ${esc(p.name)} weiß Bescheid` : `${S.herz(18)} Umarmung ist unterwegs`)
    : (geste === 'anruf' ? '📞 Ich ruf dich gleich an' : `${S.herz(18, false)} Umarmung schicken`);

  const partnerKarte = `<section class="karte partner-karte" aria-label="So geht es ${esc(p.name)}">
    ${HERZ_DEKO}
    <div class="person-zeile">
      ${avatar(p, 'partner')}
      <div>
        <div class="person-name">${esc(p.name)}</div>
        <div class="klein leise">${ps ? `fühlt sich gerade so · ${vorWieLange(p.stimmungSeit)}` : 'hat noch keine Stimmung gewählt'}</div>
      </div>
    </div>
    ${ps ? `<div class="stimmung-anzeige"><span class="stimmung-emoji" aria-hidden="true">${ps.emoji}</span><span>${esc(ps.text)}</span></div>` : ''}
    <button class="knopf haupt ${gesendet ? 'gesendet' : ''}" data-aktion="geste" data-wert="${geste}" ${gesendet || z.beschaeftigt ? 'disabled' : ''}>${gesteText}</button>
  </section>`;

  const stimmungen = STIMMUNGEN.map((s) => {
    const an = d.ich.stimmung === s.schluessel;
    return `<button class="stimmung" data-aktion="stimmung" data-wert="${s.schluessel}" aria-pressed="${an}">
      <span class="emoji" aria-hidden="true">${s.emoji}</span>
      <span>${esc(s.text)}</span>
      ${an ? `<span class="haken">${S.haken(13, 3)}</span>` : ''}
    </button>`;
  }).join('');

  const offen = fragenOffen(d);
  const vonIhr = offen.unbeantwortet.find((f) => f.autor === p.id);
  let fragenUnter;
  let fragenPunkt = true;
  if (vonIhr) fragenUnter = `${esc(p.name)} hat dir eine Frage gestellt`;
  else if (!offen.eigeneGestellt) fragenUnter = 'Denk dir eine lustige Frage aus';
  else if (offen.unbeantwortet.length) fragenUnter = 'Deine Antwort fehlt noch';
  else { fragenUnter = 'Alles beantwortet'; fragenPunkt = false; }

  const e = eherHeute(d);
  let eherUnter;
  if (e.meine === null) eherUnter = 'Die Frage von heute wartet auf euch';
  else if (e.ihre === null) eherUnter = `Warte auf ${esc(p.name)}`;
  else eherUnter = e.meine === e.ihre ? 'Match! Ihr seid euch einig' : 'Heute seid ihr euch uneinig';

  const serie = serieBerechnen(d.eher, d.ich.id, p.id);

  const meinFoto = d.fotos.some((f) => f.autor === d.ich.id);
  const ihrFoto = d.fotos.some((f) => f.autor === p.id);
  const fotoUnter = meinFoto
    ? (ihrFoto ? 'Ihr habt beide gepostet' : `Gepostet · ${esc(p.name)} fehlt noch`)
    : (ihrFoto ? `${esc(p.name)} hat schon ein Foto gepostet` : 'Noch kein Foto heute');

  // Einmaliger, wegklickbarer Hinweis auf Mitteilungen
  const push = pushZustand();
  let pushKarte = '';
  if (!z.pushKarteWeg && push === 'aus') {
    pushKarte = `<section class="karte push-karte">
      <div class="person-zeile"><span class="zeile-symbol rose">${S.glocke()}</span>
        <div><div class="person-name">Mitteilungen einschalten?</div>
        <p class="klein leise">Dann merkst du sofort, wenn ${esc(p.name)} dir eine Umarmung schickt.</p></div></div>
      <div class="knopf-reihe">
        <button class="knopf text" data-aktion="push-karte-weg">Später</button>
        <button class="knopf haupt" data-aktion="push-an" ${aus()}>Einschalten</button>
      </div>
    </section>`;
  } else if (!z.pushKarteWeg && push === 'homescreen') {
    pushKarte = `<section class="karte push-karte">
      <div class="person-zeile"><span class="zeile-symbol rose">${S.glocke()}</span>
        <div><div class="person-name">Mitteilungen gibt es auf dem Home-Bildschirm</div>
        <p class="klein leise">Tippe in Safari auf Teilen → „Zum Home-Bildschirm“ und öffne die App dann von dort.</p></div></div>
      <button class="knopf text" data-aktion="push-karte-weg">Okay</button>
    </section>`;
  }

  return `
    ${kopf('Heute', tagLang(heute()), `<button class="rund-knopf" data-aktion="einstellungen" aria-label="Einstellungen">${S.zahnrad()}</button>`, zusammenZeile(d))}
    ${pushKarte}
    ${partnerKarte}
    <div class="abschnitt-kopf"><h2>Wie fühlst du dich?</h2><span class="klein leise">Tippen zum Ändern</span></div>
    <div class="stimmungen">${stimmungen}</div>
    ${pflanze(serie)}
    <div class="abschnitt-kopf"><h2>Für heute</h2></div>
    <div class="liste">
      <a class="zeile" href="#fragen">
        <span class="zeile-symbol rose">${S.frage()}</span>
        <span class="zeile-text"><span class="zeile-titel">Frage des Tages</span><span class="klein leise">${fragenUnter}</span></span>
        ${fragenPunkt ? '<span class="punkt" aria-label="Neu"></span>' : ''}${S.pfeil()}
      </a>
      <a class="zeile" href="#eher">
        <span class="zeile-symbol blau">${S.tausch()}</span>
        <span class="zeile-text"><span class="zeile-titel">Was würdest du eher?</span><span class="klein leise">${eherUnter}</span></span>
        ${e.meine === null ? '<span class="punkt" aria-label="Neu"></span>' : ''}${S.pfeil()}
      </a>
      <a class="zeile" href="#foto">
        <span class="zeile-symbol rose">${S.kamera()}</span>
        <span class="zeile-text"><span class="zeile-titel">Foto des Tages</span><span class="klein leise">${fotoUnter}</span></span>
        ${meinFoto ? '' : '<span class="punkt" aria-label="Neu"></span>'}${S.pfeil()}
      </a>
    </div>`;
}

// ───────────────────────── Tab: Fragen ─────────────────────────

function ansichtFragen(d) {
  return `${kopf('Fragen', tagLang(heute()))}${ansichtFragenHeute(d)}`;
}

// ───────────────────────── Tab: Archiv ─────────────────────────

function ansichtArchivTab(d) {
  return `${kopf('Archiv', 'Eure Fragen und Antworten')}${ansichtArchiv(d)}`;
}

// ───────────────────────── Tab: Foto des Tages ─────────────────────────

function uhrzeit(iso) {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function fotoKarte(foto, person, rolle, titel) {
  // Antippen des kleinen Bildes tauscht groß und klein – wie bei BeReal.
  const getauscht = Boolean(z.fotoGetauscht[foto.autor]);
  const gross = getauscht ? foto.vorne : foto.hinten;
  const klein = getauscht ? foto.hinten : foto.vorne;
  return `<section class="karte foto-karte" aria-label="${titel}">
    <div class="person-zeile">
      ${avatar(person, rolle, 'klein')}
      <div><div class="person-name">${titel}</div><div class="klein leise">um ${uhrzeit(foto.erstelltAm)} Uhr</div></div>
    </div>
    <div class="foto-paar">
      <img class="foto-gross" src="${esc(gross)}" alt="${titel}${getauscht ? ', Selfie' : ''}">
      <button class="foto-klein-knopf" data-aktion="foto-tauschen" data-wert="${esc(foto.autor)}" aria-label="Bilder tauschen">
        <img class="foto-klein" src="${esc(klein)}" alt="">
      </button>
    </div>
  </section>`;
}

function ansichtFoto(d) {
  const p = d.partner;
  const ihres = d.fotos.find((f) => f.autor === p.id);
  const meins = d.fotos.find((f) => f.autor === d.ich.id);

  const ihreKarte = ihres
    ? fotoKarte(ihres, p, 'partner', `Foto von ${esc(p.name)}`)
    : `<section class="karte leer"><p class="klein">${esc(p.name)} hat heute noch kein Foto gepostet. Sobald es da ist, siehst du es hier.</p></section>`;

  const meineKarte = meins
    ? fotoKarte(meins, d.ich, 'ich', 'Dein Foto')
    : `<section class="karte foto-aufruf">
        <span class="foto-aufruf-symbol">${S.kamera(34)}</span>
        <h2>Was machst du gerade?</h2>
        <p class="klein leise">Erst ein Foto von der Welt, direkt danach ein Selfie. Ein Foto pro Tag, um Mitternacht ist es wieder weg.</p>
        <button class="knopf haupt" data-aktion="foto-machen" ${aus()}>${S.kamera(20)} Foto machen</button>
      </section>`;

  return `
    ${kopf('Foto des Tages', 'Verschwindet um Mitternacht')}
    ${meins ? ihreKarte + meineKarte : meineKarte + ihreKarte}`;
}

function ansichtFragenHeute(d) {
  const h = heute();
  const morgen = tagPlus(h, 1);
  const p = d.partner;
  const heuteFragen = d.fragen
    .filter((f) => f.tag === h)
    .sort((a, b) => (a.autor === d.ich.id ? -1 : 0) - (b.autor === d.ich.id ? -1 : 0));
  const meineHeute = heuteFragen.find((f) => f.autor === d.ich.id);
  const ihreHeute = heuteFragen.find((f) => f.autor === p.id);
  const meineMorgen = d.fragen.find((f) => f.autor === d.ich.id && f.tag === morgen);

  let html = heuteFragen.map((f) => frageKarte(d, f)).join('');
  if (!meineHeute) html += neueFrageKarte(h, p);
  if (!ihreHeute) {
    html += `<section class="karte leer"><p class="klein">${esc(p.name)} hat sich heute noch keine Frage ausgedacht. Sie taucht hier auf, sobald es so weit ist.</p></section>`;
  }
  if (meineHeute) {
    html += meineMorgen
      ? `<section class="karte gestrichelt">
          <span class="karten-label">Deine Frage für morgen <span class="status-gruen">${S.haken()} Eingeplant</span></span>
          <p style="font-size: 17px; font-weight: 600">${esc(meineMorgen.text)}</p>
          <p class="klein leise">${esc(p.name)} sieht sie ab Mitternacht.</p>
        </section>`
      : neueFrageKarte(morgen, p);
  }
  return html;
}

function neueFrageKarte(tag, p) {
  const istHeute = tag === heute();
  const id = `frage-${tag}`;
  return `<form class="karte gestrichelt formular" data-form="frage">
    <input type="hidden" name="tag" value="${tag}">
    <div style="display: flex; flex-direction: column; gap: 4px">
      <h2 style="font-size: 17px">${istHeute ? 'Deine Frage für heute' : 'Deine Frage für morgen'}</h2>
      <p class="klein leise">${istHeute
        ? 'Denk dir etwas Lustiges aus. Ihr beantwortet sie beide.'
        : `Denk dir schon mal etwas aus. ${esc(p.name)} sieht die Frage erst morgen.`}</p>
    </div>
    <label for="${id}" class="nur-vorlesen">Deine Frage</label>
    <input id="${id}" name="text" type="text" required minlength="3" maxlength="200" data-merken placeholder="Wenn du eine Superkraft hättest …">
    <div class="knopf-reihe">
      <button type="button" class="knopf text" data-aktion="idee" data-wert="${id}">Idee?</button>
      <button class="knopf weiss" ${aus()}>${istHeute ? 'Frage stellen' : 'Frage einplanen'}</button>
    </div>
  </form>`;
}

function frageKarte(d, f) {
  const p = d.partner;
  const vonMir = f.autor === d.ich.id;
  const meine = antwortVon(d, f.id, d.ich.id);
  const ihre = antwortVon(d, f.id, p.id);
  const sieFertig = ihre || d.partnerHatBeantwortet.includes(f.id);
  const label = vonMir ? 'Deine Frage' : `Frage von ${esc(p.name)}`;
  const status = meine && ihre ? `<span class="status-gruen">${S.haken()} Aufgedeckt</span>` : '';

  let inhalt;
  if (!meine) {
    const feld = `antwort-${f.id}`;
    inhalt = `
      ${sieFertig
        ? `<div class="blase-zeile">${avatar(p, 'partner', 'klein')}<div class="blase versteckt">${S.schloss()}<span>Versteckt, bis du geantwortet hast</span></div></div>`
        : `<p class="hinweis-zeile">${esc(p.name)} hat noch nicht geantwortet.</p>`}
      <form class="formular" data-form="antwort" style="display: flex; flex-direction: column">
        <input type="hidden" name="frage" value="${esc(f.id)}">
        <label for="${feld}">Deine Antwort</label>
        <textarea id="${feld}" name="text" rows="3" required maxlength="500" data-merken placeholder="Schreib etwas Lustiges …"></textarea>
        <button class="knopf haupt" ${aus()}>Antworten und aufdecken</button>
        <p class="klein leise" style="text-align: center">Danach ist deine Antwort fest und lässt sich nicht mehr ändern.</p>
      </form>`;
  } else {
    inhalt = `<div class="blasen">
      ${blase(d.ich, 'ich', meine.text)}
      ${ihre
        ? blase(p, 'partner', ihre.text)
        : `<div class="blase-zeile">${avatar(p, 'partner', 'klein')}<div class="blase versteckt"><span class="tippen" aria-hidden="true"><i></i><i></i><i></i></span><span>${esc(p.name)} hat noch nicht geantwortet</span></div></div>`}
    </div>
    <p class="hinweis-zeile">${ihre ? `${S.funken()} Aufgedeckt! Eure Antworten bleiben jetzt fest so.` : `${S.schloss(14)} Deine Antwort ist fest gespeichert.`}</p>`;
  }

  return `<section class="karte" aria-label="${label}">
    <span class="karten-label">${label}${status}</span>
    <h2 class="frage-text">${esc(f.text)}</h2>
    ${inhalt}
  </section>`;
}

function ansichtArchiv(d) {
  const h = heute();
  const p = d.partner;
  const alte = d.fragen.filter((f) => f.tag < h);
  if (!alte.length) {
    return `<section class="karte leer"><p class="klein">Hier sammeln sich eure Fragen und Antworten. Mit der Zeit wird daraus ein kleines Tagebuch von euch zwei.</p></section>`;
  }
  const tage = [...new Set(alte.map((f) => f.tag))].sort().reverse();
  return tage.map((tag) => {
    const karten = alte.filter((f) => f.tag === tag).map((f) => {
      const meine = antwortVon(d, f.id, d.ich.id);
      const ihre = antwortVon(d, f.id, p.id);
      const von = f.autor === d.ich.id ? 'Deine Frage' : `Frage von ${esc(p.name)}`;
      return `<section class="karte">
        <span class="karten-label">${von}</span>
        <p style="font-size: 18px; font-weight: 700; line-height: 1.3">${esc(f.text)}</p>
        <div class="blasen">
          ${meine ? blase(d.ich, 'ich', meine.text) : '<p class="hinweis-zeile">Du hast nicht geantwortet.</p>'}
          ${ihre ? blase(p, 'partner', ihre.text) : (meine ? `<p class="hinweis-zeile">${esc(p.name)} hat nicht geantwortet.</p>` : '')}
        </div>
      </section>`;
    }).join('');
    return `<h3 class="tag-kopf">${esc(tagKurz(tag))}</h3>${karten}`;
  }).join('');
}

// ───────────────────────── Tab: Was würdest du eher? ─────────────────────────

function ansichtEher(d) {
  const p = d.partner;
  const [a, b] = eherFrageFuer(heute());
  const { meine, ihre, partnerFertig } = eherHeute(d);
  const fertig = meine !== null;

  const option = (i, text) => {
    const mein = meine === i;
    const chips = `${mein ? `<span class="chip">${avatar(d.ich, 'ich', 'mini')}Du</span>` : ''}${fertig && ihre === i ? `<span class="chip">${avatar(p, 'partner', 'mini')}${esc(p.name)}</span>` : ''}`;
    return `<button class="option" data-aktion="${fertig ? '' : 'eher'}" data-wert="${i}" aria-pressed="${mein}" ${fertig ? 'aria-disabled="true"' : ''}>
      <span>${esc(text)}</span>
      <span class="chips">${chips}</span>
    </button>`;
  };

  let unten = '';
  if (!fertig) {
    unten = `<p class="hinweis-zeile" style="justify-content: center; text-align: center">${partnerFertig ? `${S.schloss()} ${esc(p.name)} hat schon gewählt.` : `${esc(p.name)} hat noch nicht gewählt.`} Deine Wahl zählt sofort und bleibt fest.</p>`;
  } else if (ihre === null) {
    unten = `<section class="karte ergebnis"><span class="tippen" aria-hidden="true"><i></i><i></i><i></i></span><div><div class="ergebnis-titel">Warte auf ${esc(p.name)}</div><p class="klein leise">Du siehst die Wahl, sobald sie da ist.</p></div></section>`;
  } else if (meine === ihre) {
    unten = `<section class="karte ergebnis match">
      <svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true" style="color: var(--akzent); flex-shrink: 0"><path d="M19 37s-11-6.8-11-15.6A6.4 6.4 0 0 1 19 18a6.4 6.4 0 0 1 11 3.4C30 30.2 19 37 19 37z" fill="currentColor"/><path d="M33 30s-7-4.3-7-9.9a4 4 0 0 1 7-2.6 4 4 0 0 1 7 2.6c0 5.6-7 9.9-7 9.9z" fill="currentColor" opacity="0.45"/></svg>
      <div><div class="ergebnis-titel">Match!</div><p class="klein">Ihr tickt heute genau gleich.</p></div>
    </section>`;
  } else {
    unten = `<section class="karte ergebnis">
      <span style="color: var(--blau); flex-shrink: 0">${S.tausch(36, 2.2)}</span>
      <div><div class="ergebnis-titel">Uneinig</div><p class="klein leise">Klingt nach einem Thema für heute Abend.</p></div>
    </section>`;
  }

  // Kleine Statistik über die letzten Tage
  const tage = new Map();
  for (const e of d.eher) {
    if (!tage.has(e.tag)) tage.set(e.tag, {});
    tage.get(e.tag)[e.autor] = e.wahl;
  }
  const beide = [...tage.values()].filter((t) => d.ich.id in t && p.id in t);
  const einig = beide.filter((t) => t[d.ich.id] === t[p.id]).length;
  const statistik = beide.length >= 2
    ? `<p class="hinweis-zeile" style="justify-content: center">${S.herz(14)} Ihr wart euch an ${einig} von ${beide.length} Tagen einig.</p>`
    : '';

  return `
    ${kopf('Was würdest du eher?', 'Neue Frage jeden Tag um Mitternacht')}
    <section class="karte eher-karte" aria-label="Wähle eine Möglichkeit">
      ${option(0, a)}
      <div class="oder" aria-hidden="true">oder</div>
      ${option(1, b)}
    </section>
    ${unten}
    ${fertig ? `<p class="hinweis-zeile" style="justify-content: center">${S.schloss(14)} Eure Antworten sind fest gespeichert.</p>` : ''}
    ${statistik}`;
}

// ───────────────────────── Einstellungen ─────────────────────────

function ansichtEinstellungen(d) {
  return `<div class="schleier ${z.blattFrisch ? 'frisch' : ''}" data-aktion="schliessen-hintergrund">
    <section class="blatt-unten" role="dialog" aria-modal="true" aria-labelledby="einstellungen-titel">
      <div class="griff" aria-hidden="true"></div>
      <div class="kopf-zeile"><h2 id="einstellungen-titel">Einstellungen</h2><button class="knopf text" data-aktion="schliessen">Fertig</button></div>
      <form class="karte formular" data-form="name">
        <label for="name-aendern">Dein Name</label>
        <input id="name-aendern" name="name" type="text" maxlength="30" required data-merken value="${esc(d.ich.name)}">
        <button class="knopf zweit" ${aus()}>Speichern</button>
      </form>
      <form class="karte formular" data-form="zusammen">
        <label for="zusammen-seit">Zusammen seit</label>
        <input id="zusammen-seit" name="datum" type="date" data-merken max="${heute()}" value="${esc(d.zusammenSeit ?? '')}">
        <button class="knopf zweit" ${aus()}>Speichern</button>
      </form>
      ${pushEinstellung(d)}
      ${quelle.demo
        ? `<div class="karte"><p class="klein leise">Im Demo-Modus spielt eine ausgedachte Partnerin mit. Trag in <code>js/konfig.js</code> deine Supabase-Daten ein, dann wird es echt.</p>
            <button class="knopf zweit" data-aktion="demo-zuruecksetzen">Demo zurücksetzen</button></div>`
        : `<div class="karte"><span class="karten-label">Euer Paar-Code</span><div class="code-gross" style="font-size: 28px">${esc(d.paarCode)}</div></div>
           <button class="knopf text" data-aktion="abmelden">Abmelden</button>`}
    </section>
  </div>`;
}

function pushEinstellung(d) {
  const zustand = pushZustand();
  if (zustand === 'unpassend') return '';
  const texte = {
    an: [`Du bekommst eine Mitteilung, wenn ${esc(d.partner.name)} dir eine Umarmung schickt, die Stimmung ändert, eine Frage stellt, antwortet oder bei „Eher“ wählt.`, `<button class="knopf zweit" data-aktion="push-aus" ${aus()}>Auf diesem Gerät ausschalten</button>`],
    aus: ['Auf diesem Gerät sind Mitteilungen aus.', `<button class="knopf haupt" data-aktion="push-an" ${aus()}>Mitteilungen einschalten</button>`],
    blockiert: ['Mitteilungen sind für diese App blockiert. Erlaube sie in den iPhone-Einstellungen unter Mitteilungen → Wir zwei.', ''],
    homescreen: ['Mitteilungen gehen nur, wenn du die App vom Home-Bildschirm öffnest: in Safari Teilen → „Zum Home-Bildschirm“.', ''],
  }[zustand];
  return `<div class="karte formular">
    <span class="karten-label">Mitteilungen ${zustand === 'an' ? `<span class="status-gruen">${S.haken()} An</span>` : ''}</span>
    <p class="klein leise">${texte[0]}</p>
    ${texte[1]}
  </div>`;
}

// Blatt schließen und dort angefangene Eingaben vergessen
function blattZu() {
  z.einstellungen = false;
  merker.delete('name-aendern');
  merker.delete('zusammen-seit');
}

// ───────────────────────── Aktionen ─────────────────────────

const aktionen = {
  async 'neu-starten'() { z.phase = 'laden'; render(); await start(); },

  async stimmung(wert) {
    z.daten.ich.stimmung = wert; // sofort anzeigen, dann speichern
    z.daten.ich.stimmungSeit = new Date().toISOString();
    render();
    vibrieren();
    if (wert === 'arm') herzRegen(6);
    await quelle.stimmungSetzen(wert);
    stimmungMelden();
    await neuLaden();
  },

  async geste(wert) {
    await quelle.gesteSenden(wert);
    quelle.benachrichtigen(wert);
    z.gesteGesendet = wert;
    vibrieren();
    if (wert === 'umarmung') herzRegen(8);
    setTimeout(() => { z.gesteGesendet = null; render(); }, 6000);
  },

  'foto-tauschen'(autor) { z.fotoGetauscht[autor] = !z.fotoGetauscht[autor]; },

  async 'foto-machen'() {
    const bilder = await kameraOeffnen();
    if (!bilder) return;
    zeigeHinweis('Foto wird hochgeladen …');
    await quelle.fotoPosten(bilder.hinten, bilder.vorne);
    quelle.benachrichtigen('foto');
    vibrieren();
    herzRegen(6);
    await neuLaden();
    zeigeHinweis('Gepostet! 📸');
  },

  idee(feldId) {
    const feld = document.getElementById(feldId);
    const andere = FRAGEN_IDEEN.filter((f) => f !== feld?.value);
    const idee = andere[Math.floor(Math.random() * andere.length)];
    merker.set(feldId, idee);
    if (feld) { feld.value = idee; feld.focus(); }
  },

  async eher(wert) {
    await quelle.eherWaehlen(Number(wert));
    quelle.benachrichtigen('eher');
    vibrieren();
    await neuLaden();
    const e = eherHeute(z.daten);
    if (e.ihre !== null && e.ihre === e.meine) herzRegen();
  },

  async 'push-an'() {
    // Die Erlaubnis muss direkt beim Tippen angefragt werden (sonst lehnt iOS ab).
    const erlaubnis = await Notification.requestPermission();
    if (erlaubnis !== 'granted') {
      zeigeHinweis('Mitteilungen wurden nicht erlaubt.');
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const abo = (await reg.pushManager.getSubscription())
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselBytes(konfig.pushSchluessel) });
    await quelle.pushAbonnieren(abo);
    z.pushAn = true;
    z.pushKarteWeg = true;
    lokalSchreiben('wir-zwei-push-karte', 'weg');
    zeigeHinweis('Mitteilungen sind an 🔔');
  },

  async 'push-aus'() {
    const reg = await navigator.serviceWorker.ready;
    const abo = await reg.pushManager.getSubscription();
    if (abo) {
      await quelle.pushAbmelden(abo.endpoint);
      await abo.unsubscribe();
    }
    z.pushAn = false;
    zeigeHinweis('Mitteilungen sind aus');
  },

  'push-karte-weg'() {
    z.pushKarteWeg = true;
    lokalSchreiben('wir-zwei-push-karte', 'weg');
  },

  einstellungen() { z.einstellungen = true; z.blattFrisch = true; },
  schliessen() { blattZu(); },
  'schliessen-hintergrund'() { blattZu(); },

  async 'demo-zuruecksetzen'() {
    quelle.zuruecksetzen();
    merker.clear();
    z.einstellungen = false;
    await neuLaden();
    zeigeHinweis('Demo ist wieder wie neu');
  },

  async abmelden() {
    await quelle.abmelden();
    Object.assign(z, { daten: null, einstellungen: false, bestaetigen: false, email: '' });
    merker.clear();
    await statusPruefen();
  },

  'anmelde-modus'() { z.anmeldeModus = z.anmeldeModus === 'registrieren' ? 'anmelden' : 'registrieren'; },
  'zur-anmeldung'() { z.bestaetigen = false; z.anmeldeModus = 'anmelden'; },

  async 'code-teilen'() {
    const text = `Komm zu mir in „Wir zwei“ 💞 Unser Code: ${z.paarCode}\n${location.href.split('#')[0]}`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* abgebrochen */ return; }
    }
    await navigator.clipboard?.writeText(text);
    zeigeHinweis('Code kopiert');
  },
};

const formulare = {
  async anmelden({ email, passwort }) {
    z.email = email.trim();
    await quelle.anmelden(z.email, passwort);
    merker.clear();
    await statusPruefen();
  },

  async registrieren({ email, passwort }) {
    if (passwort.length < 8) throw new Error('Das Passwort braucht mindestens 8 Zeichen.');
    z.email = email.trim();
    const ergebnis = await quelle.registrieren(z.email, passwort);
    merker.clear();
    if (ergebnis === 'bestaetigen') {
      z.bestaetigen = true;
      return;
    }
    await statusPruefen();
  },

  async 'paar-neu'() {
    const name = nameAusEingabe();
    z.paarCode = await quelle.paarErstellen(name);
    await statusPruefen();
  },

  async 'paar-beitreten'({ code }) {
    const name = nameAusEingabe();
    await quelle.paarBeitreten(code.trim().toUpperCase(), name);
    merker.clear();
    await statusPruefen();
    herzRegen();
  },

  async antwort({ frage, text }) {
    if (!text.trim()) throw new Error('Schreib erst eine Antwort.');
    await quelle.antworten(frage, text.trim());
    quelle.benachrichtigen('antwort');
    merker.delete(`antwort-${frage}`);
    vibrieren();
    await neuLaden();
    if (antwortVon(z.daten, frage, z.daten.partner.id)) herzRegen(10);
  },

  async frage({ tag, text }) {
    if (text.trim().length < 3) throw new Error('Die Frage ist noch zu kurz.');
    await quelle.frageStellen(text.trim(), tag);
    if (tag === heute()) quelle.benachrichtigen('frage'); // Fragen für morgen sind noch geheim
    merker.delete(`frage-${tag}`);
    await neuLaden();
    zeigeHinweis(tag === heute() ? 'Frage ist gestellt' : 'Frage für morgen ist eingeplant');
  },

  async zusammen({ datum }) {
    if (datum && datum > heute()) throw new Error('Das Datum liegt in der Zukunft.');
    await quelle.zusammenSeitSetzen(datum);
    blattZu();
    await neuLaden();
    zeigeHinweis('Gespeichert 💞');
  },

  async name({ name }) {
    if (!name.trim()) throw new Error('Bitte gib einen Namen ein.');
    await quelle.nameSetzen(name.trim());
    blattZu();
    await neuLaden();
  },
};

function nameAusEingabe() {
  const name = (merker.get('name-eingabe') ?? document.getElementById('name-eingabe')?.value ?? '').trim();
  if (!name) {
    document.getElementById('name-eingabe')?.focus();
    throw new Error('Bitte gib zuerst deinen Namen ein.');
  }
  return name;
}

async function ausfuehren(fn) {
  if (z.beschaeftigt) return;
  z.beschaeftigt = true;
  try {
    await fn();
  } catch (fehler) {
    zeigeHinweis(fehler?.message || 'Da ist etwas schiefgegangen.');
  } finally {
    z.beschaeftigt = false;
    render();
  }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-aktion]');
  if (!el || !el.dataset.aktion || el.disabled) return;
  // Der dunkle Hintergrund schließt nur bei Klick direkt auf ihn, nicht auf das Blatt darüber.
  if (el.dataset.aktion === 'schliessen-hintergrund' && ev.target !== el) return;
  const fn = aktionen[el.dataset.aktion];
  if (!fn) return;
  if (el.tagName !== 'A') ev.preventDefault();
  ausfuehren(() => fn(el.dataset.wert, el, ev));
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('form[data-form]');
  if (!form) return;
  ev.preventDefault();
  const fn = formulare[form.dataset.form];
  if (fn) ausfuehren(() => fn(Object.fromEntries(new FormData(form)), form));
});

document.addEventListener('input', (ev) => {
  if (ev.target.id && ev.target.hasAttribute('data-merken')) merker.set(ev.target.id, ev.target.value);
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && z.einstellungen) { blattZu(); render(); }
});

// ── Navigation über die Adresse (#heute, #fragen, #eher), damit „Zurück“ funktioniert.
function tabAusAdresse() {
  const tab = location.hash.slice(1);
  return TABS.includes(tab) ? tab : 'heute';
}

window.addEventListener('hashchange', () => {
  z.tab = tabAusAdresse();
  render();
  window.scrollTo({ top: 0 });
});

// Beim Zurückkehren in die App frisch laden; jede Minute die Zeitangaben auffrischen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && z.phase === 'bereit') neuLaden();
});
setInterval(() => {
  if (document.visibilityState === 'visible' && z.phase === 'bereit') neuLaden();
}, 60000);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* ohne Offline-Modus weitermachen */ });
}

start();
