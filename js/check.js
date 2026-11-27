// check.js – Qualitäts-Check: prüft ein Studio-JSON auf die typischen Probleme von Küchenstudio-Websites.
// Jede Prüfung liefert Status + einen erklärenden Satz. Reine Funktionen, das Datum kommt von außen.

import { parseDatum } from './zeit.js';
import { erzeugeJsonLd } from './jsonld.js';

/** Status: ok ✅ | auto ⚙️ (automatisch gelöst) | warnung ⚠️ | fehler ❌ */
export const STATUS_ZEICHEN = {
  ok: { zeichen: '✅', name: 'in Ordnung' },
  auto: { zeichen: '⚙️', name: 'automatisch gelöst' },
  warnung: { zeichen: '⚠️', name: 'Warnung' },
  fehler: { zeichen: '❌', name: 'Fehler' },
};

const TAGE = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
const WERBEWOERTER = /aktion|angebot|neuheiten|messe|rabatt/i;
// Felder, in denen Jahreszahlen normal sind
const JAHR_IGNORIEREN = new Set(['seit', 'gueltigAb', 'gueltigBis', 'von', 'bis']);

function ergebnis(id, titel, status, text) {
  return { id, titel, status, text };
}

/** Alle Texte im JSON (rekursiv), außer in den ignorierten Feldern. */
function* alleTexte(wert, schluessel) {
  if (JAHR_IGNORIEREN.has(schluessel)) return;
  if (typeof wert === 'string') yield wert;
  else if (Array.isArray(wert)) for (const w of wert) yield* alleTexte(w, schluessel);
  else if (wert && typeof wert === 'object') {
    for (const [k, w] of Object.entries(wert)) yield* alleTexte(w, k);
  }
}

function pruefeOrtImTitel(studio) {
  const titel = 'Ort steht im Seitentitel';
  return studio.seo.titel.includes(studio.kontakt.ort)
    ? ergebnis('titel', titel, 'ok', `„${studio.seo.titel}“ nennt ${studio.kontakt.ort}. Bei Google zählt der Ort im Titel für die lokale Suche.`)
    : ergebnis('titel', titel, 'warnung', `Der Titel „${studio.seo.titel}“ nennt ${studio.kontakt.ort} nicht. 54 % der Küchenstudios verschenken so lokale Treffer.`);
}

function pruefeNachbarorte(studio) {
  const titel = 'Mindestens 3 Seiten für Nachbarorte';
  const n = studio.nachbarorte.length;
  if (n >= 3) return ergebnis('orte', titel, 'ok', `${n} Ortsseiten werden automatisch erzeugt, zum Beispiel für ${studio.nachbarorte[0].name}.`);
  if (n > 0) return ergebnis('orte', titel, 'warnung', `Nur ${n} Nachbarort${n === 1 ? '' : 'e'} hinterlegt. Mit mindestens 3 Ortsseiten wird das Studio in der Umgebung besser gefunden.`);
  return ergebnis('orte', titel, 'fehler', 'Keine Nachbarorte hinterlegt: Es gibt keine einzige Ortsseite für die lokale Suche.');
}

function pruefeAbgelaufeneAktionen(studio, datum) {
  const titel = 'Abgelaufene Aktionen';
  const abgelaufen = studio.aktionen.filter((a) => parseDatum(a.gueltigBis) < datum).length;
  const kommend = studio.aktionen.filter((a) => parseDatum(a.gueltigAb) > datum).length;
  const kommendText = kommend ? ` ${kommend} kommende Aktion${kommend === 1 ? '' : 'en'} erscheint von selbst zum Startdatum.` : '';
  if (abgelaufen) {
    return ergebnis('abgelaufen', titel, 'auto', `${abgelaufen} abgelaufene Aktion${abgelaufen === 1 ? '' : 'en'} automatisch ausgeblendet.${kommendText}`);
  }
  return ergebnis('abgelaufen', titel, 'ok', `Keine abgelaufenen Aktionen. Sie würden automatisch ausgeblendet.${kommendText}`);
}

function pruefeJahreszahlen(studio, datum) {
  const titel = 'Keine veralteten Jahreszahlen';
  const jahr = datum.getFullYear();
  const treffer = [];
  for (const text of alleTexte(studio)) {
    if (!WERBEWOERTER.test(text)) continue;
    const alt = [...text.matchAll(/\b(19|20)\d\d\b/g)].map((m) => Number(m[0])).find((j) => j < jahr);
    if (alt) treffer.push({ text, jahr: alt });
  }
  if (!treffer.length) return ergebnis('jahre', titel, 'ok', `Keine Aktions- oder Angebotstexte mit einer Jahreszahl vor ${jahr}.`);
  const t = treffer[0];
  const mehr = treffer.length > 1 ? ` (und ${treffer.length - 1} weitere)` : '';
  return ergebnis('jahre', titel, 'warnung', `„${t.text}“ nennt ${t.jahr}, aber es ist ${jahr}${mehr}. Veraltete Jahreszahlen wirken wie eine vergessene Website.`);
}

