<!-- AUTO:START -->
# 03 · Wir zwei

Eine kleine Web-App für zwei: Stimmung teilen, jeden Tag eine selbst ausgedachte Frage beantworten und „Was würdest du eher?“ spielen. Sie sieht aus wie eine iPhone-App, lässt sich auf den Homescreen legen und kostet nichts.

## Funktionen

| Bereich | Was passiert |
| --- | --- |
| **Heute** | Stimmung des Schatzes oben, darunter die eigene (8 Stimmungen). Je nach Stimmung gibt es den Knopf „Umarmung schicken“ oder „Ich ruf dich gleich an“. Beim anderen fliegen Herzen über den Bildschirm. Die Pflanze wächst mit jedem Tag, an dem ihr beide die Eher-Frage beantwortet habt. |
| **Fragen** | Jeder denkt sich pro Tag eine Frage aus, beide beantworten beide. Die Antwort des anderen bleibt versteckt, bis man selbst geantwortet hat. Antworten sind danach fest. Eine Frage für morgen kann man schon einplanen. Das Archiv sammelt alles. |
| **Eher** | Jeden Tag um Mitternacht eine neue Frage aus `js/inhalte.js` (149 Stück). Ein Tipp, fest gespeichert, dann „Match!“ oder „Uneinig“. |
| **Mitteilungen** | Push aufs Handy, wenn der andere eine Umarmung schickt, die Stimmung ändert, eine Frage stellt, antwortet oder bei „Eher“ wählt. Für morgen eingeplante Fragen werden um 8 Uhr gemeldet. Auf dem iPhone ab iOS 16.4 und nur vom Home-Bildschirm aus. Einschalten über die Karte auf „Heute“ oder in den Einstellungen. |

## Aufbau

Bewusst **ohne Build-Schritt und ohne npm-Pakete** für die App selbst: reines HTML, CSS und JavaScript-Module. Die Supabase-Bibliothek lädt der Browser zur Laufzeit von jsDelivr.

```
index.html              Einstieg, lädt app.css und js/app.js
app.css                 Gestaltung (Hell/Dunkel, Apple-nah)
js/app.js               Zustand, Ansichten, Klicks
js/inhalte.js           Stimmungen, Eher-Fragen, Ideen für eigene Fragen
js/hilfen.js            Datum (deutsche Zeit), Serie, Herz-Animation, Hinweise
js/konfig.js            Supabase-Zugang (leer = Demo-Modus)
js/daten-demo.js        Demo: alles im Browser, ausgedachte Partnerin „Sie“
js/daten-supabase.js    Echt: Supabase mit Echtzeit
sw.js, manifest.webmanifest, icons/   Homescreen-App und Offline-Start
supabase/schema.sql     Tabellen und Zugriffsregeln
supabase/functions/push/index.ts   Edge Function: schickt die Push-Mitteilung an den Partner
tests/app.spec.ts       Playwright-Tests im Demo-Modus
tools/server.mjs        Mini-Webserver ohne Abhängigkeiten
```

Beide Datenquellen haben dieselben Funktionen (`laden`, `antworten`, `eherWaehlen` …), `app.js` merkt keinen Unterschied.

**Die Regeln stehen in der Datenbank, nicht nur in der App** (`supabase/schema.sql`): Jeder sieht nur sein Paar. Antworten können nur angelegt, nie geändert werden. Die Antwort des anderen ist erst nach der eigenen lesbar. Die Frage für morgen sieht der andere erst ab morgen.

## Lokal starten

```bash
cd 03-wir-zwei
npm start                 # http://localhost:4173 – echt, mit Supabase
```

Mit `?demo` in der Adresse (http://localhost:4173/?demo) läuft die App immer im Demo-Modus, auch wenn Supabase eingetragen ist. Die Tests nutzen das.

## Tests

```bash
npm install
npx playwright install chromium
npm test
```

Sechs Tests im Demo-Modus (iPhone-Größe): Stimmung bleibt gespeichert, Umarmung, Antwort deckt auf und ist fest, eigene Frage stellen, Eher-Wahl ist fest, Archiv.

## Echt machen (einmalig)

1. **Supabase-Projekt** auf [supabase.com](https://supabase.com) anlegen (kostenloser Plan). „Automatically expose new tables“ aus, „Enable automatic RLS“ an.
2. **SQL Editor**: Inhalt von `supabase/schema.sql` ausführen.
3. **Authentication → Sign In / Providers → Email**: „Confirm email“ ausschalten. Angemeldet wird mit E-Mail und Passwort, ohne Bestätigungsmail. (Die E-Mail-Vorlagen lassen sich ohne eigenen Mail-Server nicht ändern, deshalb kein Code per Mail.) Bleibt „Confirm email“ an, funktioniert es auch: Dann kommt nach dem Registrieren eine Mail mit Bestätigungslink.
4. **Project Settings → API Keys**: Project URL und anon-Schlüssel in `js/konfig.js` eintragen. Der anon-Schlüssel darf öffentlich sein, der `service_role`-/secret-Schlüssel nie.
5. **GitHub Pages**: Repo → Settings → Pages → Source „GitHub Actions“. Nach dem Push veröffentlicht `.github/workflows/wir-zwei-pages.yml` die App unter `https://meeseekss.github.io/ki-lernpfad/`.
6. Seite in **Safari** öffnen → Teilen → „Zum Home-Bildschirm“. Einer registriert sich und erstellt das Paar, der andere registriert sich und tritt mit dem Code bei.

## Push-Mitteilungen

- Die App ruft nach einer Aktion die Edge Function `push` auf (nur mit der Art, z. B. `umarmung`). Die Funktion baut den Text selbst, sucht über die Zugriffsregeln den Partner und schickt an seine Geräte (`push_abos`).
- Der private VAPID-Schlüssel liegt in der Tabelle `push_schluessel`, die nur die Funktion lesen kann. Der öffentliche steht in `js/konfig.js`.
- Neue Version der Funktion: `supabase/functions/push/index.ts` ändern und neu deployen (`npx supabase functions deploy push`).
- `sw.js` zeigt die Mitteilung an und öffnet beim Tippen die passende Seite.
- Um 8 Uhr deutscher Zeit ruft der Datenbank-Job `fragen-um-8` (pg_cron) die Funktion mit einem Geheimnis aus `push_schluessel.cron_geheimnis` auf; sie meldet alle Fragen, die vor heute für heute eingeplant wurden. Sofort testen: `select public.fragen_des_tages_melden(true);` im SQL Editor.

## Ideen für später

- Herzchen auf einzelne Antworten
- Eigene Eher-Fragen vorschlagen
<!-- AUTO:END -->

## Meine Notizen

