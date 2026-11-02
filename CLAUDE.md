# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Überblick

Persönlicher KI-Lernpfad. Jedes Projekt liegt in einem eigenen nummerierten Ordner (`01-…`, `02-…`) mit eigenem `package.json` und `node_modules` – es gibt kein Root-Package und keinen Workspace. Befehle immer im jeweiligen Projektordner ausführen. Code, Kommentare, Bezeichner, Commit-Messages und READMEs sind auf Deutsch.

Einrichtung pro Projekt:

```bash
npm install
npx playwright install chromium   # 01 testet laut Config auch firefox und webkit → dort `npx playwright install`
```

Es gibt keine Typprüfung und keinen Linter: Kein Projekt hat `typescript` oder eine `tsconfig.json`. `tsx` und der Playwright-Runner entfernen die Typen nur, ohne sie zu prüfen – Typfehler fallen also beim Ausführen nicht auf.

## Regeln

- Antworte immer auf Deutsch.
- **READMEs haben zwei Zonen** (Root und Projekte): den Bereich zwischen `<!-- AUTO:START -->` und `<!-- AUTO:END -->` und darunter `## Meine Notizen`.
  - Nach jeder Code-Änderung den AUTO-Bereich der betroffenen README aktualisieren. Neue Projekte zusätzlich in die Tabelle im Root-`README.md` eintragen.
  - Den Abschnitt „Meine Notizen“ nie ändern.
- **Push:** Vorher immer nachfragen. Vor jedem Push erst `git pull --rebase`, weil ein Bot (`github-actions[bot]`) täglich Screenshots auf `main` committet.

## 01-philosophie-bot

Playwright-Test-Projekt (`@playwright/test`), das „Getting to Philosophy“ auf en.wikipedia.org nachspielt: `tests/philosophie.spec.ts` folgt dem ersten gültigen Link (nicht in Klammern, nicht kursiv, kein Namespace-Link) bis „Philosophy“, einer Schleife oder `MAX_CLICKS`.

```bash
cd 01-philosophie-bot
npx playwright test tests/philosophie.spec.ts --project=chromium
ANZAHL=3 ANSEHEN=1 npx playwright test tests/philosophie.spec.ts --project=chromium   # weniger Artikel, sichtbares Fenster
npx playwright test -g "Alle Wege führen zu Philosophy" --project=chromium            # einzelnen Test nach Name
npx playwright show-report                                                            # HTML-Report (Reporter laut Config)
```

`ANZAHL` = Zahl der Start-Artikel (Standard 10), `ANSEHEN=1` = headed + `page.pause()`. Die Config läuft sonst in chromium, firefox und webkit.

## 02-screenshot-zeitraffer

Kein Test-Runner, sondern ein Skript (`screenshot.ts`, ausgeführt mit `tsx`, Bibliothek `playwright`), das jede Seite aus der Liste `SEITEN` fotografiert und als `screenshots/<name>/<JJJJ-MM-TT>.jpg` speichert (1280×800, JPEG 80, Datum in Berliner Zeit).

```bash
cd 02-screenshot-zeitraffer
npm run screenshots
```

Zusammenspiel mit `.github/workflows/screenshot-zeitraffer.yml`:
- Zwei Cron-Zeiten (10:00 und 11:00 UTC); der Schritt „Zeit prüfen“ lässt anhand des Berliner UTC-Offsets nur die zur Sommer-/Winterzeit passende laufen, damit es immer 12 Uhr deutscher Zeit ist.
- Runner fest auf `ubuntu-24.04`, damit die Schriftdarstellung im Zeitraffer gleich bleibt.
- Das Skript läuft nach einer kaputten Seite weiter und endet mit Exit-Code 1; der Commit-Schritt (`!cancelled()`) sichert trotzdem die gelungenen Bilder.
- Cookie-Banner/Popups: pro Seite `wegklicken: RegExp[]`, die nacheinander abgearbeitet werden; `overlayWegklicken()` sucht in der Hauptseite und allen iframes. Nicht gefundene Buttons sind kein Fehler (nur Log-Hinweis).

**Lokal erzeugte Screenshots nicht committen** (macOS rendert Schriften anders als der Ubuntu-Runner); nach lokalen Testläufen `git checkout -- screenshots` bzw. neue Dateien löschen. Die Bilder im Repo kommen nur aus GitHub Actions (`gh workflow run screenshot-zeitraffer.yml`).

## 03-wir-zwei

Paar-App „Wir zwei“ als Web-App ohne Build-Schritt: reines HTML/CSS/JS-Module, keine npm-Pakete für die App selbst (`@playwright/test` nur für Tests). Supabase wird zur Laufzeit vom CDN geladen.

```bash
cd 03-wir-zwei
npm start    # http://localhost:4173, Mini-Server tools/server.mjs ohne Abhängigkeiten
npm test     # Playwright, startet den Server selbst, testet im Demo-Modus (iPhone-Größe)
```

- `js/konfig.js` leer → Demo-Modus (`js/daten-demo.js`, alles in localStorage, ausgedachte Partnerin „Sie“). Mit Supabase-URL und anon-Key → `js/daten-supabase.js`. Beide haben dieselbe Schnittstelle; `js/app.js` kennt den Unterschied nicht.
- Regeln (nur eigenes Paar sichtbar, Antworten unveränderlich, Partner-Antwort erst nach eigener, Frage für morgen erst morgen sichtbar) stehen als RLS in `supabase/schema.sql`. Die Demo bildet sie in `laden()` nach – bei Regeländerungen beide anpassen.
- „Heute“ ist immer der Tag in Europe/Berlin (`heute()` in `js/hilfen.js` und `public.heute()` in SQL).
- Die Eher-Frage des Tages ergibt sich nur aus dem Datum (`eherFrageFuer`); Fragen in `js/inhalte.js` nur hinten anhängen, sonst verschiebt sich die Zuordnung.
- Nutzertext immer über `esc()` ins HTML.
- Neue Dateien, die offline verfügbar sein sollen, in `GRUNDGERUEST` in `sw.js` eintragen und `SPEICHER` hochzählen.
- Veröffentlichung: `.github/workflows/wir-zwei-pages.yml` (GitHub Pages, nur bei Änderungen in `03-wir-zwei/`).
- Push: Edge Function `supabase/functions/push/index.ts` (in Supabase deployt, Name `push`). Neue Aktionen, die den Partner benachrichtigen sollen: `quelle.benachrichtigen(art)` in `js/app.js` aufrufen UND die Art in `nachricht()` der Funktion ergänzen. Neue Stimmungen auch in `STIMMUNGEN` der Funktion und im Check von `profile.stimmung` eintragen.
- Täglicher Job `fragen-um-8` (pg_cron, 6 und 7 Uhr UTC, sendet nur um 8 Uhr Berlin) ruft die Funktion `push` mit Header `x-wir-zwei-cron` auf. Die Server-Rolle hat nur gezielte Rechte (siehe Ende von `supabase/schema.sql`); neue Tabellen, die die Funktion liest, dort freigeben.
