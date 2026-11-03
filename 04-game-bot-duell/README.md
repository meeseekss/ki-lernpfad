<!-- AUTO:START -->
# 04 · Game-Bot-Duell

Snake im Browser, als Raster aus Zellen (kein Canvas). Zwei Playwright-Bots spielen im Bot-Modus dagegen und werden unter gleichen Bedingungen (gleiche Seeds) verglichen.

## Starten

```bash
npm install
npx playwright install chromium
npm start       # http://localhost:4174
npm test        # Playwright startet den Server selbst (webServer in der Config)
npm run duell   # beide Bots spielen je 20 Runden, am Ende eine Tabelle
```

## Bot-Duell

`npm run duell` startet den Server selbst (oder nutzt einen laufenden auf Port 4174) und öffnet einen unsichtbaren Chromium mit je einer Seite pro Bot. Beide spielen gleichzeitig die Seeds 1 bis 20, höchstens 2000 Schritte pro Runde. Die Tabelle zeigt die Punkte pro Seed und den Durchschnitt. Ein `*` heißt: Die Runde wurde am Schrittlimit abgebrochen, der Bot lebte noch.

| Bot | Vorgehen |
| --- | --- |
| **Zufall** | Wählt zufällig eine Richtung, die nicht sofort in Wand oder Körper führt. Würfelt mit dem Seed der Runde, damit Läufe wiederholbar sind. |
| **Strategie** | Nimmt den kürzesten Weg zum Futter (Breitensuche, läuft also um den Körper herum). Vor jedem Zug zählt eine Flutfüllung, wie viele Felder danach noch erreichbar sind. Ist das weniger als die Schlangenlänge, scheidet der Zug aus. Bleibt keiner übrig, geht er dorthin, wo am meisten Platz ist. |

Beide lesen das Brett nur über die `data-*`-Attribute der Seite und drücken Pfeiltasten. Die Reihenfolge der Körperteile steht nicht im DOM, deshalb gilt der ganze Körper inklusive Schwanz als Hindernis. Eine Umkehr bieten die Bots nie an, weil das Spiel sie ignoriert und geradeaus läuft.

Ein Lauf (Stand jetzt): Zufall Ø 3,6 Punkte, Strategie Ø 55,6 Punkte, keine Runde erreicht das Schrittlimit. Dauer etwa 30 Sekunden.

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
bots/brett.mjs        Brett aus den data-Attributen lesen, sichere Züge
bots/bots.mjs         Zufalls- und Strategie-Bot (Breitensuche, Flutfüllung)
bots/duell.mjs        Server starten, beide Bots spielen lassen, Tabelle ausgeben
tools/server.mjs      Mini-Webserver ohne Abhängigkeiten (Port 4174)
```
<!-- AUTO:END -->

## Meine Notizen

