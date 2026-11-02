// Demo-Modus: alles bleibt im Browser, eine ausgedachte Partnerin („Sie“) spielt mit.
// Die Sichtbarkeitsregeln sind dieselben wie in der echten Datenbank.

import { heute, tagPlus, eherFrageFuer } from './hilfen.js';

const SPEICHER = 'wir-zwei-demo';
const ICH = 'ich';
const SIE = 'sie';

const IHRE_ANTWORTEN = [
  'Ein Otter. Kuscheln, schwimmen, Snacks.',
  'Ganz klar: Pinguin. Ich watschle sowieso schon so.',
  'Puh, schwierig … aber wahrscheinlich das Gleiche wie du 😄',
  'Etwas mit ganz viel Käse.',
  'Frag mich das heute Abend noch mal, dann erzähl ich mehr.',
];

let gedaechtnis = null; // falls localStorage gesperrt ist

function lesen() {
  try {
    const roh = localStorage.getItem(SPEICHER);
    if (roh) return JSON.parse(roh);
  } catch { /* privater Modus o. Ä. */ }
  return gedaechtnis;
}

function schreiben(stand) {
  gedaechtnis = stand;
  try { localStorage.setItem(SPEICHER, JSON.stringify(stand)); } catch { /* egal */ }
}

function startStand() {
  const h = heute();
  const vor = (tage) => tagPlus(h, -tage);
  const eher = [];
  for (let t = 1; t <= 4; t += 1) {
    eher.push({ tag: vor(t), autor: ICH, wahl: t % 2 });
    eher.push({ tag: vor(t), autor: SIE, wahl: t === 2 ? 1 : t % 2 });
  }
  eher.push({ tag: h, autor: SIE, wahl: eherFrageFuer(h)[0].length % 2 });
  return {
    angelegtAm: h,
    ich: { id: ICH, name: 'Du', stimmung: null, stimmungSeit: null },
    partner: {
      id: SIE, name: 'Sie', stimmung: 'arm',
      stimmungSeit: new Date(Date.now() - 12 * 60000).toISOString(),
    },
    fragen: [
      { id: 'f-sie-heute', autor: SIE, tag: h, text: 'Welches Essen beschreibt deine Woche am besten?' },
      { id: 'f-ich-gestern', autor: ICH, tag: vor(1), text: 'Wenn du ein Tier wärst, welches wärst du?' },
      { id: 'f-sie-gestern', autor: SIE, tag: vor(1), text: 'Welcher Song läuft gerade in deinem Kopf?' },
      { id: 'f-sie-vorgestern', autor: SIE, tag: vor(2), text: 'Was war diese Woche dein kleiner Glücksmoment?' },
    ],
    antworten: [
      { frageId: 'f-sie-heute', autor: SIE, text: 'Eine Ramen-Suppe: viel los, aber wärmt.' },
      { frageId: 'f-ich-gestern', autor: ICH, text: 'Ein Faultier. Ich brauche heute Ruhe.' },
      { frageId: 'f-ich-gestern', autor: SIE, text: 'Eine Katze: tagsüber faul, nachts voller Energie.' },
      { frageId: 'f-sie-gestern', autor: ICH, text: 'Irgendein Weihnachtslied. Viel zu früh, ich weiß.' },
      { frageId: 'f-sie-gestern', autor: SIE, text: 'Das Lied aus unserem ersten Urlaub.' },
      { frageId: 'f-sie-vorgestern', autor: ICH, text: 'Deine Sprachnachricht am Dienstag.' },
      { frageId: 'f-sie-vorgestern', autor: SIE, text: 'Warmer Kakao nach dem Regen.' },
    ],
    eher,
  };
}

export function erstelleDemoDaten() {
  let beiAenderung = () => {};
  let beiGeste = () => {};

  function stand() {
    let s = lesen();
    // Jeden Tag frisch, damit „heute“ in der Demo immer etwas zu tun hat.
    if (!s || s.angelegtAm !== heute()) {
      s = startStand();
      schreiben(s);
    }
    return s;
  }

  function aendern(fn) {
    const s = stand();
    fn(s);
    schreiben(s);
  }

  // Sie reagiert nach kurzer Zeit, damit man das Aufdecken in der Demo erlebt.
  function sieAntwortetSpaeter(frageId) {
    setTimeout(() => {
      aendern((s) => {
        if (s.antworten.some((a) => a.frageId === frageId && a.autor === SIE)) return;
        const text = IHRE_ANTWORTEN[Math.floor(Math.random() * IHRE_ANTWORTEN.length)];
        s.antworten.push({ frageId, autor: SIE, text });
      });
      beiAenderung();
    }, 2500);
  }

  return {
    demo: true,
    async status() { return 'bereit'; },
    async registrieren() { return 'angemeldet'; },
    async anmelden() {},
    async paarErstellen() { return 'DEMO42'; },
    async paarBeitreten() {},

    async laden() {
      const s = stand();
      const h = heute();
      const ichHabe = new Set(s.antworten.filter((a) => a.autor === ICH).map((a) => a.frageId));
      const ichEher = new Set(s.eher.filter((e) => e.autor === ICH).map((e) => e.tag));
      return {
        ich: { ...s.ich },
        partner: { ...s.partner },
        paarCode: 'DEMO42',
        fragen: s.fragen.filter((f) => f.autor === ICH || f.tag <= h),
        antworten: s.antworten.filter((a) => a.autor === ICH || ichHabe.has(a.frageId)),
        partnerHatBeantwortet: s.antworten.filter((a) => a.autor === SIE).map((a) => a.frageId),
        eher: s.eher.filter((e) => e.autor === ICH || ichEher.has(e.tag)),
        partnerEherHeute: s.eher.some((e) => e.autor === SIE && e.tag === h),
      };
    },

    async stimmungSetzen(schluessel) {
      aendern((s) => { s.ich.stimmung = schluessel; s.ich.stimmungSeit = new Date().toISOString(); });
    },

    async nameSetzen(name) {
      aendern((s) => { s.ich.name = name; });
    },

    async frageStellen(text, tag) {
      const id = `f-ich-${tag}`;
      aendern((s) => {
        if (s.fragen.some((f) => f.autor === ICH && f.tag === tag)) throw new Error('Das hast du schon gespeichert.');
        s.fragen.push({ id, autor: ICH, tag, text });
      });
      if (tag === heute()) sieAntwortetSpaeter(id);
    },

    async antworten(frageId, text) {
      aendern((s) => {
        if (s.antworten.some((a) => a.frageId === frageId && a.autor === ICH)) {
          throw new Error('Deine Antwort steht schon fest.');
        }
        s.antworten.push({ frageId, autor: ICH, text });
      });
    },

    async eherWaehlen(wahl) {
      aendern((s) => {
        if (s.eher.some((e) => e.autor === ICH && e.tag === heute())) throw new Error('Deine Wahl steht schon fest.');
        s.eher.push({ tag: heute(), autor: ICH, wahl });
      });
    },

    async gesteSenden(art) {
      // In der Demo schickt sie die Umarmung zurück, damit man die Animation sieht.
      if (art === 'umarmung') setTimeout(() => beiGeste('umarmung'), 3500);
    },

    abonnieren(aenderung, geste) {
      beiAenderung = aenderung;
      beiGeste = geste;
    },

    async abmelden() {},
    async pushAbonnieren() {},
    async pushAbmelden() {},
    benachrichtigen() {},

    zuruecksetzen() {
      schreiben(startStand());
    },
  };
}
