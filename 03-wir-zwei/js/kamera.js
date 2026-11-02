// Kamera im BeReal-Stil: erst die Rückkamera, dann automatisch ein Selfie mit Countdown.
//
// Browser auf dem iPhone können nicht beide Kameras gleichzeitig benutzen. Deshalb nacheinander:
// Auslöser → Rückkamera-Bild → Wechsel zur Frontkamera → 3, 2, 1 → Selfie → Vorschau → Posten.
//
// Die Kamera lebt in einer eigenen Ebene außerhalb von #app, weil app.js beim Neuzeichnen
// sein HTML ersetzt und ein laufendes Video sonst verloren ginge.
//
// kameraOeffnen() → Promise<{ hinten: Blob, vorne: Blob } | null>   (null = abgebrochen)

const BREITE_HINTEN = 1080; // Ausgabe 1080×1440 (3:4 hochkant)
const BREITE_VORNE = 600;   // Ausgabe 600×800

function element(tag, klasse, eigenschaften = {}) {
  const el = document.createElement(tag);
  if (klasse) el.className = klasse;
  Object.assign(el, eigenschaften);
  return el;
}

// Bild (Video oder Foto) mittig auf 3:4 hochkant zuschneiden und als JPEG ausgeben.
function zuschneiden(quelle, quellBreite, quellHoehe, breite, spiegeln) {
  const ziel = 3 / 4;
  let sw = quellBreite;
  let sh = quellHoehe;
  if (quellBreite / quellHoehe > ziel) sw = quellHoehe * ziel;
  else sh = quellBreite / ziel;
  const leinwand = element('canvas');
  leinwand.width = breite;
  leinwand.height = Math.round(breite * 4 / 3);
  const g = leinwand.getContext('2d');
  if (spiegeln) { g.translate(leinwand.width, 0); g.scale(-1, 1); }
  g.drawImage(quelle, (quellBreite - sw) / 2, (quellHoehe - sh) / 2, sw, sh, 0, 0, leinwand.width, leinwand.height);
  return new Promise((fertig, fehler) => leinwand.toBlob(
    (blob) => (blob ? fertig(blob) : fehler(new Error('Bild konnte nicht erstellt werden'))),
    'image/jpeg', 0.82,
  ));
}

