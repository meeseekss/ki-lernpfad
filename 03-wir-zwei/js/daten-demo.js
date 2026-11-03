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

// Beispielfoto der Demo-Partnerin: gezeichnet statt fotografiert (Herbstspaziergang + Selfie).
const svgBild = (inhalt, b, h) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${b} ${h}">${inhalt}</svg>`)}`;
const DEMO_HINTEN = svgBild(`
  <defs><linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7C59F"/><stop offset="1" stop-color="#F2E3D5"/></linearGradient></defs>
  <rect width="300" height="400" fill="url(#h)"/>
  <circle cx="220" cy="110" r="38" fill="#FFE29A"/>
  <path d="M0 260 Q80 200 160 250 T300 230 V400 H0z" fill="#D98E5F"/>
  <path d="M0 300 Q90 260 180 300 T300 290 V400 H0z" fill="#B5643C"/>
  <g fill="#7A4A2A"><rect x="60" y="190" width="10" height="90"/><rect x="230" y="200" width="9" height="80"/></g>
  <g fill="#E07A3F"><circle cx="65" cy="180" r="34"/><circle cx="234" cy="190" r="28"/></g>
  <g fill="#C2415B" opacity=".85"><circle cx="40" cy="350" r="6"/><circle cx="120" cy="340" r="5"/><circle cx="200" cy="360" r="7"/><circle cx="260" cy="335" r="5"/></g>`, 300, 400);
const DEMO_VORNE = svgBild(`
  <rect width="150" height="200" fill="#FBEDF0"/>
  <circle cx="75" cy="92" r="42" fill="#F3C9A8"/>
  <path d="M33 86 Q35 40 75 40 Q117 40 117 86 Q105 60 75 62 Q45 60 33 86z" fill="#6B3B2A"/>
  <circle cx="60" cy="92" r="4" fill="#2B2B2B"/><circle cx="90" cy="92" r="4" fill="#2B2B2B"/>
  <path d="M60 110 Q75 122 90 110" stroke="#2B2B2B" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="52" cy="104" r="6" fill="#F19BB0" opacity=".6"/><circle cx="98" cy="104" r="6" fill="#F19BB0" opacity=".6"/>
  <path d="M20 200 Q75 140 130 200z" fill="#C2415B"/>`, 150, 200);

function blobAlsDatenUrl(blob) {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onload = () => fertig(leser.result);
    leser.onerror = fehler;
    leser.readAsDataURL(blob);
  });
}

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
    zusammenSeit: tagPlus(h, -142),
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
    fotos: [
      { autor: SIE, tag: h, erstelltAm: new Date(Date.now() - 95 * 60000).toISOString(), hinten: DEMO_HINTEN, vorne: DEMO_VORNE },
    ],
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
        zusammenSeit: s.zusammenSeit ?? null,
        fragen: s.fragen.filter((f) => f.autor === ICH || f.tag <= h),
        antworten: s.antworten.filter((a) => a.autor === ICH || ichHabe.has(a.frageId)),
        partnerHatBeantwortet: s.antworten.filter((a) => a.autor === SIE).map((a) => a.frageId),
        eher: s.eher.filter((e) => e.autor === ICH || ichEher.has(e.tag)),
        partnerEherHeute: s.eher.some((e) => e.autor === SIE && e.tag === h),
        fotos: (s.fotos ?? []).filter((f) => f.tag === h),
      };
    },

    async fotoPosten(hinten, vorne) {
      const [a, b] = await Promise.all([blobAlsDatenUrl(hinten), blobAlsDatenUrl(vorne)]);
      aendern((s) => {
        s.fotos = s.fotos ?? [];
        if (s.fotos.some((f) => f.autor === ICH && f.tag === heute())) throw new Error('Du hast heute schon ein Foto gepostet.');
        s.fotos.push({ autor: ICH, tag: heute(), erstelltAm: new Date().toISOString(), hinten: a, vorne: b });
      });
    },

    async stimmungSetzen(schluessel) {
      aendern((s) => { s.ich.stimmung = schluessel; s.ich.stimmungSeit = new Date().toISOString(); });
    },

    async zusammenSeitSetzen(datum) {
      aendern((s) => { s.zusammenSeit = datum || null; });
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
