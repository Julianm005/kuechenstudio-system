// zeit.js – Datums- und Öffnungszeiten-Logik (reine Funktionen, ohne Zugriff auf die Uhr).
// Datum und Uhrzeit kommen immer von außen (app.js): Datum = simuliert, Uhrzeit = echt.

// Date.getDay(): 0 = Sonntag
export const TAG_SCHLUESSEL = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'];
const TAG_KURZ = { so: 'So', mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa' };

/** „2026-12-20“ → Date (lokale Mitternacht) */
export function parseDatum(iso) {
  const [jahr, monat, tag] = iso.split('-').map(Number);
  return new Date(jahr, monat - 1, tag);
}

/** Date → „2026-12-20“ (für das Datumsfeld) */
export function isoDatum(datum) {
  const z = (n) => String(n).padStart(2, '0');
  return `${datum.getFullYear()}-${z(datum.getMonth() + 1)}-${z(datum.getDate())}`;
}

export function tageZwischen(von, bis) {
  return Math.round((bis - von) / 86400000);
}

/** Date → „20.12.“ */
export function kurzDatum(datum) {
  return `${String(datum.getDate()).padStart(2, '0')}.${String(datum.getMonth() + 1).padStart(2, '0')}.`;
}

export function tagPlusN(datum, n) {
  return new Date(datum.getFullYear(), datum.getMonth(), datum.getDate() + n);
}

function inMinuten(zeit) {
  const [h, m] = zeit.split(':').map(Number);
  return h * 60 + m;
}

/** Schließzeitraum, der dieses Datum abdeckt (oder undefined). */
export function schliessung(studio, datum) {
  return studio.schliesstage.find((s) => parseDatum(s.von) <= datum && datum <= parseDatum(s.bis));
}

/** Öffnungszeiten ["10:00","18:00"] für ein Datum – null, wenn geschlossen (Ruhetag oder Schließzeitraum). */
export function zeitenAm(studio, datum) {
  if (schliessung(studio, datum)) return null;
  return studio.oeffnungszeiten[TAG_SCHLUESSEL[datum.getDay()]];
}

/**
 * Nächste Öffnung nach dem gegebenen Datum. Überspringt Ruhetage, Wochenenden und Schließzeiträume.
 * @returns {{datum: Date, von: string, text: string}|null}
 */
export function naechsteOeffnung(studio, ab) {
  for (let n = 1; n <= 400; n += 1) {
    const tag = tagPlusN(ab, n);
    const zeiten = zeitenAm(studio, tag);
    if (zeiten) {
      let wann;
      if (n === 1) wann = 'morgen';
      else if (n <= 6) wann = TAG_KURZ[TAG_SCHLUESSEL[tag.getDay()]];
      else wann = `${TAG_KURZ[TAG_SCHLUESSEL[tag.getDay()]]} ${kurzDatum(tag)}`;
      const mitDatum = n === 1 || n > 6 ? wann : `${TAG_KURZ[TAG_SCHLUESSEL[tag.getDay()]]} ${kurzDatum(tag)}`;
      return { datum: tag, von: zeiten[0], text: `${wann} ${zeiten[0]}`, textMitDatum: `${mitDatum} ${zeiten[0]}` };
    }
  }
  return null;
}

/**
 * Öffnungsstatus für das Badge im Kopf.
 * @param {number} minuten  Minuten seit Mitternacht (echte Uhrzeit)
 * @returns {{offen: boolean, text: string}}
 */
export function oeffnungsStatus(studio, datum, minuten) {
  const pause = schliessung(studio, datum);
  if (pause) {
    return { offen: false, text: `Heute geschlossen · ${pause.grund} bis ${kurzDatum(parseDatum(pause.bis))}` };
  }
  const zeiten = studio.oeffnungszeiten[TAG_SCHLUESSEL[datum.getDay()]];
  if (zeiten) {
    const [von, bis] = zeiten.map(inMinuten);
    if (minuten >= von && minuten < bis) return { offen: true, text: `Jetzt geöffnet · bis ${zeiten[1]}` };
    if (minuten < von) return { offen: false, text: `Geschlossen · öffnet heute ${zeiten[0]}` };
  }
  const weiter = naechsteOeffnung(studio, datum);
  return { offen: false, text: weiter ? `Geschlossen · öffnet ${weiter.text}` : 'Geschlossen' };
}

/**
 * Hinweis auf aktuelle oder bald beginnende Schließzeiträume (Vorlauf: 30 Tage).
 * @returns {string|null}
 */
export function schliessHinweis(studio, datum) {
  const pause = schliessung(studio, datum);
  if (pause) {
    const weiter = naechsteOeffnung(studio, datum);
    return `Aktuell geschlossen (${pause.grund}) bis ${kurzDatum(parseDatum(pause.bis))}`
      + (weiter ? ` Wir sind ab ${weiter.textMitDatum} Uhr wieder für Sie da.` : '');
  }
  const bald = studio.schliesstage
    .filter((s) => {
      const bisBeginn = tageZwischen(datum, parseDatum(s.von));
      return bisBeginn > 0 && bisBeginn <= 30;
    })
    .sort((a, b) => parseDatum(a.von) - parseDatum(b.von))[0];
  if (!bald) return null;
  return `Bitte beachten: ${bald.grund} vom ${kurzDatum(parseDatum(bald.von))} bis ${kurzDatum(parseDatum(bald.bis))}`;
}

// ---------- Änderungen zwischen zwei Daten (für die Meldungen der Demo) ----------

/** Ist die Aktion an diesem Datum gültig? */
export function aktionSichtbar(aktion, datum) {
  return parseDatum(aktion.gueltigAb) <= datum && datum <= parseDatum(aktion.gueltigBis);
}

/**
 * Was ändert sich auf der Website, wenn das Datum von „von“ auf „nach“ springt?
 * Richtungsneutral formuliert, damit es beim Zurückspulen genauso stimmt.
 * @returns {{icon: string, text: string}[]}
 */
export function aenderungen(studio, von, nach) {
  if (isoDatum(von) === isoDatum(nach)) return [];
  const liste = [];
  for (const a of studio.aktionen) {
    const war = aktionSichtbar(a, von);
    const ist = aktionSichtbar(a, nach);
    if (war === ist) continue;
    if (war && !ist) {
      liste.push({
        icon: '⚙️',
        text: parseDatum(a.gueltigBis) < nach
          ? `„${a.titel}“ ist abgelaufen und wurde automatisch ausgeblendet.`
          : `„${a.titel}“ ist noch nicht gültig und wurde ausgeblendet.`,
      });
    } else {
      liste.push({
        icon: '✨',
        text: parseDatum(a.gueltigAb) > von
          ? `„${a.titel}“ startet und erscheint automatisch.`
          : `„${a.titel}“ ist wieder gültig und erscheint.`,
      });
    }
  }
  const pauseVor = schliessung(studio, von);
  const pauseNach = schliessung(studio, nach);
  if (!pauseVor && pauseNach) {
    liste.push({
      icon: '🔒',
      text: `${pauseNach.grund} bis ${kurzDatum(parseDatum(pauseNach.bis))}: Der Status wechselt auf „Heute geschlossen“.`,
    });
  } else if (pauseVor && !pauseNach) {
    liste.push({
      icon: '🔓',
      text: `${pauseVor.grund} vorbei: Der Status folgt wieder den normalen Öffnungszeiten.`,
    });
  } else if (!pauseNach && !schliessHinweis(studio, von) && schliessHinweis(studio, nach)) {
    liste.push({ icon: '📢', text: 'Ein Hinweis auf kommende Schließtage erscheint automatisch (30 Tage vorher).' });
  }
  return liste;
}

/**
 * Nächster Tag nach „ab“, an dem sich auf einer der Websites etwas ändert (Aktion, Schließzeit, Hinweis).
 * Sucht 800 Tage voraus. Bei gleichem Tag gewinnt das Studio weiter vorn in der Liste.
 * @returns {{datum: Date, studio: object, text: string} | null} null, wenn im Suchfenster nichts passiert
 */
export function naechsteAenderung(studioListe, ab) {
  let beste = null;
  for (const studio of studioListe) {
    for (let n = 1; n <= 800; n++) {
      const datum = tagPlusN(ab, n);
      if (beste && datum >= beste.datum) break;
      const liste = aenderungen(studio, ab, datum);
      if (liste.length > 0) {
        beste = { datum, studio, text: liste[0].text };
        break;
      }
    }
  }
  return beste;
}

/**
 * Datumsbereich für den Zeitstrahl: alle Aktionen und Schließzeiten aller Studios plus Puffer,
 * dazu immer das heutige Datum.
 */
export function zeitraumAllerStudios(studioListe, heute) {
  let start = heute;
  let ende = heute;
  for (const s of studioListe) {
    for (const a of s.aktionen) {
      if (parseDatum(a.gueltigAb) < start) start = parseDatum(a.gueltigAb);
      if (parseDatum(a.gueltigBis) > ende) ende = parseDatum(a.gueltigBis);
    }
    for (const p of s.schliesstage) {
      if (parseDatum(p.von) < start) start = parseDatum(p.von);
      if (parseDatum(p.bis) > ende) ende = parseDatum(p.bis);
    }
  }
  return { start: tagPlusN(start, -21), ende: tagPlusN(ende, 21) };
}
