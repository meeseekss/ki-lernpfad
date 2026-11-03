// Liest das Spielfeld nur über die data-Attribute der Seite und bietet Hilfen für die Bots.
// Positionen sind { z: zeile, s: spalte } wie in js/spiel.js.

export const RICHTUNGEN = {
  hoch: { z: -1, s: 0, taste: 'ArrowUp' },
  runter: { z: 1, s: 0, taste: 'ArrowDown' },
  links: { z: 0, s: -1, taste: 'ArrowLeft' },
  rechts: { z: 0, s: 1, taste: 'ArrowRight' },
};
export const GEGENTEIL = { hoch: 'runter', runter: 'hoch', links: 'rechts', rechts: 'links' };

export async function brettLesen(page) {
  const roh = await page.evaluate(() => {
    const feld = document.querySelector('[data-testid="spielfeld"]');
    const zellen = [...feld.querySelectorAll('[data-testid^="zelle-"]')]
      .filter((zelle) => zelle.dataset.inhalt !== 'leer')
      .map((zelle) => [zelle.dataset.testid, zelle.dataset.inhalt, zelle.dataset.index]);
    return {
      zeilen: Number(feld.dataset.zeilen),
      spalten: Number(feld.dataset.spalten),
      richtung: feld.dataset.richtung,
      zellen,
      punkte: Number(document.querySelector('[data-testid="punkte"]').textContent),
      vorbei: !document.querySelector('[data-testid="game-over"]').hidden,
    };
  });

  // belegt: alle Körperfelder (mit Kopf); koerper: dieselben Felder in Reihenfolge aus data-index, Kopf zuerst
  const brett = { ...roh, kopf: null, futter: null, belegt: new Set(), koerper: [] };
  delete brett.zellen;
  for (const [testid, inhalt, index] of roh.zellen) {
    const [, z, s] = testid.split('-').map(Number);
    if (inhalt === 'futter') {
      brett.futter = { z, s };
    } else {
      brett.belegt.add(schluessel({ z, s }));
      brett.koerper[Number(index)] = { z, s };
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

export const gleich = (a, b) => a.z === b.z && a.s === b.s;

export function imFeld(brett, pos) {
  return pos.z >= 0 && pos.z < brett.zeilen && pos.s >= 0 && pos.s < brett.spalten;
}

export function frei(brett, pos, belegt = brett.belegt) {
  return imFeld(brett, pos) && !belegt.has(schluessel(pos));
}

// Züge, die nicht sofort tödlich sind. Die Umkehr fällt weg: Das Spiel ignoriert sie und läuft geradeaus.
export function sichereZuege(brett) {
  return Object.keys(RICHTUNGEN)
    .filter((richtung) => richtung !== GEGENTEIL[brett.richtung])
    .filter((richtung) => frei(brett, ziel(brett.kopf, richtung)));
}
