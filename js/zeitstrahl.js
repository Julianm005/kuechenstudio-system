// zeitstrahl.js – Hilfen für den Zeitstrahl in der Demo-Leiste:
// zeichnet Aktionen und Schließzeiträume als farbige Balken über den simulierbaren Datumsbereich.

import { esc } from './render.js';
import { parseDatum, tageZwischen, kurzDatum } from './zeit.js';

/** Anzahl der Tage im Bereich (inklusive Start und Ende). */
export function tageImBereich(bereich) {
  return tageZwischen(bereich.start, bereich.ende) + 1;
}

function prozent(bereich, datum) {
  return (tageZwischen(bereich.start, datum) / tageImBereich(bereich)) * 100;
}

function balken(bereich, von, bis, klasse, titel) {
  const links = prozent(bereich, von);
  const breite = ((tageZwischen(von, bis) + 1) / tageImBereich(bereich)) * 100;
  return `<span class="strahl-balken ${klasse}" style="left:${links.toFixed(2)}%;width:${breite.toFixed(2)}%" title="${esc(titel)}"></span>`;
}

/**
 * HTML für die Spuren unter dem Regler: je eine Spur pro Aktion (blau) und eine pro Studio für
 * die Schließzeiträume (rot), dazu eine Markierung für das echte Heute.
 */
export function spurenHtml(studioListe, bereich, echtesHeute) {
  const spuren = [];
  for (const s of studioListe) {
    const prefix = studioListe.length > 1 ? `${s.name}: ` : '';
    for (const a of s.aktionen) {
      spuren.push(balken(
        bereich, parseDatum(a.gueltigAb), parseDatum(a.gueltigBis), 'strahl-aktion',
        `${prefix}${a.titel} (${kurzDatum(parseDatum(a.gueltigAb))}–${kurzDatum(parseDatum(a.gueltigBis))})`,
      ));
    }
    if (s.schliesstage.length) {
      spuren.push(s.schliesstage.map((p) => balken(
        bereich, parseDatum(p.von), parseDatum(p.bis), 'strahl-zu',
        `${prefix}${p.grund} (${kurzDatum(parseDatum(p.von))}–${kurzDatum(parseDatum(p.bis))})`,
      )).join(''));
    }
  }
  const heute = `<span class="strahl-heute" style="left:${prozent(bereich, echtesHeute).toFixed(2)}%" title="Heute"></span>`;
  return spuren.map((spur) => `<span class="strahl-spur">${spur}</span>`).join('') + heute;
}