function pruefeAltTexte(studio) {
  const titel = 'Alle Küchenbilder haben Alt-Texte';
  const fehlen = studio.kuechen.filter((k) => !k.alt || !k.alt.trim());
  return fehlen.length
    ? ergebnis('alt', titel, 'fehler', `${fehlen.length} von ${studio.kuechen.length} Küchenbildern ohne Alt-Text (zum Beispiel „${fehlen[0].titel}“).`)
    : ergebnis('alt', titel, 'ok', `Alle ${studio.kuechen.length} Küchenbilder sind für Screenreader beschrieben.`);
}

function pruefeOeffnungszeiten(studio) {
  const titel = 'Öffnungszeiten für alle 7 Tage gepflegt';
  const gueltig = (w) => w === null || (Array.isArray(w) && w.length === 2 && w.every((z) => /^\d\d:\d\d$/.test(z)));
  const luecken = TAGE.filter((t) => !gueltig(studio.oeffnungszeiten[t]));
  return luecken.length
    ? ergebnis('zeiten', titel, 'fehler', `Für ${luecken.join(', ')} fehlt eine gültige Angabe. Ruhetage müssen bewusst als geschlossen eingetragen sein.`)
    : ergebnis('zeiten', titel, 'ok', 'Jeder Wochentag hat Zeiten oder ist bewusst als geschlossen eingetragen.');
}

function pruefeSchliesstage(studio, jsonLd) {
  const titel = 'Schließtage hinterlegt und an Google übergeben';
  const n = studio.schliesstage.length;
  if (!n) return ergebnis('schliess', titel, 'warnung', 'Keine Schließtage hinterlegt. Google zeigt dann an Feiertagen und in den Betriebsferien falsche Öffnungszeiten.');
  const uebergeben = jsonLd?.specialOpeningHoursSpecification?.length ?? 0;
  return uebergeben === n
    ? ergebnis('schliess', titel, 'ok', `${n} Schließzeitraum${n === 1 ? '' : 'e'} hinterlegt und als strukturierte Daten übergeben.`)
    : ergebnis('schliess', titel, 'fehler', 'Schließtage sind hinterlegt, landen aber nicht in den strukturierten Daten.');
}

function pruefeStrukturierteDaten(jsonLd) {
  const titel = 'Strukturierte Daten (schema.org) erzeugt';
  const vollstaendig = jsonLd && jsonLd['@type'] && jsonLd.address && jsonLd.openingHoursSpecification?.length;
  return vollstaendig
    ? ergebnis('jsonld', titel, 'auto', 'Adresse, Kontakt, Öffnungszeiten und Einzugsgebiet werden automatisch aus den Daten erzeugt.')
    : ergebnis('jsonld', titel, 'fehler', 'Die strukturierten Daten sind unvollständig (Adresse oder Öffnungszeiten fehlen).');
}

function pruefeKontakt(studio) {
  const titel = 'Telefon und E-Mail vollständig und klickbar';
  const k = studio.kontakt;
  const telefonOk = k.telefon.replace(/\D/g, '').length >= 6;
  const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k.email);
  if (telefonOk && mailOk) return ergebnis('kontakt', titel, 'ok', 'Telefon (tel:) und E-Mail (mailto:) sind als Links hinterlegt, auf dem Handy reicht ein Tipp.');
  return ergebnis('kontakt', titel, 'fehler', `${!telefonOk ? 'Die Telefonnummer ist unvollständig. ' : ''}${!mailOk ? 'Die E-Mail-Adresse ist ungültig.' : ''}`.trim());
}

/**
 * Führt alle 9 Prüfungen aus.
 * @param {object} studio  Studio-JSON
 * @param {Date} datum  simuliertes Datum (lokale Mitternacht)
 * @returns {{ergebnisse: object[], punkte: number, gesamt: number, schlechtester: string}}
 *   Punkte zählen ✅ und ⚙️; schlechtester = schlechtester Status (für die Farbe des Badges)
 */
export function pruefe(studio, datum) {
  const jsonLd = erzeugeJsonLd(studio);
  const ergebnisse = [
    pruefeOrtImTitel(studio),
    pruefeNachbarorte(studio),
    pruefeAbgelaufeneAktionen(studio, datum),
    pruefeJahreszahlen(studio, datum),
    pruefeAltTexte(studio),
    pruefeOeffnungszeiten(studio),
    pruefeSchliesstage(studio, jsonLd),
    pruefeStrukturierteDaten(jsonLd),
    pruefeKontakt(studio),
  ];
  const punkte = ergebnisse.filter((e) => e.status === 'ok' || e.status === 'auto').length;
  const schlechtester = ['fehler', 'warnung'].find((s) => ergebnisse.some((e) => e.status === s)) ?? 'ok';
  return { ergebnisse, punkte, gesamt: ergebnisse.length, schlechtester };
}
