// Duell: beide Bots spielen Snake im Bot-Modus mit den Seeds 1–20. Start: npm run duell
// Zuschauen: SICHTBAR=1 [SEED=5] npm run duell → eine Runde, ein sichtbares Fenster pro Bot, 150 ms pro Schritt
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { zufallMitSeed } from '../js/spiel.js';
import { brettLesen, RICHTUNGEN } from './brett.mjs';
import { strategieMitSchwanz, strategieZug, zufallsZug } from './bots.mjs';

const ADRESSE = 'http://localhost:4174';
const MAX_SCHRITTE = 2000;
const SICHTBAR = process.env.SICHTBAR === '1';
const PAUSE_MS = 150;
const FENSTER = { breite: 520, hoehe: 760 }; // drei nebeneinander passen auf einen 1600 px breiten Bildschirm

function seedsBestimmen() {
  if (!SICHTBAR) return Array.from({ length: 20 }, (_, i) => i + 1);
  const seed = Number(process.env.SEED ?? 1);
  if (!Number.isInteger(seed)) throw new Error(`SEED muss eine ganze Zahl sein, nicht „${process.env.SEED}“`);
  return [seed];
}
const SEEDS = seedsBestimmen();

// neu(seed, beobachten) liefert pro Runde eine Zugfunktion; der Zufallsbot würfelt mit dem Seed, damit Läufe wiederholbar sind.
// Reihenfolge = Spalten der Tabelle und Fenster von links nach rechts.
const BOTS = [
  { name: 'Zufall', neu: (seed) => { const zufall = zufallMitSeed(seed); return (brett) => zufallsZug(brett, zufall); } },
  { name: 'Strategie alt', neu: (seed, beobachten) => (brett) => strategieZug(brett, beobachten) },
  { name: 'Strategie', neu: (seed, beobachten) => { const zug = strategieMitSchwanz(); return (brett) => zug(brett, beobachten); } },
];

// Nur im Zuschau-Modus: Felder, die die Strategie-Bots als erreichbar zählen (blau = genug Platz, orange = zu eng)
const ZUSCHAU_STIL = `
  [data-erreichbar="genug"] { box-shadow: inset 0 0 0 40px rgb(60 130 255 / 0.35); }
  [data-erreichbar="eng"] { box-shadow: inset 0 0 0 40px rgb(255 140 0 / 0.5); }
`;

const erreichbar = () => fetch(ADRESSE).then(() => true, () => false);

// Läuft schon ein Server (z. B. npm start), wird er benutzt, sonst startet das Skript einen eigenen
async function serverStarten() {
  if (await erreichbar()) return null;
  const server = spawn(process.execPath, ['tools/server.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'ignore',
  });
  for (let versuch = 0; versuch < 50; versuch++) {
    if (await erreichbar()) return server;
    await new Promise((fertig) => setTimeout(fertig, 100));
  }
  server.kill();
  throw new Error(`Server unter ${ADRESSE} startet nicht`);
}

// Normal: ein unsichtbarer Browser mit einer Seite pro Bot.
// Zuschauen: ein Browser pro Bot, weil Fensterposition und -größe Startargumente des Browsers sind.
async function seitenOeffnen() {
  if (!SICHTBAR) {
    const browser = await chromium.launch();
    return { browsers: [browser], seiten: await Promise.all(BOTS.map(() => browser.newPage())) };
  }
  const browsers = await Promise.all(BOTS.map((_, i) => chromium.launch({
    headless: false,
    args: [`--window-position=${i * FENSTER.breite},0`, `--window-size=${FENSTER.breite},${FENSTER.hoehe}`],
  })));
  const seiten = await Promise.all(browsers.map((browser) => browser.newPage({ viewport: null })));
  return { browsers, seiten };
}

async function zuschauVorbereiten(page, bot) {
  await page.addStyleTag({ content: ZUSCHAU_STIL });
  await page.evaluate((name) => { document.querySelector('h1').textContent = `Snake · ${name}`; }, bot.name);
}

async function erreichbarZeigen(page, { erreichbar, genug }) {
  const felder = [...erreichbar].map((k) => `zelle-${k.replace(',', '-')}`);
  await page.evaluate(({ felder, wert }) => {
    for (const zelle of document.querySelectorAll('[data-erreichbar]')) delete zelle.dataset.erreichbar;
    for (const testid of felder) {
      const zelle = document.querySelector(`[data-testid="${testid}"]`);
      if (zelle.dataset.inhalt !== 'kopf') zelle.dataset.erreichbar = wert;
    }
  }, { felder, wert: genug ? 'genug' : 'eng' });
}

async function runde(page, bot, seed) {
  let pruefung = null;
  const zug = bot.neu(seed, SICHTBAR ? (neu) => { pruefung = neu; } : undefined);
  await page.goto(`${ADRESSE}/?modus=bot&seed=${seed}`);
  if (SICHTBAR) await zuschauVorbereiten(page, bot);
  let brett = await brettLesen(page);
  let schritte = 0;
  while (!brett.vorbei && schritte < MAX_SCHRITTE) {
    await page.keyboard.press(RICHTUNGEN[zug(brett)].taste);
    schritte++;
    if (SICHTBAR) {
      if (pruefung) await erreichbarZeigen(page, pruefung);
      await page.waitForTimeout(PAUSE_MS);
    }
    brett = await brettLesen(page);
  }
  return { punkte: brett.punkte, schritte, limit: !brett.vorbei };
}

// Alle Bots spielen gleichzeitig, jeder auf seiner Seite
async function botSpielen(page, bot) {
  const ergebnisse = [];
  for (const seed of SEEDS) {
    ergebnisse.push(await runde(page, bot, seed));
    process.stdout.write('.');
  }
  return ergebnisse;
}

function tabelleAusgeben(ergebnisse) {
  const breite = Math.max(...BOTS.map((bot) => bot.name.length), 7);
  const zeile = (erste, werte) => `| ${erste.padEnd(5)} | ${werte.map((wert) => String(wert).padStart(breite)).join(' | ')} |`;
  const zelle = (e) => `${e.punkte}${e.limit ? '*' : ''}`;
  const schnitt = (liste) => (liste.reduce((summe, e) => summe + e.punkte, 0) / liste.length).toFixed(1);

  console.log('\n');
  console.log(zeile('Seed', BOTS.map((bot) => bot.name)));
  console.log(zeile('-----', BOTS.map(() => '-'.repeat(breite))));
  SEEDS.forEach((seed, i) => console.log(zeile(String(seed), ergebnisse.map((liste) => zelle(liste[i])))));
  console.log(zeile('Ø', ergebnisse.map(schnitt)));
  if (ergebnisse.flat().some((e) => e.limit)) console.log(`\n* nach ${MAX_SCHRITTE} Schritten abgebrochen, noch nicht tot`);
}

async function aufEnterWarten() {
  const eingabe = createInterface({ input: process.stdin, output: process.stdout });
  await eingabe.question('\nEnter drücken, um die Fenster zu schließen … ');
  eingabe.close();
}

const server = await serverStarten();
const { browsers, seiten } = await seitenOeffnen();
try {
  const ergebnisse = await Promise.all(BOTS.map((bot, i) => botSpielen(seiten[i], bot)));
  tabelleAusgeben(ergebnisse);
  if (SICHTBAR) await aufEnterWarten();
} catch (fehler) {
  if (!seiten.some((page) => page.isClosed())) throw fehler;
  console.error('\nEin Fenster wurde geschlossen, Duell abgebrochen.');
  process.exitCode = 1;
} finally {
  await Promise.all(browsers.map((browser) => browser.close()));
  server?.kill();
}
