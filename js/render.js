// render.js – erzeugt aus dem Studio-JSON den HTML-Code der Website.
// Reine Funktionen: Datum und Design kommen von außen (app.js), hier gibt es kein „new Date()“ ohne Argumente.

import { kuechenSVG } from './kitchen-art.js';
import {
  TAG_SCHLUESSEL, parseDatum, tageZwischen, kurzDatum, oeffnungsStatus, schliessHinweis, schliessung,
} from './zeit.js';

// Präfix für alle IDs im erzeugten HTML. Damit mehrere Studios gleichzeitig auf einer Seite stehen
// können („Alle Studios“), ohne dass IDs doppelt vorkommen. Wird in renderSeite gesetzt.
let idp = '';

const TAGE = [
  ['mo', 'Montag'], ['di', 'Dienstag'], ['mi', 'Mittwoch'], ['do', 'Donnerstag'],
  ['fr', 'Freitag'], ['sa', 'Samstag'], ['so', 'Sonntag'],
];

/** HTML-Sonderzeichen entschärfen (alle Texte aus dem JSON laufen hier durch). */
export function esc(text) {
  return String(text).replace(/[&<>"']/g, (z) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]
  ));
}

function nochText(tage) {
  if (tage <= 0) return 'nur noch heute';
  if (tage === 1) return 'noch 1 Tag';
  return `noch ${tage} Tage`;
}

function telLink(telefon) {
  return `tel:${telefon.replace(/\s/g, '')}`;
}

function initialen(name) {
  const teile = name.trim().split(/\s+/);
  return (teile[0][0] + (teile.length > 1 ? teile[teile.length - 1][0] : '')).toUpperCase();
}

/** Schwarz oder Weiß – je nachdem, was auf der Farbe besser lesbar ist. */
export function kontrastfarbe(hex) {
  const kanal = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const hell = 0.2126 * kanal(0) + 0.7152 * kanal(1) + 0.0722 * kanal(2);
  const kontrastWeiss = 1.05 / (hell + 0.05);
  const kontrastSchwarz = (hell + 0.05) / 0.0556; // #111111
  return kontrastWeiss >= kontrastSchwarz ? '#ffffff' : '#111111';
}

/**
 * Attribute für den Website-Container. Die Studio-Farbe überschreibt --accent
 * nur im eigenen Standard-Design, damit fremde Kombinationen lesbar bleiben.
 */
export function seitenAttribute(studio, theme) {
  const attribute = { 'data-theme': theme, style: '' };
  if (theme === studio.theme) {
    attribute.style = `--accent:${studio.akzent};--accent-contrast:${kontrastfarbe(studio.akzent)}`;
  }
  return attribute;
}

/** Nur Aktionen, die am simulierten Datum gültig sind, früh endende zuerst. */
export function gueltigeAktionen(studio, heute) {
  return studio.aktionen
    .filter((a) => parseDatum(a.gueltigAb) <= heute && heute <= parseDatum(a.gueltigBis))
    .sort((a, b) => parseDatum(a.gueltigBis) - parseDatum(b.gueltigBis));
}

function kopf(studio, route, aktionen, tel, status) {
  const nav = [
    ['kuechen', 'Küchen'],
    ...(aktionen.length ? [['aktionen', 'Aktionen']] : []),
    ['team', 'Team'],
    ['besuch', 'Besuch'],
  ];
  return `
  <header class="kopf">
    <div class="inhalt kopf-zeile">
      <div class="kopf-marke">
        <a class="logo" href="${route}">${esc(studio.name)}</a>
        <p class="status ${status.offen ? 'status-offen' : 'status-zu'}">${esc(status.text)}</p>
      </div>
      <nav class="hauptnav" aria-label="Hauptnavigation">
        <ul>
          ${nav.map(([ziel, text]) => `<li><a href="${route}" data-scroll="${idp}${ziel}">${text}</a></li>`).join('')}
        </ul>
      </nav>
      <a class="btn btn-klein" href="${tel}">Beratung vereinbaren</a>
    </div>
  </header>`;
}

