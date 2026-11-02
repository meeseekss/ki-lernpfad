import { test, expect, type Page } from '@playwright/test';

const BASE = 'https://en.wikipedia.org';
const TARGET = 'Philosophy';
const START_ARTICLES = 10;
const MAX_CLICKS = 50;
const PAUSE_MS = 1000;

type Outcome = 'philosophy' | 'loop' | 'max-clicks' | 'dead-end';

interface Walk {
  start: string;
  clicks: number;
  outcome: Outcome;
  path: string[];
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  'philosophy': 'Philosophy erreicht',
  'loop': 'Schleife',
  'max-clicks': `Abbruch nach ${MAX_CLICKS} Klicks`,
  'dead-end': 'Sackgasse (kein gültiger Link)',
};

// Wikipedia bittet Bots um einen beschreibenden User-Agent.
test.use({ userAgent: 'ki-lernpfad-philosophie-bot/1.0 (Lernprojekt, Playwright)' });

// Der kanonische Link steht im <head> und ist schon nach Weiterleitungen aufgelöst
// (z. B. /wiki/Philosophical → Philosophy), anders als page.url().
async function currentTitle(page: Page): Promise<string> {
  const href = await page.locator('link[rel="canonical"]').getAttribute('href');
  const path = new URL(href ?? page.url()).pathname;
  return decodeURIComponent(path.replace(/^\/wiki\//, '')).replace(/_/g, ' ');
}

async function findFirstValidLink(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const NAMESPACE = /^(File|Image|Help|Wikipedia|Template|Category|Portal|Special|Talk|Draft|Module|User)(_talk)?:/i;

    // Entscheidet, ob ein Kandidat der "erste gültige Link" ist.
    // link:       das <a>-Element im Absatz
    // textBefore: der gesamte Text des Absatzes vor diesem Link
    function isValidLink(link: HTMLAnchorElement, textBefore: string): boolean {
      // Klammertiefe zählen; überzählige ")" ignorieren, damit die Tiefe nie negativ wird.
      let depth = 0;
      for (const ch of textBefore) {
        if (ch === '(') depth++;
        else if (ch === ')' && depth > 0) depth--;
      }
      if (depth > 0) return false;

      // Kursiv per Markup (<i>, <em>) oder per CSS.
      return !link.closest('i, em') && getComputedStyle(link).fontStyle !== 'italic';
    }

    // Nur Absätze direkt im Fließtext (Parsoid packt sie in <section>):
    // Infobox, Hatnotes, Tabellen und Bildunterschriften fallen so raus.
    const paragraphs = document.querySelectorAll<HTMLParagraphElement>(
      '#mw-content-text .mw-parser-output > p, #mw-content-text .mw-parser-output > section > p',
    );
    for (const p of paragraphs) {
      for (const link of p.querySelectorAll<HTMLAnchorElement>('a[href]')) {
        // link.href ist immer absolut, egal ob im HTML "/wiki/X", "./X" oder die volle URL steht.
        const url = new URL(link.href);
        if (url.host !== location.host || !url.pathname.startsWith('/wiki/')) continue;
        // Rotlinks (?redlink=1) und Fußnoten/Selbstlinks (#cite_note…) aussortieren.
        if (link.classList.contains('new') || url.search || url.pathname === location.pathname) continue;
        if (NAMESPACE.test(decodeURIComponent(url.pathname.slice('/wiki/'.length)))) continue;
        const href = url.pathname;

        const range = document.createRange();
        range.setStart(p, 0);
        range.setEndBefore(link);
        if (isValidLink(link, range.toString())) return href;
      }
    }
    return null;
  });
}

async function walk(page: Page): Promise<Walk> {
  await page.waitForTimeout(PAUSE_MS);
  await page.goto(`${BASE}/wiki/Special:Random`, { waitUntil: 'domcontentloaded' });

  const start = await currentTitle(page);
  const path = [start];
  const visited = new Set(path);
  let clicks = 0;

  while (true) {
    if (path[path.length - 1] === TARGET) return { start, clicks, outcome: 'philosophy', path };
    if (clicks >= MAX_CLICKS) return { start, clicks, outcome: 'max-clicks', path };

    const href = await findFirstValidLink(page);
    if (!href) return { start, clicks, outcome: 'dead-end', path };

    await page.waitForTimeout(PAUSE_MS);
    await page.goto(BASE + href, { waitUntil: 'domcontentloaded' });
    clicks++;

    const title = await currentTitle(page);
    path.push(title);
    if (visited.has(title)) return { start, clicks, outcome: 'loop', path };
    visited.add(title);
  }
}

test('Alle Wege führen zu Philosophy', async ({ page }, testInfo) => {
  test.setTimeout(30 * 60 * 1000);

  const walks: Walk[] = [];
  for (let i = 1; i <= START_ARTICLES; i++) {
    const result = await walk(page);
    console.log(`[${i}/${START_ARTICLES}] ${result.start}: ${OUTCOME_LABEL[result.outcome]} (${result.clicks} Klicks)`);
    walks.push(result);
  }

  // Erfolge nach Klickzahl aufsteigend, Fehlschläge dahinter.
  const ranked = [...walks].sort((a, b) => {
    const aOk = a.outcome === 'philosophy';
    const bOk = b.outcome === 'philosophy';
    if (aOk !== bOk) return aOk ? -1 : 1;
    return a.clicks - b.clicks;
  });

  let place = 0;
  const table = ranked.map((w) => ({
    Platz: w.outcome === 'philosophy' ? ++place : '–',
    Startartikel: w.start,
    Klicks: w.clicks,
    Ergebnis: OUTCOME_LABEL[w.outcome],
  }));

  console.table(table);
  await testInfo.attach('rangliste.json', {
    body: JSON.stringify(ranked, null, 2),
    contentType: 'application/json',
  });

  // Erst nach Ausgabe und Anhang prüfen, damit die Rangliste auch bei einem Fehlschlag sichtbar bleibt.
  expect(place, 'Mindestens ein Startartikel muss Philosophy erreichen').toBeGreaterThanOrEqual(1);
});
