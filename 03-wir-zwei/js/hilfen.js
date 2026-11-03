// Kleine Helfer: Text escapen, Datum in deutscher Zeit, Zeitangaben, Effekte.

import { EHER_FRAGEN } from './inhalte.js';

// Nutzertext immer escapen, bevor er ins HTML kommt (Schutz vor eingeschleustem Code).
export function esc(wert) {
  return String(wert ?? '').replace(/[&<>"']/g, (z) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]
  ));
}

// ── Datum: Der Tag wechselt um Mitternacht deutscher Zeit, egal wo das Handy gerade ist.
const tagFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function heute() {
  return tagFormat.format(new Date()); // "2026-11-02"
}

export function tagPlus(tag, tage) {
  const [j, m, t] = tag.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, t + tage)).toISOString().slice(0, 10);
}

function alsUtc(tag) {
  const [j, m, t] = tag.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, t));
}

export function tagLang(tag) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  }).format(alsUtc(tag));
}

export function tagKurz(tag) {
  const h = heute();
  if (tag === h) return 'Heute';
  if (tag === tagPlus(h, -1)) return 'Gestern';
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
  }).format(alsUtc(tag));
}

export function vorWieLange(iso) {
  if (!iso) return '';
  const minuten = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minuten < 1) return 'gerade eben';
  if (minuten < 60) return `vor ${minuten} Min.`;
  const stunden = Math.round(minuten / 60);
  if (stunden < 24) return `vor ${stunden} Std.`;
  return stunden < 48 ? 'seit gestern' : `seit ${Math.round(stunden / 24)} Tagen`;
}

// ── „Was würdest du eher?“: Die Frage hängt nur vom Datum ab, beide sehen dieselbe.
const START = Date.UTC(2026, 0, 1);

export function eherFrageFuer(tag) {
  const tageSeitStart = Math.round((alsUtc(tag).getTime() - START) / 86400000);
  const n = EHER_FRAGEN.length;
  return EHER_FRAGEN[((tageSeitStart % n) + n) % n];
}

// ── Serie: Wie viele Tage in Folge habt ihr beide die Eher-Frage beantwortet?
// Heute zählt mit, sobald beide gewählt haben; sonst wird ab gestern gezählt.
export function serieBerechnen(eherAntworten, ichId, partnerId) {
  if (!partnerId) return 0;
  const proTag = new Map();
  for (const a of eherAntworten) {
    if (!proTag.has(a.tag)) proTag.set(a.tag, new Set());
    proTag.get(a.tag).add(a.autor);
  }
  const beide = (tag) => proTag.get(tag)?.has(ichId) && proTag.get(tag)?.has(partnerId);
  let tag = heute();
  if (!beide(tag)) tag = tagPlus(tag, -1);
  let serie = 0;
  while (beide(tag)) {
    serie += 1;
    tag = tagPlus(tag, -1);
  }
  return serie;
}

// ── Seit wann zusammen? Liefert die Zeile unter „Heute“ und erkennt besondere Tage.
// zusammenSeit('2026-06-14', '2026-11-03') → { text: 'Seit 4 Monaten und 20 Tagen zusammen', besonders: false }
const tageImMonat = (jahr, monat) => new Date(Date.UTC(jahr, monat, 0)).getUTCDate(); // monat 1–12

export function zusammenSeit(seit, tag = heute()) {
  if (!seit || seit > tag) return null;
  const [j1, m1, t1] = seit.split('-').map(Number);
  const [j2, m2, t2] = tag.split('-').map(Number);
  const tageGesamt = Math.round((alsUtc(tag) - alsUtc(seit)) / 86400000);

  // Ganze Monate: so viele, wie man auf das Startdatum addieren kann, ohne über heute hinauszukommen
  // (ein 31. wird in kürzeren Monaten zum letzten Tag). Der Rest sind Tage.
  const plusMonate = (n) => {
    const summe = m1 - 1 + n;
    const j = j1 + Math.floor(summe / 12);
    const m = (summe % 12) + 1;
    return Date.UTC(j, m - 1, Math.min(t1, tageImMonat(j, m)));
  };
  let monate = (j2 - j1) * 12 + (m2 - m1);
  if (plusMonate(monate) > alsUtc(tag)) monate -= 1;
  const tage = Math.round((alsUtc(tag) - plusMonate(monate)) / 86400000);
  const jahre = Math.floor(monate / 12);
  monate %= 12;

  // Besondere Tage: Jahrestag, Monatstag (am 31. zählt bei kurzen Monaten der letzte Tag), runde Zahlen
  const monatstag = t2 === Math.min(t1, tageImMonat(j2, m2)) && tageGesamt > 0;
  const ganzeMonate = (j2 - j1) * 12 + (m2 - m1);
  if (tageGesamt === 0) return { text: 'Heute ist euer erster gemeinsamer Tag 💞', besonders: true };
  if (monatstag && ganzeMonate % 12 === 0) {
    const n = ganzeMonate / 12;
    return { text: `Heute vor genau ${n} ${n === 1 ? 'Jahr' : 'Jahren'} 💞`, besonders: true };
  }
  if (monatstag) {
    return { text: `Heute vor genau ${ganzeMonate} ${ganzeMonate === 1 ? 'Monat' : 'Monaten'} 💞`, besonders: true };
  }
  if (tageGesamt % 100 === 0) return { text: `Heute seid ihr ${tageGesamt} Tage zusammen 💞`, besonders: true };

  const teile = [];
  if (jahre) teile.push(`${jahre} ${jahre === 1 ? 'Jahr' : 'Jahren'}`);
  if (monate) teile.push(`${monate} ${monate === 1 ? 'Monat' : 'Monaten'}`);
  if (tage) teile.push(`${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`);
  const liste = teile.length > 1 ? `${teile.slice(0, -1).join(', ')} und ${teile.at(-1)}` : teile[0];
  return { text: `Seit ${liste} zusammen`, besonders: false };
}

export function anfangsbuchstabe(name) {
  const b = String(name ?? '').trim().match(/\p{L}/u);
  return b ? b[0].toUpperCase() : '?';
}

// ── Effekte
const wenigBewegung = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function herzRegen(anzahl = 14) {
  if (wenigBewegung()) return;
  const ebene = document.createElement('div');
  ebene.className = 'herz-ebene';
  ebene.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < anzahl; i += 1) {
    const herz = document.createElement('span');
    herz.className = 'herz-flug';
    herz.style.left = `${8 + Math.random() * 84}%`;
    herz.style.animationDelay = `${Math.random() * 0.6}s`;
    herz.style.setProperty('--groesse', `${18 + Math.random() * 22}px`);
    herz.style.setProperty('--drift', `${(Math.random() - 0.5) * 80}px`);
    herz.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21s-8-4.9-8-11.2A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8 3.1C20 16.1 12 21 12 21z"/></svg>';
    ebene.appendChild(herz);
  }
  document.body.appendChild(ebene);
  setTimeout(() => ebene.remove(), 3200);
}

let hinweisTimer;
export function zeigeHinweis(text) {
  let el = document.getElementById('hinweis');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hinweis';
    el.className = 'hinweis';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('sichtbar');
  clearTimeout(hinweisTimer);
  hinweisTimer = setTimeout(() => el.classList.remove('sichtbar'), 3200);
}

export function vibrieren(muster = 12) {
  try { navigator.vibrate?.(muster); } catch { /* nicht überall verfügbar */ }
}
