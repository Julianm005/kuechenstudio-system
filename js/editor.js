// editor.js – Live-Editor: Formular für die wichtigsten Felder eines Studios.
// Das Modul kennt nur die Daten (Formular erzeugen, Werte prüfen und setzen). Ereignisse, Panel und
// Neu-Rendern der Seite liegen in app.js.

import { esc } from './render.js';
import { parseDatum, isoDatum, tagPlusN } from './zeit.js';

const TAGE = [
  ['mo', 'Montag'], ['di', 'Dienstag'], ['mi', 'Mittwoch'], ['do', 'Donnerstag'],
  ['fr', 'Freitag'], ['sa', 'Samstag'], ['so', 'Sonntag'],
];
const STILE = { grifflos: 'Grifflos', landhaus: 'Landhaus', insel: 'Insel' };

/** Welcher Teil der Website ändert sich bei welchem Feld? (Beschriftung für die Meldung, Abschnitt zum Aufblitzen) */
const BEREICHE = {
  seo: { name: 'Seitentitel', abschnitte: [] },
  hero: { name: 'Hero-Text', abschnitte: ['hero-titel'] },
  kontakt: { name: 'Kontaktdaten', abschnitte: ['besuch'] },
  oeffnungszeiten: { name: 'Öffnungszeiten', abschnitte: ['besuch'] },
  aktionen: { name: 'Aktionen', abschnitte: ['aktionen'] },
  schliesstage: { name: 'Schließtage', abschnitte: ['besuch'] },
  kuechen: { name: 'Küchenbild', abschnitte: ['kuechen', 'hero-titel'] },
  nachbarorte: { name: 'Nachbarorte', abschnitte: ['orte'] },
};

export function bereichFuer(pfad) {
  return BEREICHE[pfad.split('.')[0]] ?? { name: 'Daten', abschnitte: [] };
}

// ---------- Pfade ----------