function hero(studio, route, tel, ort) {
  const kueche = studio.kuechen.find((k) => k.id === studio.hero.kueche) ?? studio.kuechen[0];
  // Ortsseite: gleiche Seite, aber der Hero spricht den Nachbarort direkt an
  const titel = ort ? `Ihr Küchenstudio für ${ort.name}` : studio.hero.titel;
  const text = ort
    ? `Nur ${ort.km} km von ${ort.name}, in ${studio.kontakt.ort}. ${studio.hero.text}`
    : studio.hero.text;
  return `
  <section class="hero" aria-labelledby="${idp}hero-titel">
    <div class="inhalt hero-raster">
      <div class="hero-text">
        ${ort ? `<p class="zurueck"><a href="${route}">← Zurück zur Startseite</a></p>` : ''}
        <p class="eyebrow">${esc(studio.slogan)}</p>
        <h1 id="${idp}hero-titel">${esc(titel)}</h1>
        <p class="hero-lead">${esc(text)}</p>
        <div class="buttons">
          <a class="btn" href="${tel}">Beratung vereinbaren</a>
          <a class="btn btn-zweit" href="${route}" data-scroll="${idp}kuechen">Küchen ansehen</a>
        </div>
      </div>
      <div class="hero-bild">${kuechenSVG(kueche)}</div>
    </div>
  </section>`;
}

/** Ortsseite: eigener Text zur Anreise aus dem Nachbarort (Feld „text“ im JSON, optional). */
function ortAnfahrt(ort) {
  if (!ort?.text) return '';
  return `
  <section class="sektion sektion-flaeche" aria-labelledby="${idp}anfahrt-titel">
    <div class="inhalt inhalt-schmal">
      <h2 id="${idp}anfahrt-titel">So kommen Sie aus ${esc(ort.name)} zu uns</h2>
      <p class="hero-lead">${esc(ort.text)}</p>
    </div>
  </section>`;
}

function aktionenBlock(aktionen, heute) {
  if (!aktionen.length) return '';
  return `
  <section class="sektion" id="${idp}aktionen" tabindex="-1" aria-labelledby="${idp}aktionen-titel">
    <div class="inhalt">
      <h2 id="${idp}aktionen-titel">Aktuelle Aktionen</h2>
      <div class="raster raster-aktionen">
        ${aktionen.map((a) => {
          const bis = parseDatum(a.gueltigBis);
          return `
        <article class="karte aktion" data-aktion="${esc(a.titel)}">
          <h3>${esc(a.titel)}</h3>
          <p>${esc(a.text)}</p>
          <p class="hinweis"><strong>${nochText(tageZwischen(heute, bis))}</strong> · gültig bis ${kurzDatum(bis)}</p>
        </article>`;
        }).join('')}
      </div>
    </div>
  </section>`;
}

function vorteile(studio) {
  return `
  <section class="sektion sektion-flaeche" aria-labelledby="${idp}vorteile-titel">
    <div class="inhalt">
      <h2 id="${idp}vorteile-titel">Darum zu uns</h2>
      <ul class="raster raster-vorteile">
        ${studio.vorteile.map((v, i) => `
        <li class="karte vorteil">
          <span class="nummer" aria-hidden="true">${i + 1}</span>
          <h3>${esc(v.titel)}</h3>
          <p>${esc(v.text)}</p>
        </li>`).join('')}
      </ul>
    </div>
  </section>`;
}

function galerie(studio) {
  return `
  <section class="sektion" id="${idp}kuechen" tabindex="-1" aria-labelledby="${idp}kuechen-titel">
    <div class="inhalt">
      <h2 id="${idp}kuechen-titel">Unsere Küchen</h2>
      <div class="raster raster-kuechen">
        ${studio.kuechen.map((k) => `
        <article class="karte kueche">
          <div class="kueche-bild">${kuechenSVG(k)}</div>
          <div class="karte-text">
            <h3>${esc(k.titel)}</h3>
            <p class="marke">${esc(k.marke)}</p>
            <p>${esc(k.beschreibung)}</p>
          </div>
        </article>`).join('')}
      </div>
    </div>
  </section>`;
}

function marken(studio) {
  return `
  <section class="marken" aria-labelledby="${idp}marken-titel">
    <div class="inhalt">
      <h2 id="${idp}marken-titel" class="marken-titel">Unsere Marken</h2>
      <ul class="marken-liste">
        ${studio.marken.map((m) => `<li>${esc(m)}</li>`).join('')}
      </ul>
    </div>
  </section>`;
}

function team(studio) {
  return `
  <section class="sektion" id="${idp}team" tabindex="-1" aria-labelledby="${idp}team-titel">
    <div class="inhalt">
      <h2 id="${idp}team-titel">Ihr Team</h2>
      <ul class="raster raster-team">
        ${studio.team.map((p) => `
        <li class="karte person">
          <span class="avatar" aria-hidden="true">${esc(initialen(p.name))}</span>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.rolle)}</p>
          <p class="seit">im Team seit ${esc(p.seit)}</p>
        </li>`).join('')}
      </ul>
    </div>
  </section>`;
}

