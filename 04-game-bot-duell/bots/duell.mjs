// Duell: beide Bots spielen Snake im Bot-Modus mit den Seeds 1–20. Start: npm run duell
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { zufallMitSeed } from '../js/spiel.js';
import { brettLesen, RICHTUNGEN } from './brett.mjs';
import { strategieZug, zufallsZug } from './bots.mjs';

const ADRESSE = 'http://localhost:4174';
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const MAX_SCHRITTE = 2000;

// neu(seed) liefert pro Runde eine Zugfunktion; der Zufallsbot würfelt mit dem Seed, damit Läufe wiederholbar sind
const BOTS = [
  { name: 'Zufall', neu: (seed) => { const zufall = zufallMitSeed(seed); return (brett) => zufallsZug(brett, zufall); } },
  { name: 'Strategie', neu: () => strategieZug },
];

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

async function runde(page, bot, seed) {
  const zug = bot.neu(seed);
  await page.goto(`${ADRESSE}/?modus=bot&seed=${seed}`);
  let brett = await brettLesen(page);
  let schritte = 0;
  while (!brett.vorbei && schritte < MAX_SCHRITTE) {
    await page.keyboard.press(RICHTUNGEN[zug(brett)].taste);
    schritte++;
    brett = await brettLesen(page);
  }
  return { punkte: brett.punkte, schritte, limit: !brett.vorbei };
}

// Jeder Bot bekommt eine eigene Seite, beide spielen gleichzeitig
async function botSpielen(browser, bot) {
  const page = await browser.newPage();
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

const server = await serverStarten();
const browser = await chromium.launch();
try {
  const ergebnisse = await Promise.all(BOTS.map((bot) => botSpielen(browser, bot)));
  tabelleAusgeben(ergebnisse);
} finally {
  await browser.close();
  server?.kill();
}
