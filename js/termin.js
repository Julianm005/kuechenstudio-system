// termin.js – Auswahl möglicher Beratungstermine (nur Demo: es wird nichts gesendet oder gespeichert).
// Die Termine folgen den Öffnungszeiten und Schließtagen des Studios; die Dauer eines Termins ist eine Stunde.

import {
  parseDatum, kurzDatum, zeitenAm, schliessung, naechsteOeffnung, isoDatum, tagPlusN,
} from './zeit.js';

const DAUER_MINUTEN = 60;

function inMinuten(zeit) {
  const [h, m] = zeit.split(':').map(Number);
  return h * 60 + m;
}

function alsZeit(minuten) {
  return `${String(Math.floor(minuten / 60)).padStart(2, '0')}:${String(minuten % 60).padStart(2, '0')}`;
}

/** Frühester wählbarer Tag: der Tag nach dem simulierten Datum. */
export function fruehesterTag(heute) {
  return tagPlusN(heute, 1);
}

/**
 * Mögliche Uhrzeiten für einen Tag.
 * @param {Date} heute  simuliertes Datum (Termine liegen immer danach)
 * @returns {{slots: string[], hinweis: string}}
 */
export function terminAuswahl(studio, tag, heute) {
  if (tag <= heute) return { slots: [], hinweis: 'Bitte einen Tag nach dem heutigen Datum wählen.' };
  const pause = schliessung(studio, tag);
  const zeiten = zeitenAm(studio, tag);
  if (!zeiten) {
    const grund = pause ? `wegen „${pause.grund}“ geschlossen` : 'Ruhetag';
    const weiter = naechsteOeffnung(studio, tag);
    return {
      slots: [],
      hinweis: `Am ${kurzDatum(tag)} ist ${pause ? 'bei uns' : 'unser'} ${grund}.${weiter ? ` Nächster möglicher Tag: ${langesDatum(isoDatum(weiter.datum))}, ${weiter.von} Uhr.` : ''}`,
    };
  }
  const slots = [];
  for (let m = inMinuten(zeiten[0]); m + DAUER_MINUTEN <= inMinuten(zeiten[1]); m += DAUER_MINUTEN) slots.push(alsZeit(m));
  return { slots, hinweis: '' };
}

/** Erster Tag nach dem simulierten Datum, an dem ein Termin möglich ist (oder null). */
export function ersterTerminTag(studio, heute) {
  const weiter = naechsteOeffnung(studio, heute);
  return weiter ? weiter.datum : null;
}

/** „2027-01-04“ → „Mo., 04.01.2027“ */
export function langesDatum(iso) {
  return parseDatum(iso).toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export { isoDatum };
