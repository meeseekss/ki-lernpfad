// Darstellung und Steuerung. ?modus=bot → ein Schritt pro Pfeiltaste, sonst Echtzeit. ?seed=42 → feste Futterfolge.
import { ZEILEN, SPALTEN, neuesSpiel, richtungAendern, schritt, zufallMitSeed, gleich } from './spiel.js';

const parameter = new URLSearchParams(location.search);
const BOT_MODUS = parameter.get('modus') === 'bot';
const TAKT_MS = 150;
const TASTEN = { ArrowUp: 'hoch', ArrowDown: 'runter', ArrowLeft: 'links', ArrowRight: 'rechts' };

const feld = document.querySelector('[data-testid="spielfeld"]');
const punkteAnzeige = document.querySelector('[data-testid="punkte"]');
const gameOver = document.querySelector('[data-testid="game-over"]');
const hinweis = document.querySelector('[data-testid="hinweis"]');
const seedAnzeige = document.querySelector('[data-testid="seed"]');

// Ohne gültigen Seed in der URL einmal zufällig würfeln; „Neues Spiel“ nimmt denselben Seed
const urlSeed = Number.parseInt(parameter.get('seed'), 10);
const seed = Number.isFinite(urlSeed) ? urlSeed : Math.floor(Math.random() * 2 ** 32);

let zufall;
let zustand;
let takt = null;

function zellenBauen() {
  feld.style.setProperty('--spalten', SPALTEN);
  feld.dataset.zeilen = ZEILEN;
  feld.dataset.spalten = SPALTEN;
  feld.dataset.modus = BOT_MODUS ? 'bot' : 'echtzeit';
  for (let z = 0; z < ZEILEN; z++) {
    for (let s = 0; s < SPALTEN; s++) {
      const zelle = document.createElement('div');
      zelle.dataset.testid = `zelle-${z}-${s}`; // ergibt data-testid="zelle-z-s"
      feld.append(zelle);
    }
  }
}

function zeichnen() {
  // Position → Stelle in der Schlange (0 = Kopf, länge − 1 = Schwanz), steht als data-index an der Zelle
  const stelle = new Map(zustand.schlange.map((teil, i) => [`${teil.z}-${teil.s}`, i]));
  for (const zelle of feld.children) {
    const [, z, s] = zelle.dataset.testid.split('-').map(Number);
    const i = stelle.get(`${z}-${s}`);
    if (i === undefined) {
      zelle.dataset.inhalt = zustand.futter && gleich(zustand.futter, { z, s }) ? 'futter' : 'leer';
      delete zelle.dataset.index;
    } else {
      zelle.dataset.inhalt = i === 0 ? 'kopf' : 'schlange';
      zelle.dataset.index = i;
    }
  }
  feld.dataset.richtung = zustand.richtung;
  punkteAnzeige.textContent = zustand.punkte;
  gameOver.hidden = !zustand.vorbei;
}

function weiter() {
  schritt(zustand, zufall);
  zeichnen();
  if (zustand.vorbei) stoppen();
}

function stoppen() {
  clearInterval(takt);
  takt = null;
}

function starten() {
  stoppen();
  zufall = zufallMitSeed(seed);
  zustand = neuesSpiel(zufall);
  hinweis.hidden = BOT_MODUS;
  zeichnen();
}

document.addEventListener('keydown', (ereignis) => {
  const richtung = TASTEN[ereignis.key];
  if (!richtung || zustand.vorbei) return;
  ereignis.preventDefault(); // Seite nicht scrollen
  richtungAendern(zustand, richtung);
  if (BOT_MODUS) {
    weiter(); // Umkehr wird ignoriert, der Schritt geht dann geradeaus
  } else if (takt === null) {
    hinweis.hidden = true;
    takt = setInterval(weiter, TAKT_MS);
  }
});

document.querySelector('[data-testid="neustart"]').addEventListener('click', (ereignis) => {
  ereignis.currentTarget.blur(); // sonst „drückt“ die Leertaste später den Knopf
  starten();
});

seedAnzeige.textContent = seed;
zellenBauen();
starten();
