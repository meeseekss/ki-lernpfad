<!-- AUTO:START -->
# 04 · Game-Bot-Duell

Snake im Browser, als Raster aus Zellen (kein Canvas). Die Seite ist so gebaut, dass später Playwright-Bots dagegen spielen und sich unter gleichen Bedingungen vergleichen lassen. Bots gibt es noch nicht.

## Starten

```bash
npm install
npx playwright install chromium
npm start    # http://localhost:4174
npm test     # Playwright startet den Server selbst (webServer in der Config)
```

## URL-Parameter

| Parameter | Wirkung |
| --- | --- |
| `?modus=bot` | Kein Takt: Jede Pfeiltaste macht genau einen Schritt. Eine Umkehr wird ignoriert, der Schritt geht dann geradeaus. Ohne den Parameter läuft das Spiel in Echtzeit (150 ms pro Schritt, Start mit der ersten Pfeiltaste). |
| `?seed=42` | Feste Futterfolge. Ohne Seed wird einer gewürfelt und oben angezeigt. „Neues Spiel“ behält den Seed. |

## Schnittstelle für Bots

| Selektor | Inhalt |
| --- | --- |
| `[data-testid="spielfeld"]` | `data-zeilen`, `data-spalten` (15 × 15), `data-modus` (`bot`/`echtzeit`), `data-richtung` (zuletzt gelaufen) |
| `[data-testid="zelle-<zeile>-<spalte>"]` | `data-inhalt` = `kopf`, `schlange`, `futter` oder `leer` (Zählung ab 0, oben links) |
| `[data-testid="punkte"]` | Punktestand als Text |
| `[data-testid="game-over"]` | Sichtbar, sobald das Spiel vorbei ist |
| `[data-testid="seed"]` | Verwendeter Seed |
| `[data-testid="neustart"]` | Knopf „Neues Spiel“ |

Start: Schlange mit Länge 3 in Zeile 7, Kopf auf Spalte 4, Richtung rechts.

## Aufbau

```
index.html            Seite mit den data-testid-Elementen
style.css             Gestaltung (Hell/Dunkel)
js/spiel.js           Regeln ohne DOM: Zufall mit Seed (Mulberry32), Schritt, Kollision, Futter
js/app.js             Zellen zeichnen, Tasten, Takt, URL-Parameter
tests/spiel.spec.ts   Start-Test und Bot-Modus/Seed-Test
tools/server.mjs      Mini-Webserver ohne Abhängigkeiten (Port 4174)
```
<!-- AUTO:END -->

## Meine Notizen

