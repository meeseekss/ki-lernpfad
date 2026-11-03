// Die Bots: bekommen das gelesene Brett und geben eine Richtung zurück.
import { GEGENTEIL, RICHTUNGEN, frei, gleich, imFeld, schluessel, sichereZuege, ziel } from './brett.mjs';

// Bot 1: irgendein Zug, der nicht sofort tödlich ist
export function zufallsZug(brett, zufall) {
  const zuege = sichereZuege(brett);
  if (zuege.length === 0) return brett.richtung; // verloren, egal wohin
  return zuege[Math.floor(zufall() * zuege.length)];
}

// Bot 3 („Strategie“) für eine ganze Runde: merkt sich, seit wie vielen Zügen er nichts gefressen hat.
// Länger als zwei Körperlängen (mindestens so viele Schritte, wie das Feld Zellen hat) ohne Futter heißt:
// Er kreist ums Futter und baut dabei selbst die Wände, die es einschließen.
// Dann läuft er eine Körperlänge lang möglichst weit weg, damit sich sein Körper löst.
export function strategieMitSchwanz() {
  let punkte = -1;
  let seitFutter = 0;
  let wegNoch = 0;
  return (brett, beobachten) => {
    seitFutter = brett.punkte === punkte ? seitFutter + 1 : 0;
    punkte = brett.punkte;
    const geduld = Math.max(2 * brett.koerper.length, brett.zeilen * brett.spalten);
    if (wegNoch === 0 && seitFutter > geduld) {
      wegNoch = brett.koerper.length;
      seitFutter = 0;
    }
    const weg = wegNoch > 0;
    if (weg) wegNoch--;
    return strategieMitSchwanzZug(brett, beobachten, weg);
  };
}

// Ein Zug von Bot 3: wie Bot 2, kennt aber über data-index die Reihenfolge des Körpers.
// Schwanzfelder zählen als frei, sobald der Schwanz sie verlassen hat, bevor der Kopf ankommt.
// weg: unter den Zügen mit genug Platz den mit dem größten statt dem kleinsten Abstand zum Futter wählen.
export function strategieMitSchwanzZug(brett, beobachten, weg = false) {
  const { koerper } = brett;
  const schwanz = koerper[koerper.length - 1];
  // Aufs Schwanzfeld darf er, wenn er dort nicht frisst: Dann rückt der Schwanz im selben Schritt weiter
  const zuege = Object.keys(RICHTUNGEN)
    .filter((richtung) => richtung !== GEGENTEIL[brett.richtung])
    .filter((richtung) => {
      const kopf = ziel(brett.kopf, richtung);
      const frisst = brett.futter !== null && gleich(kopf, brett.futter);
      return imFeld(brett, kopf) && (!brett.belegt.has(schluessel(kopf)) || (!frisst && gleich(kopf, schwanz)));
    });
  if (zuege.length === 0) {
    beobachten?.({ erreichbar: new Set(), genug: false });
    return brett.richtung;
  }

  const bewertet = zuege.map((richtung) => {
    const kopf = ziel(brett.kopf, richtung);
    const frisst = brett.futter !== null && gleich(kopf, brett.futter);
    const neuerKoerper = [kopf, ...(frisst ? koerper : koerper.slice(0, -1))];
    const wege = wegeMitSchwanz(brett, neuerKoerper);
    const erreichbar = new Set(wege.keys());
    return {
      richtung,
      laenge: neuerKoerper.length,
      erreichbar,
      platz: erreichbar.size,
      abstand: brett.futter ? (wege.get(schluessel(brett.futter)) ?? Infinity) : Infinity,
    };
  });

  const genug = bewertet.filter((zug) => zug.platz >= zug.laenge);
  const richtungZumFutter = weg ? -1 : 1;
  const auswahl = genug.length > 0
    ? genug.sort((a, b) => richtungZumFutter * (a.abstand - b.abstand) || b.platz - a.platz)
    : bewertet.sort((a, b) => b.platz - a.platz);
  beobachten?.({ erreichbar: auswahl[0].erreichbar, genug: genug.length > 0 });
  return auswahl[0].richtung;
}

