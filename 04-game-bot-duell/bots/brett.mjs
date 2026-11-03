// Liest das Spielfeld nur über die data-Attribute der Seite und bietet Hilfen für die Bots.
// Positionen sind { z: zeile, s: spalte } wie in js/spiel.js.

export const RICHTUNGEN = {
  hoch: { z: -1, s: 0, taste: 'ArrowUp' },
  runter: { z: 1, s: 0, taste: 'ArrowDown' },
  links: { z: 0, s: -1, taste: 'ArrowLeft' },
  rechts: { z: 0, s: 1, taste: 'ArrowRight' },
};
const GEGENTEIL = { hoch: 'runter', runter: 'hoch', links: 'rechts', rechts: 'links' };

export async function brettLesen(page) {
  const roh = await page.evaluate(() => {
    const feld = document.querySelector('[data-testid="spielfeld"]');
    const zellen = [...feld.querySelectorAll('[data-testid^="zelle-"]')]
      .filter((zelle) => zelle.dataset.inhalt !== 'leer')
      .map((zelle) => [zelle.dataset.testid, zelle.dataset.inhalt]);
    return {
      zeilen: Number(feld.dataset.zeilen),
      spalten: Number(feld.dataset.spalten),
      richtung: feld.dataset.richtung,
      zellen,
      punkte: Number(document.querySelector('[data-testid="punkte"]').textContent),
      vorbei: !document.querySelector('[data-testid="game-over"]').hidden,
    };
  });

  // Die Reihenfolge der Körperteile steht nicht im DOM, also ist der ganze Körper (mit Kopf) belegt
  const brett = { ...roh, kopf: null, futter: null, belegt: new Set() };
  delete brett.zellen;
  for (const [testid, inhalt] of roh.zellen) {
    const [, z, s] = testid.split('-').map(Number);
    if (inhalt === 'futter') {
      brett.futter = { z, s };
    } else {
      brett.belegt.add(schluessel({ z, s }));
      if (inhalt === 'kopf') brett.kopf = { z, s };
    }
  }
  return brett;
}

export const schluessel = ({ z, s }) => `${z},${s}`;

export function ziel(pos, richtung) {
  const d = RICHTUNGEN[richtung];
  return { z: pos.z + d.z, s: pos.s + d.s };
}

export function frei(brett, pos, belegt = brett.belegt) {
  return pos.z >= 0 && pos.z < brett.zeilen && pos.s >= 0 && pos.s < brett.spalten && !belegt.has(schluessel(pos));
}

// Züge, die nicht sofort tödlich sind. Die Umkehr fällt weg: Das Spiel ignoriert sie und läuft geradeaus.
export function sichereZuege(brett) {
  return Object.keys(RICHTUNGEN)
    .filter((richtung) => richtung !== GEGENTEIL[brett.richtung])
    .filter((richtung) => frei(brett, ziel(brett.kopf, richtung)));
}
