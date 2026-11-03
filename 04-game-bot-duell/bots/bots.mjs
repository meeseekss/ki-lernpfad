// Die beiden Bots: bekommen das gelesene Brett und geben eine Richtung zurück.
import { RICHTUNGEN, frei, schluessel, sichereZuege, ziel } from './brett.mjs';

// Bot 1: irgendein Zug, der nicht sofort tödlich ist
export function zufallsZug(brett, zufall) {
  const zuege = sichereZuege(brett);
  if (zuege.length === 0) return brett.richtung; // verloren, egal wohin
  return zuege[Math.floor(zufall() * zuege.length)];
}

// Bot 2: kürzester Weg zum Futter, aber nur über Züge, nach denen genug Platz bleibt
export function strategieZug(brett) {
  const zuege = sichereZuege(brett);
  if (zuege.length === 0) return brett.richtung;

  const laenge = brett.belegt.size + 1; // nach dem Fressen eins länger
  const bewertet = zuege.map((richtung) => {
    const kopf = ziel(brett.kopf, richtung);
    const belegt = new Set(brett.belegt).add(schluessel(kopf));
    return {
      richtung,
      platz: platz(brett, kopf, belegt),
      abstand: brett.futter ? abstand(brett, kopf, brett.futter, belegt) : Infinity,
    };
  });

  // Mit genug Platz: dem Futter am nächsten. Sonst (alles eng): dorthin, wo am meisten Platz ist.
  const genug = bewertet.filter((zug) => zug.platz >= laenge);
  const auswahl = genug.length > 0
    ? genug.sort((a, b) => a.abstand - b.abstand || b.platz - a.platz)
    : bewertet.sort((a, b) => b.platz - a.platz);
  return auswahl[0].richtung;
}

function nachbarn(pos) {
  return Object.keys(RICHTUNGEN).map((richtung) => ziel(pos, richtung));
}

// Flutfüllung: wie viele Felder sind von start aus erreichbar (start mitgezählt)
function platz(brett, start, belegt) {
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
  return gesehen.size;
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