export function holePfad(obj, pfad) {
  return pfad.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setzePfad(obj, pfad, wert) {
  const teile = pfad.split('.');
  const letzter = teile.pop();
  const ziel = teile.reduce((o, k) => o[k], obj);
  ziel[letzter] = wert;
}

// ---------- Prüfen und setzen ----------

function zuMinuten(zeit) {
  const [h, m] = zeit.split(':').map(Number);
  return h * 60 + m;
}

/** Prüft die Gruppe, zu der ein Feld gehört. Gibt eine Fehlermeldung oder '' zurück. */
function pruefeGruppe(studio, pfad) {
  const teile = pfad.split('.');
  if (teile[0] === 'oeffnungszeiten') {
    const zeiten = studio.oeffnungszeiten[teile[1]];
    if (zeiten && zuMinuten(zeiten[1]) <= zuMinuten(zeiten[0])) return 'Das Ende muss nach dem Beginn liegen.';
  }
  if (teile[0] === 'aktionen') {
    const a = studio.aktionen[Number(teile[1])];
    if (a && parseDatum(a.gueltigBis) < parseDatum(a.gueltigAb)) return '„Bis“ darf nicht vor „Ab“ liegen.';
  }
  if (teile[0] === 'schliesstage') {
    const p = studio.schliesstage[Number(teile[1])];
    if (p && parseDatum(p.bis) < parseDatum(p.von)) return '„Bis“ darf nicht vor „Von“ liegen.';
  }
  return '';
}

/**
 * Setzt ein Feld, wenn der Wert gültig ist. Bei ungültigen Werten bleibt der alte Wert erhalten.
 * @returns {{ok: boolean, meldung: string}}
 */
export function wendeAn(studio, pfad, rohwert) {
  const teile = pfad.split('.');
  const alt = holePfad(studio, pfad);
  let wert = rohwert;

  if (teile[0] === 'nachbarorte' && teile[2] === 'km') {
    wert = Number(rohwert);
    if (!Number.isFinite(wert) || wert < 0) return { ok: false, meldung: 'Bitte eine Entfernung in Kilometern angeben.' };
  }
  if (['gueltigAb', 'gueltigBis', 'von', 'bis'].includes(teile[2]) && !/^\d{4}-\d{2}-\d{2}$/.test(rohwert)) {
    return { ok: false, meldung: 'Bitte ein vollständiges Datum wählen.' };
  }
  if (teile[0] === 'oeffnungszeiten' && !/^\d{2}:\d{2}$/.test(rohwert)) {
    return { ok: false, meldung: 'Bitte eine Uhrzeit wählen.' };
  }

  setzePfad(studio, pfad, wert);
  const fehler = pruefeGruppe(studio, pfad);
  if (fehler) {
    setzePfad(studio, pfad, alt);
    return { ok: false, meldung: fehler };
  }
  return { ok: true, meldung: '' };
}

/** Wochentag als geöffnet oder geschlossen markieren. */
export function setzeTagGeoeffnet(studio, tag, offen) {
  studio.oeffnungszeiten[tag] = offen ? ['10:00', '18:00'] : null;
}

/** Aus „Großenhain“ wird „grossenhain“; Doppelte bekommen eine Nummer. */
export function slugFuer(name, vorhandene) {
  const basis = name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ort';
  let slug = basis;
  let n = 2;
  while (vorhandene.includes(slug)) {
    slug = `${basis}-${n}`;
    n += 1;
  }
  return slug;
}

/** Ändert den Namen eines Ortes und passt den Slug an (ohne mit anderen Orten zu kollidieren). */
export function benenneOrt(studio, index, name) {
  const ort = studio.nachbarorte[index];
  ort.name = name;
  const andere = studio.nachbarorte.filter((_, i) => i !== index).map((o) => o.slug);
  ort.slug = slugFuer(name, andere);
}

/**
 * Hinzufügen und Entfernen von Listeneinträgen.
 * @returns {string} Pfad des Feldes, das danach den Fokus bekommen soll
 */
export function aendereListe(studio, aktion, datum) {
  const [art, indexText] = aktion.split(':');
  const index = Number(indexText);
  switch (art) {
    case 'aktion-neu':
      studio.aktionen.push({
        titel: 'Neue Aktion',
        text: 'Hier steht der Text der Aktion.',
        gueltigAb: isoDatum(datum),
        gueltigBis: isoDatum(tagPlusN(datum, 14)),
      });
      return `aktionen.${studio.aktionen.length - 1}.titel`;
    case 'aktion-weg':
      studio.aktionen.splice(index, 1);
      return 'aktion-neu';
    case 'pause-neu':
      studio.schliesstage.push({
        von: isoDatum(tagPlusN(datum, 10)),
        bis: isoDatum(tagPlusN(datum, 17)),
        grund: 'Betriebsferien',
      });
      return `schliesstage.${studio.schliesstage.length - 1}.grund`;
    case 'pause-weg':
      studio.schliesstage.splice(index, 1);
      return 'pause-neu';
    case 'ort-neu': {
      const name = 'Neuer Ort';
      studio.nachbarorte.push({
        name,
        slug: slugFuer(name, studio.nachbarorte.map((o) => o.slug)),
        km: 10,
      });
      return `nachbarorte.${studio.nachbarorte.length - 1}.name`;
    }
    case 'ort-weg':
      studio.nachbarorte.splice(index, 1);
      return 'ort-neu';
    default:
      return '';
  }
}

// ---------- Formular ----------

function feld(pfad, bezeichnung, wert, optionen = {}) {
  const { typ = 'text', klasse = '', extra = '' } = optionen;
  return `
    <label class="editor-feld ${klasse}">
      <span>${esc(bezeichnung)}</span>
      <input type="${typ}" data-pfad="${pfad}" value="${esc(wert ?? '')}" ${extra}>
      <span class="editor-fehler" data-fehler="${pfad}" role="alert"></span>
    </label>`;
}

function knopf(aktion, text, klasse = '') {
  return `<button type="button" class="editor-knopf ${klasse}" data-aktion="${aktion}">${esc(text)}</button>`;
}

/** Komplettes Formular für ein Studio. */
export function editorHtml(studio) {
  const zeiten = TAGE.map(([tag, name]) => {
    const z = studio.oeffnungszeiten[tag];
    return `
    <div class="editor-zeile editor-zeit">
      <label class="editor-offen"><input type="checkbox" data-tag="${tag}" ${z ? 'checked' : ''}> ${name}</label>
      <input type="time" data-pfad="oeffnungszeiten.${tag}.0" aria-label="${name} von" value="${z ? z[0] : ''}" ${z ? '' : 'disabled'}>
      <span aria-hidden="true">–</span>
      <input type="time" data-pfad="oeffnungszeiten.${tag}.1" aria-label="${name} bis" value="${z ? z[1] : ''}" ${z ? '' : 'disabled'}>
      <span class="editor-fehler" data-fehler="oeffnungszeiten.${tag}.1" role="alert"></span>
    </div>`;
  }).join('');

  const aktionen = studio.aktionen.map((a, i) => `
    <div class="editor-gruppe">
      ${feld(`aktionen.${i}.titel`, 'Titel', a.titel)}
      ${feld(`aktionen.${i}.text`, 'Text', a.text)}
      <div class="editor-zeile">
        ${feld(`aktionen.${i}.gueltigAb`, 'Gültig ab', a.gueltigAb, { typ: 'date' })}
        ${feld(`aktionen.${i}.gueltigBis`, 'Gültig bis', a.gueltigBis, { typ: 'date' })}
        ${knopf(`aktion-weg:${i}`, 'Entfernen', 'editor-knopf-gefahr')}
      </div>
    </div>`).join('');

  const pausen = studio.schliesstage.map((p, i) => `
    <div class="editor-gruppe">
      <div class="editor-zeile">
        ${feld(`schliesstage.${i}.von`, 'Von', p.von, { typ: 'date' })}
        ${feld(`schliesstage.${i}.bis`, 'Bis', p.bis, { typ: 'date' })}
        ${feld(`schliesstage.${i}.grund`, 'Grund', p.grund)}
        ${knopf(`pause-weg:${i}`, 'Entfernen', 'editor-knopf-gefahr')}
      </div>
    </div>`).join('');

  const kuechen = studio.kuechen.map((k, i) => `
    <div class="editor-gruppe">
      <strong>${esc(k.titel)}</strong>
      <div class="editor-zeile">
        <label class="editor-feld"><span>Stil</span>
          <select data-pfad="kuechen.${i}.stil">
            ${Object.entries(STILE).map(([wert, text]) => `<option value="${wert}" ${k.stil === wert ? 'selected' : ''}>${text}</option>`).join('')}
          </select>
        </label>
        ${feld(`kuechen.${i}.front`, 'Front', k.front, { typ: 'color', klasse: 'editor-farbe' })}
        ${feld(`kuechen.${i}.arbeitsplatte`, 'Arbeitsplatte', k.arbeitsplatte, { typ: 'color', klasse: 'editor-farbe' })}
        ${feld(`kuechen.${i}.wand`, 'Wand', k.wand, { typ: 'color', klasse: 'editor-farbe' })}
      </div>
      ${feld(`kuechen.${i}.alt`, 'Alt-Text (Bildbeschreibung)', k.alt)}
    </div>`).join('');

  const orte = studio.nachbarorte.map((o, i) => `
    <div class="editor-gruppe">
      <div class="editor-zeile">
        ${feld(`nachbarorte.${i}.name`, 'Ort', o.name)}
        ${feld(`nachbarorte.${i}.km`, 'Entfernung (km)', o.km, { typ: 'number', extra: 'min="0" step="1"', klasse: 'editor-schmal' })}
        ${knopf(`ort-weg:${i}`, 'Entfernen', 'editor-knopf-gefahr')}
      </div>
      ${feld(`nachbarorte.${i}.text`, 'Text für die Ortsseite (optional)', o.text ?? '')}
    </div>`).join('');

  return `
    <fieldset class="editor-block">
      <legend>Allgemein</legend>
      ${feld('seo.titel', 'Seitentitel', studio.seo.titel)}
      ${feld('hero.titel', 'Überschrift der Startseite', studio.hero.titel)}
      <div class="editor-zeile">
        ${feld('kontakt.telefon', 'Telefon', studio.kontakt.telefon)}
        ${feld('kontakt.email', 'E-Mail', studio.kontakt.email)}
      </div>
    </fieldset>
    <fieldset class="editor-block">
      <legend>Öffnungszeiten</legend>
      ${zeiten}
    </fieldset>
    <fieldset class="editor-block">
      <legend>Aktionen</legend>
      ${aktionen}
      ${knopf('aktion-neu', '+ Aktion hinzufügen')}
    </fieldset>
    <fieldset class="editor-block">
      <legend>Schließzeiträume</legend>
      ${pausen}
      ${knopf('pause-neu', '+ Schließzeitraum hinzufügen')}
    </fieldset>
    <fieldset class="editor-block">
      <legend>Küchen</legend>
      ${kuechen}
    </fieldset>
    <fieldset class="editor-block">
      <legend>Nachbarorte</legend>
      ${orte}
      ${knopf('ort-neu', '+ Ort hinzufügen')}
    </fieldset>`;
}
