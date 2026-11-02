import { chromium, type Locator, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

interface Seite {
  name: string; // wird zum Ordnernamen unter screenshots/
  url: string;
  // Buttons, die vor dem Foto der Reihe nach geklickt werden (Cookie-Banner, Abo-Popups …).
  // Jeder Eintrag ist ein Muster für die Button-Beschriftung; weglassen, wenn die Seite nichts davon hat.
  wegklicken?: RegExp[];
}

// Akzeptieren statt Ablehnen: spiegel.de leitet beim Ablehnen auf eine Pur-Abo-Seite um.
const SEITEN: Seite[] = [
  { name: 'tagesschau', url: 'https://www.tagesschau.de', wegklicken: [/Alle akzeptieren|Einverstanden|Akzeptieren/i] },
  {
    name: 'spiegel',
    url: 'https://www.spiegel.de',
    // Erst Cookie-Banner, danach erscheint ein Abo-Popup mit ✕.
    wegklicken: [/Einwilligen und weiter|Akzeptieren und weiter/i, /Dialog schließen/i],
  },
  { name: 'wikipedia', url: 'https://de.wikipedia.org' },
  {
    name: 'heise',
    url: 'https://www.heise.de',
    // Erst Cookie-Banner, danach eine heise+-Werbeleiste am unteren Rand mit ✕.
    wegklicken: [/Zustimmen|Alle akzeptieren|Akzeptieren/i, /Footer schließen/i],
  },
];

const FENSTER = { width: 1280, height: 800 };
const JPEG_QUALITAET = 80;
const OVERLAY_TIMEOUT_MS = 10_000;
const RUHEPAUSE_MS = 2000;
const ZIELORDNER = path.join(__dirname, 'screenshots');

// Datum in deutscher Zeit, nicht UTC – sonst stimmt der Dateiname kurz nach Mitternacht nicht.
// Das schwedische Format ist zufällig genau JJJJ-MM-TT.
function heute(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
}

// isVisible() kann in halb geladenen (Werbe-)iframes ewig hängen, deshalb mit Zeitlimit.
async function sichtbar(button: Locator): Promise<boolean> {
  const zuSpaet = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000).unref());
  return Promise.race([button.isVisible().catch(() => false), zuSpaet]);
}

// Consent-Banner stecken oft in einem iframe (z. B. Sourcepoint bei spiegel.de),
// darum Hauptseite und alle Frames nach dem Button absuchen.
async function overlayWegklicken(page: Page, muster: RegExp): Promise<boolean> {
  const ende = Date.now() + OVERLAY_TIMEOUT_MS;
  while (Date.now() < ende) {
    for (const frame of page.frames()) {
      if (frame.isDetached()) continue;
      const button: Locator = frame.getByRole('button', { name: muster }).first();
      if (await sichtbar(button)) {
        await button.click();
        await button.waitFor({ state: 'hidden', timeout: OVERLAY_TIMEOUT_MS }).catch(() => {});
        return true;
      }
    }
    await page.waitForTimeout(250);
  }
  return false;
}

async function main(): Promise<void> {
  const datum = heute();
  const fehlgeschlagen: { name: string; fehler: string }[] = [];
  const browser = await chromium.launch();

  try {
    for (const seite of SEITEN) {
      // Frischer Context pro Seite: keine Cookies von vorher, jeder Lauf sieht aus wie in CI.
      const context = await browser.newContext({
        viewport: FENSTER,
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
      });
      try {
        const page = await context.newPage();
        await page.goto(seite.url, { waitUntil: 'load', timeout: 60_000 });

        // Nicht gefunden ist kein Fehler: Overlays kommen nicht bei jedem Aufruf (z. B. andere IP in CI).
        for (const muster of seite.wegklicken ?? []) {
          const geklickt = await overlayWegklicken(page, muster);
          console.log(`[${seite.name}] ${geklickt ? 'weggeklickt' : 'Hinweis: nicht gefunden'}: ${muster}`);
        }

        // Zeit für Lazy-Bilder und Neu-Layout nach den Overlays.
        await page.waitForTimeout(RUHEPAUSE_MS);

        const ordner = path.join(ZIELORDNER, seite.name);
        await mkdir(ordner, { recursive: true });
        const datei = path.join(ordner, `${datum}.jpg`);
        await page.screenshot({ path: datei, type: 'jpeg', quality: JPEG_QUALITAET, fullPage: false });
        console.log(`[${seite.name}] gespeichert: ${path.relative(__dirname, datei)}`);
      } catch (e) {
        // Eine kaputte Seite soll die anderen nicht verhindern; ausgewertet wird am Ende.
        const fehler = e instanceof Error ? e.message.split('\n')[0] : String(e);
        console.error(`[${seite.name}] FEHLER: ${fehler}`);
        fehlgeschlagen.push({ name: seite.name, fehler });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  if (fehlgeschlagen.length > 0) {
    console.error(`\n${fehlgeschlagen.length} von ${SEITEN.length} Seiten fehlgeschlagen:`);
    for (const f of fehlgeschlagen) console.error(`  - ${f.name}: ${f.fehler}`);
    // exitCode statt exit(): Ausgaben werden noch vollständig geschrieben.
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
