// suche.js – „So lesen Suchmaschinen die Daten“: eine neutrale Vorschau (Suchtreffer + Firmenkarte),
// die ausschließlich aus dem erzeugten JSON-LD und dem Studio-JSON gebaut wird.
// Bewusst ohne Logos und ohne das Design einer echten Suchmaschine.

import { esc } from './render.js';
import { erzeugeJsonLd } from './jsonld.js';
import { parseDatum, kurzDatum, oeffnungsStatus } from './zeit.js';

const TAG_DEUTSCH = {
  Monday: 'Mo', Tuesday: 'Di', Wednesday: 'Mi', Thursday: 'Do', Friday: 'Fr', Saturday: 'Sa', Sunday: 'So',
};

/**
 * @param {object} studio  Studio-JSON (Arbeitskopie)
 * @param {Date} datum  simuliertes Datum
 * @param {number} minuten  echte Uhrzeit als Minuten seit Mitternacht
 */
export function sucheVorschauHtml(studio, datum, minuten) {
  const ld = erzeugeJsonLd(studio);
  const status = oeffnungsStatus(studio, datum, minuten);
  const zeiten = ld.openingHoursSpecification.map((z) => `
      <tr><th scope="row">${z.dayOfWeek.map((t) => TAG_DEUTSCH[t]).join(', ')}</th><td>${esc(z.opens)}–${esc(z.closes)} Uhr</td></tr>`).join('');
  const pausen = ld.specialOpeningHoursSpecification.map((p) => `
      <tr class="suche-pause"><th scope="row">${kurzDatum(parseDatum(p.validFrom))}–${kurzDatum(parseDatum(p.validThrough))}</th><td>geschlossen</td></tr>`).join('');
  const adresse = ld.address;

  return `
  <p class="suche-hinweis">So lesen Suchmaschinen die Daten. Neutrale Darstellung, kein echtes Suchergebnis.
    Alles hier stammt aus dem erzeugten JSON-LD und ändert sich mit Datum und Editor.</p>

  <div class="suche-treffer">
    <p class="suche-url">${esc(studio.id)}.example › startseite</p>
    <p class="suche-titel">${esc(studio.seo.titel)}</p>
    <p class="suche-text">${esc(ld.description)}</p>
  </div>

  <div class="suche-karte">
    <p class="suche-name">${esc(ld.name)}</p>
    <p class="suche-art">Küchenstudio · ${esc(adresse.addressLocality)}</p>
    <p class="suche-status ${status.offen ? 'suche-offen' : 'suche-zu'}">${esc(status.text)}</p>
    <table class="suche-zeiten">
      <caption class="visuell-versteckt-demo">Öffnungszeiten laut strukturierten Daten</caption>
      <tbody>${zeiten}${pausen}</tbody>
    </table>
    <dl class="suche-daten">
      <dt>Adresse</dt><dd>${esc(adresse.streetAddress)}, ${esc(adresse.postalCode)} ${esc(adresse.addressLocality)}</dd>
      <dt>Telefon</dt><dd>${esc(ld.telephone)}</dd>
      <dt>Einzugsgebiet</dt><dd>${ld.areaServed.map((o) => esc(o.name)).join(' · ')}</dd>
    </dl>
  </div>`;
}