function besuch(studio, heute, tel) {
  const k = studio.kontakt;
  const heuteSchluessel = TAG_SCHLUESSEL[heute.getDay()];
  const hinweis = schliessHinweis(studio, heute);
  const pause = schliessung(studio, heute);
  return `
  <section class="sektion sektion-flaeche" id="${idp}besuch" tabindex="-1" aria-labelledby="${idp}besuch-titel">
    <div class="inhalt besuch-raster">
      <div>
        <h2 id="${idp}besuch-titel">Besuchen Sie uns</h2>
        <address class="adresse">
          ${esc(k.strasse)}<br>${esc(k.plz)} ${esc(k.ort)}<br>
          <a href="${tel}">${esc(k.telefon)}</a><br>
          <a href="mailto:${esc(k.email)}">${esc(k.email)}</a>
        </address>
        ${hinweis ? `<p class="schliess-hinweis">${esc(hinweis)}</p>` : ''}
      </div>
      <table class="zeiten">
        <caption class="visuell-versteckt">Öffnungszeiten</caption>
        <tbody>
          ${TAGE.map(([schluessel, name]) => {
            const zeit = studio.oeffnungszeiten[schluessel];
            const istHeute = schluessel === heuteSchluessel;
            return `
          <tr${istHeute ? ' class="heute" aria-current="date"' : ''}>
            <th scope="row">${name}${istHeute ? ' <span class="heute-marke">heute</span>' : ''}</th>
            <td>${istHeute && pause ? `geschlossen (${esc(pause.grund)})` : zeit ? `${esc(zeit[0])}–${esc(zeit[1])} Uhr` : 'geschlossen'}</td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </section>`;
}

function faq(studio) {
  return `
  <section class="sektion" aria-labelledby="${idp}faq-titel">
    <div class="inhalt inhalt-schmal">
      <h2 id="${idp}faq-titel">Häufige Fragen</h2>
      ${studio.faq.map((f) => `
      <details class="faq-eintrag">
        <summary>${esc(f.frage)}</summary>
        <p>${esc(f.antwort)}</p>
      </details>`).join('')}
    </div>
  </section>`;
}

function nachbarorte(studio, theme, aktuell) {
  return `
  <section class="orte" id="${idp}orte" aria-labelledby="${idp}orte-titel">
    <div class="inhalt">
      <h2 id="${idp}orte-titel" class="orte-titel">Wir planen auch für Kunden aus</h2>
      <ul class="orte-liste">
        ${studio.nachbarorte.map((o) => `
        <li><a href="#/${studio.id}/${theme}/ort/${esc(o.slug)}"${aktuell?.slug === o.slug ? ' aria-current="page"' : ''} title="${esc(o.km)} km von ${esc(studio.kontakt.ort)}">${esc(o.name)}</a></li>`).join('')}
      </ul>
    </div>
  </section>`;
}

function fuss(studio, tel) {
  const k = studio.kontakt;
  return `
  <footer class="fuss">
    <div class="inhalt fuss-raster">
      <div>
        <p class="fuss-name">${esc(studio.name)}</p>
        <address class="adresse">
          ${esc(k.strasse)}, ${esc(k.plz)} ${esc(k.ort)}<br>
          <a href="${tel}">${esc(k.telefon)}</a> · <a href="mailto:${esc(k.email)}">${esc(k.email)}</a>
        </address>
      </div>
      <p class="fuss-rechtliches">
        <span title="Platzhalter in der Demo">Impressum</span> ·
        <span title="Platzhalter in der Demo">Datenschutz</span>
      </p>
    </div>
    <p class="inhalt demo-hinweis">Demo – fiktives Studio</p>
  </footer>`;
}

/**
 * Rendert die komplette Studio-Seite.
 * @param {object} studio  Inhalt der Studio-JSON
 * @param {{theme: string, heute: Date, minuten: number, ort?: object|null}} optionen
 *   gewähltes Design, (simuliertes) Datum, echte Uhrzeit als Minuten seit Mitternacht
 *   und optional ein Eintrag aus „nachbarorte“ für die Ortsseite
 */
export function renderSeite(studio, { theme, heute, minuten, ort = null }) {
  idp = `${studio.id}-`;
  const route = `#/${studio.id}/${theme}`;
  const tel = telLink(studio.kontakt.telefon);
  const aktionen = gueltigeAktionen(studio, heute);
  return [
    kopf(studio, route, aktionen, tel, oeffnungsStatus(studio, heute, minuten)),
    hero(studio, route, tel, ort),
    ortAnfahrt(ort),
    aktionenBlock(aktionen, heute),
    vorteile(studio),
    galerie(studio),
    marken(studio),
    team(studio),
    besuch(studio, heute, tel),
    faq(studio),
    nachbarorte(studio, theme, ort),
    fuss(studio, tel),
  ].join('');
}
