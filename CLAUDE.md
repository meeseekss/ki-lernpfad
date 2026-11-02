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