// Bot 2 („Strategie alt“): kürzester Weg zum Futter, aber nur über Züge, nach denen genug Platz bleibt.
// Kennt die Reihenfolge des Körpers nicht und behandelt ihn komplett als Hindernis.
// beobachten (optional, nur Zuschau-Modus) erfährt, welche Felder er für den gewählten Zug als erreichbar zählt.
export function strategieZug(brett, beobachten) {
  const zuege = sichereZuege(brett);
  if (zuege.length === 0) {
    beobachten?.({ erreichbar: new Set(), genug: false });
    return brett.richtung;
  }

  const laenge = brett.belegt.size + 1; // nach dem Fressen eins länger
  const bewertet = zuege.map((richtung) => {
    const kopf = ziel(brett.kopf, richtung);
    const belegt = new Set(brett.belegt).add(schluessel(kopf));
    const erreichbar = erreichbareFelder(brett, kopf, belegt);
    return {
      richtung,
      erreichbar,
      platz: erreichbar.size,
      abstand: brett.futter ? abstand(brett, kopf, brett.futter, belegt) : Infinity,
    };
  });

  // Mit genug Platz: dem Futter am nächsten. Sonst (alles eng): dorthin, wo am meisten Platz ist.
  const genug = bewertet.filter((zug) => zug.platz >= laenge);
  const auswahl = genug.length > 0
    ? genug.sort((a, b) => a.abstand - b.abstand || b.platz - a.platz)
    : bewertet.sort((a, b) => b.platz - a.platz);
  beobachten?.({ erreichbar: auswahl[0].erreichbar, genug: genug.length > 0 });
  return auswahl[0].richtung;
}

function nachbarn(pos) {
  return Object.keys(RICHTUNGEN).map((richtung) => ziel(pos, richtung));
}

// Flutfüllung: Schlüssel aller Felder, die von start aus erreichbar sind (start mitgezählt)
function erreichbareFelder(brett, start, belegt) {
  const gesehen = new Set([schluessel(start)]);
  const offen = [start];
  while (offen.length > 0) {
    for (const nachbar of nachbarn(offen.pop())) {
      const k = schluessel(nachbar);
      if (!gesehen.has(k) && frei(brett, nachbar, belegt)) {
        gesehen.add(k);
        offen.push(nachbar);
      }
    }
  }
  return gesehen;
}

// Breitensuche vom Kopf (koerper[0]) aus, bei der Körperteile rechtzeitig frei werden:
// Das Teil an Stelle j (Kopf = 0) ist nach koerper.length − j Schritten weg.
// Ergebnis: Schlüssel → Schritte bis dorthin, für alle erreichbaren Felder (Start mit 0).
// Frisst er unterwegs, bleibt der Schwanz länger liegen; das übersieht die Suche bewusst.
function wegeMitSchwanz(brett, koerper) {
  const freiNach = new Map(koerper.map((teil, j) => [schluessel(teil), koerper.length - j]));
  const wege = new Map([[schluessel(koerper[0]), 0]]);
  let ebene = [koerper[0]];
  for (let schritte = 1; ebene.length > 0; schritte++) {
    const naechste = [];
    for (const pos of ebene) {
      for (const nachbar of nachbarn(pos)) {
        const k = schluessel(nachbar);
        if (wege.has(k) || !imFeld(brett, nachbar) || (freiNach.get(k) ?? 0) > schritte) continue;
        wege.set(k, schritte);
        naechste.push(nachbar);
      }
    }
    ebene = naechste;
  }
  return wege;
}

// Breitensuche: Länge des kürzesten Wegs von start nach zielPos, Infinity wenn keiner
function abstand(brett, start, zielPos, belegt) {
  const gesehen = new Set([schluessel(start)]);
  let ebene = [start];
  for (let schritte = 0; ebene.length > 0; schritte++) {
    const naechste = [];
    for (const pos of ebene) {
      if (pos.z === zielPos.z && pos.s === zielPos.s) return schritte;
      for (const nachbar of nachbarn(pos)) {
        const k = schluessel(nachbar);
        if (!gesehen.has(k) && frei(brett, nachbar, belegt)) {
          gesehen.add(k);
          naechste.push(nachbar);
        }
      }
    }
    ebene = naechste;
  }
  return Infinity;
}
