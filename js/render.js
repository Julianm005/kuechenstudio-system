// render.js – erzeugt aus dem Studio-JSON den HTML-Code der Website.
// Reine Funktionen: Datum und Design kommen von außen (app.js), hier gibt es kein „new Date()“ ohne Argumente.

import { kuechenSVG } from './kitchen-art.js';
import {
  TAG_SCHLUESSEL, parseDatum, tageZwischen, kurzDatum, oeffnungsStatus, schliessHinweis, schliessung,
} from './zeit.js';
import { terminAuswahl, ersterTerminTag, fruehesterTag, isoDatum } from './termin.js';

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

function kopf(studio, route, aktionen, tel, status, typisch) {
  const nav = [
    ['kuechen', 'Küchen'],
    ...(aktionen.length ? [['aktionen', 'Aktionen']] : []),
    ['team', 'Team'],
    ['termin', 'Termin'],
    ['besuch', 'Besuch'],
  ];
  return `
  <header class="kopf">
    <div class="inhalt kopf-zeile">
      <div class="kopf-marke">
        <a class="logo" href="${route}">${esc(studio.name)}</a>
        ${typisch
          ? '<p class="demo-warnung">⚠ Kein Live-Status: Besucher sehen nicht, ob heute geöffnet ist</p>'
          : `<p class="status ${status.offen ? 'status-offen' : 'status-zu'}">${esc(status.text)}</p>`}
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
      <div class="hero-bild">
        ${kuechenSVG(kueche)}
        <div class="konfig" data-studio="${esc(studio.id)}" data-kueche="${esc(kueche.id)}" role="group" aria-label="Küche anpassen">
          <span class="konfig-titel">Probieren Sie es aus:</span>
          <label>Front <input type="color" data-farbe="front" value="${esc(kueche.front)}"></label>
          <label>Arbeitsplatte <input type="color" data-farbe="arbeitsplatte" value="${esc(kueche.arbeitsplatte)}"></label>
          <label>Wand <input type="color" data-farbe="wand" value="${esc(kueche.wand)}"></label>
        </div>
      </div>
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

function aktionenBlock(aktionen, heute, typisch) {
  if (!aktionen.length) return '';
  return `
  <section class="sektion" id="${idp}aktionen" tabindex="-1" aria-labelledby="${idp}aktionen-titel">
    <div class="inhalt">
      <h2 id="${idp}aktionen-titel">Aktuelle Aktionen</h2>
      <div class="raster raster-aktionen">
        ${aktionen.map((a) => {
          const bis = parseDatum(a.gueltigBis);
          const ab = parseDatum(a.gueltigAb);
          let zeile = `<p class="hinweis"><strong>${nochText(tageZwischen(heute, bis))}</strong> · gültig bis ${kurzDatum(bis)}</p>`;
          if (typisch && bis < heute) {
            zeile = `<p class="demo-warnung">⚠ Seit ${tageZwischen(bis, heute)} Tagen abgelaufen und trotzdem sichtbar</p>`;
          } else if (typisch && ab > heute) {
            zeile = `<p class="demo-warnung">⚠ Startet erst in ${tageZwischen(heute, ab)} Tagen, steht aber schon da</p>`;
          }
          return `
        <article class="karte aktion" data-aktion="${esc(a.titel)}">
          <h3>${esc(a.titel)}</h3>
          <p>${esc(a.text)}</p>
          ${zeile}
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
        <article class="karte kueche" data-kueche="${esc(k.id)}">
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

/** Kundenstimmen: reine Beispieltexte für die Demo, bewusst nicht Teil der schema.org-Daten. */
function stimmen(studio) {
  if (!studio.stimmen?.length) return '';
  return `
  <section class="sektion sektion-flaeche" aria-labelledby="${idp}stimmen-titel">
    <div class="inhalt">
      <h2 id="${idp}stimmen-titel">Das sagen unsere Kundinnen und Kunden</h2>
      <ul class="raster raster-stimmen">
        ${studio.stimmen.map((st) => `
        <li class="karte stimme">
          <p class="sterne" role="img" aria-label="${esc(st.sterne)} von 5 Sternen">${'★'.repeat(st.sterne)}${'☆'.repeat(5 - st.sterne)}</p>
          <blockquote><p>${esc(st.text)}</p></blockquote>
          <p class="stimme-name">${esc(st.name)}, ${esc(st.ort)}</p>
        </li>`).join('')}
      </ul>
      <p class="klein-hinweis">Erfundene Beispielstimmen für die Demo.</p>
    </div>
  </section>`;
}

const PROJEKTE = ['Neue Küche komplett', 'Küche renovieren (Fronten, Arbeitsplatte)', 'Elektrogeräte tauschen', 'Noch unklar'];
const ZEITRAEUME = ['In den nächsten 3 Monaten', 'In 3 bis 6 Monaten', 'Später', 'Weiß ich noch nicht'];
const BERATUNGEN = ['Im Studio', 'Telefonisch', 'Bei mir zu Hause (Aufmaß)'];

/** Terminanfrage: nur Demo. Die Uhrzeiten folgen den Öffnungszeiten, Schließtage sind gesperrt. */
function termin(studio, heute) {
  const erster = ersterTerminTag(studio, heute);
  const auswahl = erster ? terminAuswahl(studio, erster, heute) : { slots: [], hinweis: 'Zurzeit sind keine Termine möglich.' };
  const optionen = (liste) => liste.map((o) => `<option>${esc(o)}</option>`).join('');
  return `
  <section class="sektion" id="${idp}termin" tabindex="-1" aria-labelledby="${idp}termin-titel">
    <div class="inhalt inhalt-schmal">
      <h2 id="${idp}termin-titel">Beratungstermin anfragen</h2>
      <p class="hero-lead">Drei kurze Fragen, damit wir uns vor dem Termin schon Zeit für Ihr Projekt nehmen.</p>
      <form class="termin-formular karte" data-studio="${esc(studio.id)}" data-heute="${isoDatum(heute)}">
        <div class="termin-raster">
          <label class="termin-feld"><span>Was planen Sie?</span><select name="projekt">${optionen(PROJEKTE)}</select></label>
          <label class="termin-feld"><span>Wann soll die Küche stehen?</span><select name="zeitraum">${optionen(ZEITRAEUME)}</select></label>
          <label class="termin-feld"><span>Wie möchten Sie beraten werden?</span><select name="beratung">${optionen(BERATUNGEN)}</select></label>
          <label class="termin-feld"><span>Wunschtag</span>
            <input type="date" name="tag" class="termin-datum" required min="${isoDatum(fruehesterTag(heute))}" value="${erster ? isoDatum(erster) : ''}"></label>
          <label class="termin-feld"><span>Uhrzeit</span>
            <select name="zeit" class="termin-zeit" required>${optionen(auswahl.slots.map((z) => `${z} Uhr`))}</select></label>
          <label class="termin-feld"><span>Ihr Name</span><input type="text" name="name" required autocomplete="off"></label>
        </div>
        <p class="termin-hinweis" role="status" aria-live="polite">${esc(auswahl.hinweis)}</p>
        <button class="btn" type="submit">Termin anfragen</button>
        <p class="klein-hinweis">Demo: Es wird nichts gesendet oder gespeichert.</p>
      </form>
    </div>
  </section>`;
}

/** Feste Schnellzugriffe am unteren Rand, nur in schmalen Containern (Handy). */
function mobilleiste(tel) {
  return `
  <nav class="mobilleiste" aria-label="Schnellzugriff">
    <a class="btn" href="${tel}">Anrufen</a>
    <a class="btn btn-zweit" href="#" data-scroll="${idp}termin">Termin</a>
    <a class="btn btn-zweit" href="#" data-scroll="${idp}besuch">Besuch</a>
  </nav>`;
}

function besuch(studio, heute, tel, typisch) {
  const k = studio.kontakt;
  const heuteSchluessel = TAG_SCHLUESSEL[heute.getDay()];
  const hinweis = schliessHinweis(studio, heute);
  const pause = typisch ? null : schliessung(studio, heute);
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
        ${hinweis && !typisch ? `<p class="schliess-hinweis">${esc(hinweis)}</p>` : ''}
        ${hinweis && typisch ? '<p class="demo-warnung">⚠ Schließtage nicht angekündigt: Kunden stehen vor verschlossener Tür</p>' : ''}
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

function nachbarorte(studio, theme, aktuell, typisch) {
  if (typisch) {
    return `
  <section class="orte">
    <div class="inhalt">
      <p class="demo-warnung">⚠ Keine Seiten für ${studio.nachbarorte.length} Nachbarorte: Wer in ${esc(studio.nachbarorte.map((o) => o.name).slice(0, 3).join(', '))} nach einem Küchenstudio sucht, findet dieses nicht</p>
    </div>
  </section>`;
  }
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
/** Banner der Ansicht „Typische Website“: zählt die Probleme, die diese Seite hätte. */
function typischBanner(studio, heute) {
  const abgelaufen = studio.aktionen.filter((a) => parseDatum(a.gueltigBis) < heute).length;
  const kuenftig = studio.aktionen.filter((a) => parseDatum(a.gueltigAb) > heute).length;
  const probleme = 3 + abgelaufen + kuenftig + (schliessHinweis(studio, heute) ? 1 : 0);
  return `
  <div class="typisch-banner" role="note">
    <p><strong>So würde eine typische Website dieselben Daten zeigen:</strong> ohne Selbstpflege.
      Die roten Markierungen sind die Probleme aus der Marktstudie. Hier sind es <strong>${probleme}</strong>.</p>
    <button type="button" class="btn btn-klein" data-typisch-aus>Zurück zur gepflegten Website</button>
  </div>`;
}

export function renderSeite(studio, { theme, heute, minuten, ort = null, typisch = false }) {
  idp = `${studio.id}-`;
  const route = `#/${studio.id}/${theme}`;
  const tel = telLink(studio.kontakt.telefon);
  const aktionen = typisch
    ? [...studio.aktionen].sort((a, b) => parseDatum(a.gueltigBis) - parseDatum(b.gueltigBis))
    : gueltigeAktionen(studio, heute);
  return [
    typisch ? typischBanner(studio, heute) : '',
    kopf(studio, route, aktionen, tel, oeffnungsStatus(studio, heute, minuten), typisch),
    hero(studio, route, tel, ort),
    ortAnfahrt(ort),
    aktionenBlock(aktionen, heute, typisch),
    vorteile(studio),
    galerie(studio),
    marken(studio),
    team(studio),
    stimmen(studio),
    termin(studio, heute),
    besuch(studio, heute, tel, typisch),
    faq(studio),
    nachbarorte(studio, theme, ort, typisch),
    fuss(studio, tel),
    mobilleiste(tel),
  ].join('');
}