function dateiAlsBild(datei) {
  return new Promise((fertig, fehler) => {
    const bild = new Image();
    bild.onload = () => fertig(bild);
    bild.onerror = () => fehler(new Error('Das Foto konnte nicht gelesen werden.'));
    bild.src = URL.createObjectURL(datei);
  });
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

export function kameraOeffnen() {
  return new Promise((ergebnisMelden) => {
    let strom = null;
    let hinten = null;
    let vorne = null;
    let beendet = false;
    const vorschauUrls = [];

    // ── Aufbau
    const ebene = element('div', 'kamera');
    ebene.setAttribute('role', 'dialog');
    ebene.setAttribute('aria-modal', 'true');
    ebene.setAttribute('aria-label', 'Foto des Tages aufnehmen');

    const kopf = element('div', 'kamera-kopf');
    const abbrechen = element('button', 'kamera-x', { type: 'button', textContent: 'Abbrechen' });
    const titel = element('span', 'kamera-titel', { textContent: 'Foto des Tages' });
    kopf.append(abbrechen, titel, element('span'));

    const bildflaeche = element('div', 'kamera-bild');
    const video = element('video', 'kamera-video', { muted: true, autoplay: true, playsInline: true });
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    const gross = element('img', 'foto-gross', { alt: '' });
    const klein = element('img', 'foto-klein', { alt: '' });
    const countdown = element('div', 'kamera-countdown');
    countdown.setAttribute('aria-live', 'assertive');
    bildflaeche.append(video, gross, klein, countdown);

    const hinweis = element('p', 'kamera-hinweis');
    hinweis.setAttribute('aria-live', 'polite');

    const fuss = element('div', 'kamera-fuss');
    const ausloeser = element('button', 'ausloeser', { type: 'button' });
    ausloeser.setAttribute('aria-label', 'Foto aufnehmen');
    const nochmal = element('button', 'knopf zweit', { type: 'button', textContent: 'Nochmal' });
    const posten = element('button', 'knopf haupt', { type: 'button', textContent: 'Posten' });
    fuss.append(ausloeser, nochmal, posten);

    ebene.append(kopf, bildflaeche, hinweis, fuss);
    document.body.append(ebene);
    document.body.classList.add('kamera-offen');

    // ── Hilfen
    function zeige(...sichtbar) {
      for (const el of [video, gross, klein, countdown, ausloeser, nochmal, posten]) el.hidden = !sichtbar.includes(el);
    }

    function stoppen() {
      strom?.getTracks().forEach((t) => t.stop());
      strom = null;
      video.srcObject = null;
    }

    function schliessen(ergebnis) {
      if (beendet) return;
      beendet = true;
      stoppen();
      vorschauUrls.forEach((u) => URL.revokeObjectURL(u));
      ebene.remove();
      document.body.classList.remove('kamera-offen');
      ergebnisMelden(ergebnis);
    }

    async function kameraStarten(richtung) {
      stoppen();
      strom = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: richtung }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      });
      if (beendet) { stoppen(); return; }
      video.classList.toggle('gespiegelt', richtung === 'user');
      video.srcObject = strom;
      await video.play().catch(() => {});
      if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
    }

    function vorschauZeigen() {
      const a = URL.createObjectURL(hinten);
      const b = URL.createObjectURL(vorne);
      vorschauUrls.push(a, b);
      gross.src = a;
      klein.src = b;
      hinweis.textContent = 'Gefällt’s dir? Nach dem Posten bleibt es bis Mitternacht.';
      zeige(gross, klein, nochmal, posten);
    }

    // ── Normaler Weg: Live-Kamera
    async function ablaufStarten() {
      hinten = null;
      vorne = null;
      hinweis.textContent = 'Erst die Welt um dich herum …';
      zeige(video, ausloeser);
      ausloeser.disabled = true;
      try {
        await kameraStarten('environment');
        ausloeser.disabled = false;
      } catch {
        ausweichweg();
      }
    }

    ausloeser.addEventListener('click', async () => {
      ausloeser.disabled = true;
      try {
        hinten = await zuschneiden(video, video.videoWidth, video.videoHeight, BREITE_HINTEN, false);
        hinweis.textContent = '… und jetzt du! 😊';
        zeige(video, countdown);
        countdown.textContent = '';
        await kameraStarten('user');
        for (const zahl of ['3', '2', '1']) {
          if (beendet) return;
          countdown.textContent = zahl;
          await warte(800);
        }
        countdown.textContent = '';
        vorne = await zuschneiden(video, video.videoWidth, video.videoHeight, BREITE_VORNE, true);
        stoppen();
        vorschauZeigen();
      } catch {
        if (!beendet) ausweichweg();
      }
    });

    // ── Ausweichweg: Fotos über die Kamera-App des Handys
    function ausweichweg() {
      stoppen();
      hinten = null;
      vorne = null;
      zeige();
      hinweis.textContent = 'Die Live-Kamera ist hier nicht verfügbar. Mach die zwei Fotos einfach nacheinander:';
      const auswahl = element('div', 'kamera-auswahl');
      const schritt = (text, richtung, fertig) => {
        const label = element('label', 'knopf haupt');
        const eingabe = element('input', '', { type: 'file', accept: 'image/*' });
        eingabe.setAttribute('capture', richtung);
        eingabe.hidden = true;
        label.append(document.createTextNode(text), eingabe);
        eingabe.addEventListener('change', async () => {
          const datei = eingabe.files?.[0];
          if (!datei) return;
          const bild = await dateiAlsBild(datei);
          await fertig(bild);
          URL.revokeObjectURL(bild.src);
        });
        return label;
      };
      const eins = schritt('1. Foto von der Welt', 'environment', async (bild) => {
        hinten = await zuschneiden(bild, bild.naturalWidth, bild.naturalHeight, BREITE_HINTEN, false);
        eins.classList.replace('haupt', 'zweit');
        eins.firstChild.textContent = '1. Foto von der Welt ✓';
        zwei.hidden = false;
      });
      const zwei = schritt('2. Selfie', 'user', async (bild) => {
        vorne = await zuschneiden(bild, bild.naturalWidth, bild.naturalHeight, BREITE_VORNE, false);
        auswahl.remove();
        vorschauZeigen();
      });
      zwei.hidden = true;
      auswahl.append(eins, zwei);
      fuss.prepend(auswahl);
    }

    // ── Knöpfe
    abbrechen.addEventListener('click', () => schliessen(null));
    nochmal.addEventListener('click', () => {
      fuss.querySelector('.kamera-auswahl')?.remove();
      ablaufStarten();
    });
    posten.addEventListener('click', () => schliessen({ hinten, vorne }));
    ebene.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') schliessen(null); });

    if (navigator.mediaDevices?.getUserMedia) ablaufStarten();
    else ausweichweg();
    abbrechen.focus();
  });
}
