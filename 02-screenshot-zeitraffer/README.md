<!-- AUTO:START -->
# 02 – Screenshot-Zeitraffer

Ein Playwright-Skript (TypeScript) fotografiert jeden Tag um 12 Uhr deutscher Zeit drei Webseiten. Ein GitHub-Actions-Workflow committet die Bilder ins Repo – mit der Zeit entsteht daraus ein Zeitraffer.

| Ordner | Seite |
| --- | --- |
| `screenshots/tagesschau/` | https://www.tagesschau.de |
| `screenshots/spiegel/` | https://www.spiegel.de |
| `screenshots/wikipedia/` | https://de.wikipedia.org |

Jedes Bild heißt `<JJJJ-MM-TT>.jpg` (Datum in deutscher Zeit), ist ein JPEG (Qualität 80) und zeigt genau das Browserfenster in 1280×800 – keine ganze Seite.

## Lokal ausführen

```bash
cd 02-screenshot-zeitraffer
npm install
npx playwright install chromium
npm run screenshots
```

Lokale Bilder bitte nicht committen: macOS rendert Schriften anders als der Ubuntu-Runner, das würde im Zeitraffer flackern. Die Bilder im Repo kommen nur aus GitHub Actions.

## Automatisch per GitHub Actions

Workflow: [`.github/workflows/screenshot-zeitraffer.yml`](../.github/workflows/screenshot-zeitraffer.yml)

- **Täglich um 12 Uhr:** GitHub-Cron rechnet in UTC. Deshalb gibt es zwei Startzeiten (10:00 und 11:00 UTC). Der erste Schritt prüft anhand der Berliner Zeitzone, welche davon gerade gilt (Sommer- oder Winterzeit), und lässt nur diese laufen.
- **Manuell:** Im Tab *Actions* → *Screenshot-Zeitraffer* → *Run workflow*, oder im Terminal:
  ```bash
  gh workflow run screenshot-zeitraffer.yml
  ```
  Mehrere Läufe am selben Tag überschreiben das Bild des Tages.
- **Commit:** Der Bot `github-actions[bot]` committet neue Bilder mit der Nachricht `Screenshots vom <Datum>`.
- **Runner fest auf `ubuntu-24.04`**, damit sich die Schriftdarstellung nicht unbemerkt ändert.

## Cookie-Banner und Popups

Vor dem Foto klickt das Skript störende Overlays weg. Pro Seite steht in `screenshot.ts` eine Liste `wegklicken` mit Mustern für die Button-Beschriftung, die der Reihe nach abgearbeitet wird:

```ts
{
  name: 'spiegel',
  url: 'https://www.spiegel.de',
  wegklicken: [/Einwilligen und weiter|Akzeptieren und weiter/i, /Dialog schließen/i],
},
```

- Gesucht wird in der Seite **und in allen iframes** (Consent-Banner stecken oft in einem iframe).
- Wird ein Button nicht gefunden, ist das kein Fehler – im Log steht dann `Hinweis: nicht gefunden: …`.
- Zugestimmt statt abgelehnt wird, weil spiegel.de beim Ablehnen auf eine Abo-Seite weiterleitet.

Taucht auf einem Bild wieder ein Banner auf, hat sich vermutlich die Beschriftung geändert: Log ansehen und das Muster anpassen.

## Fehlerverhalten

- Lädt eine Seite nicht, macht das Skript mit den anderen weiter.
- Am Ende listet es alle Fehler auf und endet mit Exit-Code 1.
- Im Workflow läuft der Commit-Schritt trotzdem: Die gelungenen Bilder werden gesichert, der Lauf wird aber rot angezeigt.

## Weitere Seite hinzufügen

In `screenshot.ts` einen Eintrag zu `SEITEN` ergänzen:

```ts
{ name: 'ordnername', url: 'https://example.org', wegklicken: [/Alle akzeptieren/i] },
```

`wegklicken` weglassen, wenn die Seite keine Banner hat.
<!-- AUTO:END -->

## Meine Notizen
