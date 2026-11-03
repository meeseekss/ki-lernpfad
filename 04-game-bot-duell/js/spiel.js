// Spielregeln ohne DOM. Positionen sind { z: zeile, s: spalte }, die Schlange steht Kopf zuerst.

export const ZEILEN = 15;
export const SPALTEN = 15;

export const RICHTUNGEN = {
  hoch: { z: -1, s: 0 },
  runter: { z: 1, s: 0 },
  links: { z: 0, s: -1 },
  rechts: { z: 0, s: 1 },
};
const GEGENTEIL = { hoch: 'runter', runter: 'hoch', links: 'rechts', rechts: 'links' };

// Mulberry32: kleiner Zufallsgenerator – gleicher Seed, gleiche Zahlenfolge
export function zufallMitSeed(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function neuesSpiel(zufall) {
  const mitte = Math.floor(ZEILEN / 2);
  const schlange = [{ z: mitte, s: 4 }, { z: mitte, s: 3 }, { z: mitte, s: 2 }];
  return {
    schlange,
    richtung: 'rechts', // zuletzt gelaufen
    geplant: 'rechts', // gilt ab dem nächsten Schritt
    futter: futterPlatzieren(schlange, zufall),
    punkte: 0,
    vorbei: false,
  };
}

// Verglichen wird mit der zuletzt gelaufenen Richtung, nicht mit der geplanten:
// Sonst könnte man in Echtzeit mit zwei schnellen Tasten (hoch, links) innerhalb eines Takts umkehren.
export function richtungAendern(zustand, neu) {
  if (!RICHTUNGEN[neu] || neu === GEGENTEIL[zustand.richtung]) return;
  zustand.geplant = neu;
}

export function schritt(zustand, zufall) {
  if (zustand.vorbei) return;
  zustand.richtung = zustand.geplant;
  const d = RICHTUNGEN[zustand.richtung];
  const kopf = zustand.schlange[0];
  const neu = { z: kopf.z + d.z, s: kopf.s + d.s };
  const frisst = zustand.futter !== null && gleich(neu, zustand.futter);
  // Ohne Fressen rückt der Schwanz weiter, der Kopf darf also auf das alte Schwanzfeld
  const koerper = frisst ? zustand.schlange : zustand.schlange.slice(0, -1);

  if (ausserhalb(neu) || koerper.some((teil) => gleich(teil, neu))) {
    zustand.vorbei = true;
    return;
  }

  zustand.schlange = [neu, ...koerper];
  if (frisst) {
    zustand.punkte += 1;
    zustand.futter = futterPlatzieren(zustand.schlange, zufall);
    if (zustand.futter === null) zustand.vorbei = true; // Feld voll
  }
}

// Gibt eine freie Position { z, s } zurück oder null, wenn kein Feld mehr frei ist.
// Verbraucht pro Futter genau eine Zufallszahl, egal wo die Schlange liegt:
// Bots mit gleichem Seed bekommen dieselbe Zahlenfolge.
export function futterPlatzieren(schlange, zufall) {
  const frei = [];
  for (let z = 0; z < ZEILEN; z++) {
    for (let s = 0; s < SPALTEN; s++) {
      if (!schlange.some((teil) => gleich(teil, { z, s }))) frei.push({ z, s });
    }
  }
  if (frei.length === 0) return null;
  return frei[Math.floor(zufall() * frei.length)];
}

export function gleich(a, b) {
  return a.z === b.z && a.s === b.s;
}

function ausserhalb({ z, s }) {
  return z < 0 || z >= ZEILEN || s < 0 || s >= SPALTEN;
}
