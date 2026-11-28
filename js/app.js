// Einstiegspunkt: lädt die Studio-Daten, hält den Zustand (URL-Hash + Ansicht + simuliertes Datum),
// baut die Demo-Leiste und die Seitenpanels.
// Neues Studio anlegen: JSON-Datei in data/ ablegen und die ID hier eintragen.

import { esc, renderSeite, seitenAttribute } from './render.js';
import {
  isoDatum, parseDatum, tagPlusN, tageZwischen, aenderungen, zeitraumAllerStudios, naechsteAenderung, kurzDatum,
} from './zeit.js';
import { spurenHtml, tageImBereich } from './zeitstrahl.js';
import { zeigeMeldungen } from './meldungen.js';
import { sucheVorschauHtml } from './suche.js';
import { kuechenSVG } from './kitchen-art.js';
import { passeUeberschriftenAn, beobachteBreite } from './passend.js';
import { terminAuswahl, langesDatum } from './termin.js';
import { erzeugeJsonLd, setzeJsonLd } from './jsonld.js';
import { pruefe, STATUS_ZEICHEN } from './check.js';
import {
  editorHtml, wendeAn, aendereListe, benenneOrt, setzeTagGeoeffnet, bereichFuer, slugFuer,
} from './editor.js';

export const STUDIO_IDS = [
  'kuechenwerk-elbtal',
  'landhaus-moritzburg',
  'atelier-kochraum',
];

export const THEMES = {
  modern: 'Modern',
  landhaus: 'Landhaus',
  atelier: 'Atelier',
};

const ANSICHTEN = { desktop: 'Desktop', handy: 'Handy', alle: 'Alle Studios' };

const studios = new Map(); // Arbeitskopien: der Editor verändert diese, die Dateien in data/ bleiben unberührt
const originale = new Map(); // unveränderte Kopien zum Zurücksetzen
const PANELS = ['check', 'daten', 'editor', 'neu'];
const buehne = document.getElementById('buehne');
const website = document.getElementById('website');
const einzelRahmen = document.getElementById('geraet-einzeln');
const alleStudios = document.getElementById('alle-studios');
const leiste = document.getElementById('demo-leiste');
const panels = document.getElementById('demo-panels');

async function ladeStudio(id) {
  const antwort = await fetch(`data/${id}.json`);
  if (!antwort.ok) throw new Error(`Studio „${id}“ konnte nicht geladen werden.`);
  return antwort.json();
}

/** Echtes Datum (lokale Mitternacht). Zusammen mit minutenJetzt() die einzige Stelle, an der die Uhr gelesen wird. */
function echtesHeute() {
  const jetzt = new Date();
  return new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
}

/** Echte Uhrzeit als Minuten seit Mitternacht. */
function minutenJetzt() {
  const jetzt = new Date();
  return jetzt.getHours() * 60 + jetzt.getMinutes();
}

// Simuliertes Datum: bestimmt Aktionen, Öffnungsstatus und Schließtage. Die Uhrzeit bleibt echt.
let simuliertesDatum = echtesHeute();
let ansicht = 'desktop';
let typisch = false; // Ansicht „Typische Website“: dieselben Daten ohne Selbstpflege
let gerendertesDatum = simuliertesDatum; // Datum der zuletzt gezeigten Seite (für die Meldungen)
let strahlTimer = null; // läuft der Zeitraffer?
let offenesPanel = null; // 'check' | 'daten' | 'editor' | 'neu' | null
let editorStudioId = null; // für welches Studio ist das Editor-Formular gebaut?
const letztePunkte = new Map(); // Studio → Punkte des letzten Qualitäts-Checks (für die Meldung „7/9 → 8/9“)
const letzteMeldung = new Map(); // Bereich → Zeitpunkt, damit Meldungen nicht bei jedem Tastendruck erscheinen
const DATEN_TABS = ['studio', 'jsonld', 'suche'];
let datenTab = 'studio'; // 'studio' | 'jsonld' | 'suche'
const datenTexte = { studio: '', jsonld: '' };

/**
 * Hash „#/<studio>/<design>“ oder „#/<studio>/<design>/ort/<slug>“ → Zustand.
 * Unbekannte Werte (auch ein unbekannter Ort) fallen auf Standardwerte zurück.
 */
function leseHash() {
  const [studioId, theme, marker, slug] = location.hash.replace(/^#\/?/, '').split('/');
  const studio = studios.get(studioId) ?? studios.get(STUDIO_IDS[0]);
  const ort = marker === 'ort' ? studio.nachbarorte.find((o) => o.slug === slug) ?? null : null;
  return { studio, theme: theme in THEMES ? theme : studio.theme, ort };
}

function hashFuer(studioId, theme, ortSlug) {
  return `#/${studioId}/${theme}${ortSlug ? `/ort/${ortSlug}` : ''}`;
}

function deDatum(datum) {
  return `${String(datum.getDate()).padStart(2, '0')}.${String(datum.getMonth() + 1).padStart(2, '0')}.${datum.getFullYear()}`;
}

// ---------- Demo-Leiste ----------

// Der Browser-Speicher kann gesperrt sein (z. B. privates Fenster): dann erscheint der Hinweis eben jedes Mal.
const HINWEIS_SCHLUESSEL = 'kuechenstudio-hinweis-gesehen';

function hinweisGesehen() {
  try {
    return localStorage.getItem(HINWEIS_SCHLUESSEL) === '1';
  } catch {
    return false;
  }
}

function merkeHinweisGesehen() {
  try {
    localStorage.setItem(HINWEIS_SCHLUESSEL, '1');
  } catch {
    // ohne Speicher: egal
  }
}

function studioOptionen() {
  return [...studios.values()].map((st) => `<option value="${esc(st.id)}">${esc(st.name)}</option>`).join('');
}

function baueLeiste() {
  const optionen = (eintraege) => eintraege
    .map(([wert, text]) => `<option value="${esc(wert)}">${esc(text)}</option>`).join('');
  leiste.innerHTML = `
    <div class="leiste-innen">
      <span class="leiste-marke">Demo</span>
      <button type="button" class="leiste-knopf leiste-menue" id="leiste-menue" aria-expanded="false" aria-controls="leiste-felder">Steuerung</button>
      <div class="leiste-felder" id="leiste-felder" role="group" aria-label="Demo-Steuerung">
      <div class="leiste-gruppe" role="group" aria-label="Auswahl">
        <span class="leiste-gruppe-titel" aria-hidden="true">Auswahl</span>
        <label class="leiste-feld">Studio
          <select id="wahl-studio">${studioOptionen()}</select>
        </label>
        <label class="leiste-feld">Design
          <select id="wahl-theme">${optionen(Object.entries(THEMES))}</select>
        </label>
        <fieldset class="ansicht-wahl">
          <legend>Ansicht</legend>
          <span class="ansicht-knoepfe">
            ${Object.entries(ANSICHTEN).map(([schluessel, text]) =>
              `<button type="button" data-ansicht="${schluessel}" aria-pressed="false">${text}</button>`).join('')}
          </span>
        </fieldset>
        <button type="button" class="leiste-knopf" id="wahl-typisch" aria-pressed="false">Vergleich: typische Website</button>
      </div>
      <div class="leiste-gruppe leiste-gruppe-zeit" role="group" aria-label="Zeit">
        <span class="leiste-gruppe-titel" aria-hidden="true">Zeit</span>
        <label class="leiste-feld" for="wahl-datum">Datum</label>
        <input type="date" id="wahl-datum" title="Datum simulieren" required>
        <button type="button" class="leiste-knopf" id="wahl-heute">Heute</button>
        <button type="button" class="leiste-knopf leiste-knopf-haupt" id="strahl-play" aria-pressed="false">▶ Zeitraffer</button>
        <div class="leiste-strahl">
          <div class="strahl">
            <span class="strahl-spuren" id="strahl-spuren" aria-hidden="true"></span>
            <input type="range" id="strahl-regler" min="0" max="0" step="1" value="0" aria-label="Datum auf dem Zeitstrahl">
          </div>
          <output class="strahl-datum" id="strahl-datum" for="strahl-regler"></output>
        </div>
        <output class="strahl-naechste" id="strahl-naechste" aria-live="off"></output>
      </div>
      <div class="leiste-gruppe" role="group" aria-label="Werkzeuge">
        <span class="leiste-gruppe-titel" aria-hidden="true">Werkzeuge</span>
        <button type="button" class="leiste-knopf" id="wahl-check" aria-expanded="false" aria-controls="panel-check">
          Qualitäts-Check <span class="badge" id="check-badge"></span>
        </button>
        <button type="button" class="leiste-knopf" id="wahl-daten" aria-expanded="false" aria-controls="panel-daten">
          Daten (JSON)
        </button>
        <button type="button" class="leiste-knopf" id="wahl-editor" aria-expanded="false" aria-controls="panel-editor">
          Live-Editor
        </button>
        <button type="button" class="leiste-knopf" id="wahl-neu" aria-expanded="false" aria-controls="panel-neu">
          + Studio
        </button>
      </div>
      </div>
    </div>
    <div class="leiste-hinweis" id="leiste-hinweis" role="note" hidden>
      <p>Jede Website hier entsteht aus <strong>einer JSON-Datei und einem Design-Layer</strong>.
        Spul das Datum vor und sieh zu, wie sich die Seite selbst pflegt.</p>
      <button type="button" id="hinweis-zu">Verstanden</button>
    </div>`;
  if (!hinweisGesehen()) leiste.querySelector('#leiste-hinweis').hidden = false;

  panels.innerHTML = `
    <aside class="panel" id="panel-check" aria-labelledby="panel-check-titel" hidden>
      <div class="panel-kopf">
        <h2 id="panel-check-titel">Qualitäts-Check</h2>
        <button type="button" class="panel-zu" data-panel-zu="check" aria-label="Qualitäts-Check schließen">×</button>
      </div>
      <p class="panel-unter" id="panel-check-unter"></p>
      <ul class="check-liste" id="check-liste"></ul>
    </aside>
    <aside class="panel panel-breit" id="panel-daten" aria-labelledby="panel-daten-titel" hidden>
      <div class="panel-kopf">
        <h2 id="panel-daten-titel">Daten ansehen</h2>
        <button type="button" class="panel-zu" data-panel-zu="daten" aria-label="Daten schließen">×</button>
      </div>
      <p class="panel-unter"><strong>Diese eine Datei ist die ganze Website.</strong> Alles, was Sie sehen, wird daraus erzeugt.</p>
      <div class="tabs" role="tablist" aria-label="Datenformat">
        <button type="button" role="tab" id="tab-studio" data-tab="studio" aria-selected="true" aria-controls="daten-inhalt">Studio-JSON</button>
        <button type="button" role="tab" id="tab-jsonld" data-tab="jsonld" aria-selected="false" aria-controls="daten-inhalt" tabindex="-1">JSON-LD (schema.org)</button>
        <button type="button" role="tab" id="tab-suche" data-tab="suche" aria-selected="false" aria-controls="daten-suche" tabindex="-1">So sieht die Suche dich</button>
      </div>
      <div class="daten-zeile">
        <span id="daten-datei"></span>
        <button type="button" class="panel-kopieren" id="daten-kopieren">Kopieren</button>
      </div>
      <pre class="daten-code" id="daten-inhalt" role="tabpanel" tabindex="0"></pre>
      <div class="suche" id="daten-suche" role="tabpanel" aria-labelledby="tab-suche" tabindex="0" hidden></div>
    </aside>
    <aside class="panel panel-breit" id="panel-editor" aria-labelledby="panel-editor-titel" hidden>
      <div class="panel-kopf">
        <h2 id="panel-editor-titel">Live-Editor</h2>
        <button type="button" class="panel-zu" data-panel-zu="editor" aria-label="Editor schließen">×</button>
      </div>
      <p class="panel-unter">Ändere ein Feld und sieh sofort, was auf der Website, im Qualitäts-Check und in den
        schema.org-Daten passiert. Nichts wird gespeichert, „Zurücksetzen“ stellt das Original wieder her.</p>
      <div class="editor-aktionen">
        <button type="button" class="panel-kopieren" id="editor-kopieren">JSON kopieren</button>
        <button type="button" class="panel-kopieren" id="editor-download">JSON herunterladen</button>
        <button type="button" class="panel-kopieren" id="editor-reset">Zurücksetzen</button>
      </div>
      <div id="editor-inhalt"></div>
    </aside>
    <aside class="panel" id="panel-neu" aria-labelledby="panel-neu-titel" hidden>
      <div class="panel-kopf">
        <h2 id="panel-neu-titel">Neues Studio</h2>
        <button type="button" class="panel-zu" data-panel-zu="neu" aria-label="Schließen">×</button>
      </div>
      <p class="panel-unter">Ein neuer Kunde ist nur eine neue JSON-Datei. Hier entsteht sie aus einer Vorlage in
        Sekunden. Der Qualitäts-Check zeigt danach, was noch fehlt, und der Live-Editor baut es aus.</p>
      <form id="neu-formular" class="neu-formular">
        <label class="editor-feld"><span>Name des Studios</span><input type="text" name="name" required placeholder="z. B. Küchen am Markt" autocomplete="off"></label>
        <label class="editor-feld"><span>Ort</span><input type="text" name="ort" required placeholder="z. B. Pirna" autocomplete="off"></label>
        <label class="editor-feld"><span>Design</span>
          <select name="theme">${Object.entries(THEMES).map(([wert, text]) => `<option value="${wert}">${text}</option>`).join('')}</select></label>
        <label class="editor-feld editor-farbe"><span>Akzentfarbe</span><input type="color" name="akzent" value="#4f7a63"></label>
        <button type="submit" class="editor-knopf">Studio erzeugen</button>
      </form>
    </aside>`;
}

function schaltePanel(name, offen) {
  const neu = offen ?? offenesPanel !== name;
  for (const n of PANELS) {
    const istOffen = neu && n === name;
    document.getElementById(`panel-${n}`).hidden = !istOffen;
    leiste.querySelector(`#wahl-${n}`).setAttribute('aria-expanded', String(istOffen));
  }
  offenesPanel = neu ? name : null;
  if (neu) panels.querySelector(`[data-panel-zu="${name}"]`).focus();
  else leiste.querySelector(`#wahl-${name}`).focus();
}

function waehleDatenTab(tab) {
  datenTab = tab;
  for (const knopf of panels.querySelectorAll('[role="tab"]')) {
    const aktiv = knopf.dataset.tab === tab;
    knopf.setAttribute('aria-selected', String(aktiv));
    knopf.tabIndex = aktiv ? 0 : -1;
  }
  const { studio } = leseHash();
  const istSuche = tab === 'suche';
  const code = document.getElementById('daten-inhalt');
  const suche = document.getElementById('daten-suche');
  code.hidden = istSuche;
  suche.hidden = !istSuche;
  panels.querySelector('.daten-zeile').hidden = istSuche;
  if (istSuche) {
    suche.innerHTML = sucheVorschauHtml(studio, simuliertesDatum, minutenJetzt());
    return;
  }
  code.setAttribute('aria-labelledby', `tab-${tab}`);
  code.textContent = datenTexte[tab];
  document.getElementById('daten-datei').textContent = tab === 'studio'
    ? `data/${studio.id}.json`
    : 'automatisch erzeugt, steht im <head>';
}

async function kopiere(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Ersatzweg, falls die Zwischenablage-API gesperrt ist (z. B. in eingebetteten Fenstern)
    const feld = document.createElement('textarea');
    feld.value = text;
    feld.style.position = 'fixed';
    feld.style.opacity = '0';
    document.body.append(feld);
    feld.select();
    const ok = document.execCommand('copy');
    feld.remove();
    return ok;
  }
}

/** Qualitäts-Check für das aktuelle Studio und Datum: Badge in der Leiste und Inhalt des Panels. */
function aktualisiereCheck(studio) {
  const { ergebnisse, punkte, gesamt, schlechtester } = pruefe(studio, simuliertesDatum);
  const badge = leiste.querySelector('#check-badge');
  letztePunkte.set(studio.id, punkte);
  badge.textContent = `${punkte}/${gesamt}`;
  badge.className = `badge badge-${schlechtester}`;
  document.getElementById('panel-check-unter').textContent =
    `${studio.name} · ${punkte} von ${gesamt} bestanden · Stand ${deDatum(simuliertesDatum)}`;
  document.getElementById('check-liste').innerHTML = ergebnisse.map((e) => `
    <li class="check check-${e.status}">
      <span class="check-zeichen" role="img" aria-label="${STATUS_ZEICHEN[e.status].name}">${STATUS_ZEICHEN[e.status].zeichen}</span>
      <div>
        <strong>${esc(e.titel)}</strong><p>${esc(e.text)}</p>
        ${e.ziel && (e.status === 'warnung' || e.status === 'fehler')
          ? `<button type="button" class="check-beheben" data-ziel="${esc(e.ziel)}">Im Editor beheben</button>` : ''}
      </div>
    </li>`).join('');
}

function aktualisiereDaten(studio) {
  datenTexte.studio = JSON.stringify(studio, null, 2);
  datenTexte.jsonld = JSON.stringify(erzeugeJsonLd(studio), null, 2);
  waehleDatenTab(datenTab);
}

// ---------- Live-Editor ----------

function baueEditorInhalt(studio) {
  editorStudioId = studio.id;
  document.getElementById('editor-inhalt').innerHTML = editorHtml(studio);
}

/** Lässt die betroffenen Abschnitte der Website kurz aufblitzen. */
function blitze(abschnitte, studio) {
  for (const suffix of abschnitte) {
    const el = document.getElementById(`${studio.id}-${suffix}`);
    if (!el) continue;
    el.classList.remove('bereich-blitz');
    void el.offsetWidth; // Animation neu starten
    el.classList.add('bereich-blitz');
    setTimeout(() => el.classList.remove('bereich-blitz'), 1400);
  }
}

/** Nach einer Änderung im Editor: Seite neu zeigen, Bereiche markieren, Meldung ausgeben. */
function nachAenderung(pfad, studio) {
  const vorher = letztePunkte.get(studio.id) ?? pruefe(studio, simuliertesDatum).punkte;
  zeige('datum');
  const bereich = bereichFuer(pfad);
  blitze(bereich.abschnitte, studio);
  const meldungen = [];
  const jetzt = Date.now();
  if (jetzt - (letzteMeldung.get(bereich.name) ?? 0) > 3000) {
    meldungen.push({ icon: '✏️', text: `${bereich.name} geändert: Website, Qualitäts-Check und schema.org-Daten sind sofort aktuell.` });
  }
  letzteMeldung.set(bereich.name, jetzt);
  const ergebnis = pruefe(studio, simuliertesDatum);
  if (ergebnis.punkte !== vorher) {
    meldungen.push({ icon: ergebnis.punkte > vorher ? '📈' : '📉', text: `Qualitäts-Check: ${vorher}/${ergebnis.gesamt} → ${ergebnis.punkte}/${ergebnis.gesamt}` });
  }
  zeigeMeldungen(meldungen);
}

function editorFeldGeaendert(el) {
  const { studio } = leseHash();
  const pfad = el.dataset.pfad;
  let ergebnis;
  if (/^nachbarorte\.\d+\.name$/.test(pfad)) {
    benenneOrt(studio, Number(pfad.split('.')[1]), el.value);
    ergebnis = { ok: true, meldung: '' };
  } else {
    ergebnis = wendeAn(studio, pfad, el.value);
  }
  const fehlerSchluessel = pfad.replace(/^(oeffnungszeiten\.\w+)\.0$/, '$1.1');
  const fehlerFeld = panels.querySelector(`[data-fehler="${fehlerSchluessel}"]`);
  if (fehlerFeld) fehlerFeld.textContent = ergebnis.meldung;
  el.setAttribute('aria-invalid', String(!ergebnis.ok));
  if (ergebnis.ok) nachAenderung(pfad, studio);
}

function editorKlick(knopf) {
  const { studio } = leseHash();
  const aktion = knopf.dataset.aktion;
  const fokus = aendereListe(studio, aktion, simuliertesDatum);
  baueEditorInhalt(studio);
  const ziel = panels.querySelector(`[data-pfad="${fokus}"], [data-aktion="${fokus}"]`);
  ziel?.focus();
  nachAenderung(aktion.startsWith('aktion') ? 'aktionen' : aktion.startsWith('pause') ? 'schliesstage' : 'nachbarorte', studio);
}

function springeZumFeld(ziel) {
  schaltePanel('editor', true);
  const el = panels.querySelector(`[data-pfad="${CSS.escape(ziel)}"], [data-aktion="${CSS.escape(ziel)}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.focus();
  const markiert = el.closest('.editor-feld') ?? el;
  markiert.classList.add('feld-blitz');
  setTimeout(() => markiert.classList.remove('feld-blitz'), 1800);
}

function herunterladen(text, dateiname) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = dateiname;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function zeigeInLeiste({ studio, theme }) {
  if (editorStudioId !== studio.id) baueEditorInhalt(studio);
  aktualisiereCheck(studio);
  aktualisiereDaten(studio);
  const wahlStudio = leiste.querySelector('#wahl-studio');
  const wahlTheme = leiste.querySelector('#wahl-theme');
  wahlStudio.value = studio.id;
  wahlTheme.value = theme;
  // „Alle Studios“ zeigt jedes Studio in seinem Standard-Design: die Auswahl gilt dort nicht
  wahlStudio.disabled = ansicht === 'alle';
  wahlTheme.disabled = ansicht === 'alle';
  const feld = leiste.querySelector('#wahl-datum');
  feld.value = isoDatum(simuliertesDatum);
  feld.classList.toggle('simuliert', isoDatum(simuliertesDatum) !== isoDatum(echtesHeute()));
  for (const knopf of leiste.querySelectorAll('[data-ansicht]')) {
    knopf.setAttribute('aria-pressed', String(knopf.dataset.ansicht === ansicht));
  }
  leiste.querySelector('#wahl-typisch').setAttribute('aria-pressed', String(typisch));
  aktualisiereStrahl(studio);
  misseLeistenhoehe();
}

// ---------- Zeitstrahl ----------

function strahlBereich() {
  return zeitraumAllerStudios([...studios.values()], echtesHeute());
}

function aktualisiereStrahl(studio) {
  const bereich = strahlBereich();
  const sichtbar = ansicht === 'alle' ? [...studios.values()] : [studio];
  const html = spurenHtml(sichtbar, bereich, echtesHeute());
  const spuren = leiste.querySelector('#strahl-spuren');
  if (spuren.dataset.html !== html) {
    spuren.innerHTML = html;
    spuren.dataset.html = html;
    spuren.style.setProperty('--spuren', String(spuren.querySelectorAll('.strahl-spur').length));
  }
  const regler = leiste.querySelector('#strahl-regler');
  const letzter = tageImBereich(bereich) - 1;
  regler.max = String(letzter);
  regler.value = String(Math.min(letzter, Math.max(0, tageZwischen(bereich.start, simuliertesDatum))));
  regler.setAttribute('aria-valuetext', deDatum(simuliertesDatum));
  leiste.querySelector('#strahl-datum').textContent = deDatum(simuliertesDatum);
  const naechste = naechsteAenderung(sichtbar, simuliertesDatum);
  const zeile = naechste
    ? `Nächste Änderung: ${kurzDatum(naechste.datum)} · ${ansicht === 'alle' ? `${naechste.studio.name}: ` : ''}${naechste.text}`
    : 'Keine weiteren Änderungen';
  const ausgabe = leiste.querySelector('#strahl-naechste');
  if (ausgabe.textContent !== zeile) ausgabe.textContent = zeile;
}

function stoppeZeitraffer() {
  if (!strahlTimer) return;
  clearInterval(strahlTimer);
  strahlTimer = null;
  const knopf = leiste.querySelector('#strahl-play');
  knopf.textContent = '▶ Zeitraffer';
  knopf.setAttribute('aria-pressed', 'false');
}

function starteZeitraffer() {
  const bereich = strahlBereich();
  const tage = tageImBereich(bereich);
  let i = tageZwischen(bereich.start, simuliertesDatum);
  if (i >= tage - 1 || i < 0) i = 0;
  const knopf = leiste.querySelector('#strahl-play');
  knopf.textContent = '⏸ Stopp';
  knopf.setAttribute('aria-pressed', 'true');
  strahlTimer = setInterval(() => {
    i += 1;
    if (i >= tage) {
      stoppeZeitraffer();
      return;
    }
    setzeDatum(tagPlusN(bereich.start, i));
  }, 70);
}

/** Setzt das simulierte Datum und zeigt die Seite ohne Ausblenden, nur mit Animation der Änderungen. */
function setzeDatum(datum) {
  simuliertesDatum = datum;
  // Nach der ersten Datumsänderung hat der Besucher den Hinweis umgesetzt: ausblenden
  const hinweis = leiste.querySelector('#leiste-hinweis');
  if (hinweis && !hinweis.hidden) {
    hinweis.hidden = true;
    merkeHinweisGesehen();
  }
  zeige('datum');
}

// ---------- Seite rendern ----------

function setzeAttribute(element, studio, theme) {
  const attribute = seitenAttribute(studio, theme);
  element.setAttribute('data-theme', attribute['data-theme']);
  element.setAttribute('style', attribute.style);
}

let letzteSeite = null; // „ansicht/studio/ort“ – bei einem Wechsel springt die Seite nach oben
let wechselNr = 0;

const wurzeln = () => (ansicht === 'alle' ? [...alleStudios.querySelectorAll('.website')] : [website]);

/** Merkt sich Aktionskarten und Status, damit nach dem Rendern nur die Unterschiede animiert werden. */
function schnappschuss() {
  return wurzeln().map((w) => ({
    aktionen: [...w.querySelectorAll('.aktion[data-aktion]')].map((el) => ({ id: el.dataset.aktion, html: el.outerHTML })),
    status: w.querySelector('.status')?.textContent,
    hinweis: Boolean(w.querySelector('.schliess-hinweis')),
  }));
}

/** Neue Karten gleiten ein, entfernte blenden als „Geister“ aus, geänderter Status blitzt kurz auf. */
function animiere(vorher) {
  wurzeln().forEach((w, i) => {
    const v = vorher[i];
    if (!v) return;
    const alt = new Set(v.aktionen.map((a) => a.id));
    const karten = [...w.querySelectorAll('.aktion[data-aktion]')];
    const jetzt = new Set(karten.map((el) => el.dataset.aktion));
    for (const el of karten) if (!alt.has(el.dataset.aktion)) el.classList.add('aktion-neu');
    const entfernt = v.aktionen.filter((a) => !jetzt.has(a.id));
    if (entfernt.length) {
      const geister = entfernt.map((a) => {
        const vorlage = document.createElement('template');
        vorlage.innerHTML = a.html;
        const geist = vorlage.content.firstElementChild;
        geist.removeAttribute('data-aktion');
        geist.setAttribute('aria-hidden', 'true');
        geist.classList.remove('aktion-neu');
        geist.classList.add('aktion-geht');
        geist.addEventListener('animationend', () => geist.remove());
        setTimeout(() => geist.remove(), 900); // Sicherheitsnetz, falls das Ereignis ausbleibt
        return geist;
      });
      const raster = w.querySelector('.raster-aktionen');
      if (raster) {
        raster.prepend(...geister);
      } else {
        // Der ganze Aktionen-Block verschwindet: für die Animation kurz als Geister-Abschnitt zeigen
        const abschnitt = document.createElement('section');
        abschnitt.className = 'sektion aktionen-geist';
        abschnitt.setAttribute('aria-hidden', 'true');
        abschnitt.innerHTML = '<div class="inhalt"><div class="raster raster-aktionen"></div></div>';
        abschnitt.querySelector('.raster').append(...geister);
        w.querySelector('.hero')?.after(abschnitt);
        setTimeout(() => abschnitt.remove(), 900);
      }
    }
    const status = w.querySelector('.status');
    if (status && v.status && status.textContent !== v.status) status.classList.add('status-neu');
    const hinweis = w.querySelector('.schliess-hinweis');
    if (hinweis && !v.hinweis) hinweis.classList.add('aktion-neu');
  });
}

function rendern({ studio, theme, ort: gewaehlterOrt }) {
  const ort = typisch ? null : gewaehlterOrt; // eine typische Website hat keine Ortsseiten
  const optionen = { heute: simuliertesDatum, minuten: minutenJetzt(), typisch };
  buehne.className = `ansicht-${ansicht}`;
  einzelRahmen.hidden = ansicht === 'alle';
  alleStudios.hidden = ansicht !== 'alle';

  if (ansicht === 'alle') {
    alleStudios.innerHTML = [...studios.values()].map((s) => {
      const attribute = seitenAttribute(s, s.theme);
      return `
      <figure class="spalte">
        <div class="geraet">
          <div class="website" role="region" aria-label="${esc(s.name)}" data-theme="${s.theme}" style="${attribute.style}">
            ${renderSeite(s, { ...optionen, theme: s.theme })}
          </div>
        </div>
        <figcaption>${esc(s.name)} · ${THEMES[s.theme]}</figcaption>
      </figure>`;
    }).join('');
    setzeAlleZoom();
    website.innerHTML = ''; // sonst gäbe es dieselben IDs doppelt
    document.title = 'Alle Studios | Küchenstudio-Website-System';
  } else {
    alleStudios.innerHTML = '';
    setzeAttribute(website, studio, theme);
    website.innerHTML = renderSeite(studio, { ...optionen, theme, ort });
    document.title = typisch ? 'Startseite' : ort ? `Küchenstudio für ${ort.name} | ${studio.name}` : studio.seo.titel;
    const beschreibung = ort
      ? `Küchenstudio für ${ort.name}: ${studio.name} in ${studio.kontakt.ort}, nur ${ort.km} km entfernt. ${studio.seo.beschreibung}`
      : studio.seo.beschreibung;
    document.querySelector('meta[name="description"]')?.setAttribute('content', beschreibung);
  }
  setzeJsonLd(erzeugeJsonLd(studio));
  for (const w of wurzeln()) {
    passeUeberschriftenAn(w);
    beobachteBreite(w);
  }

  const seite = `${ansicht}/${studio.id}/${ort?.slug ?? ''}`;
  if (letzteSeite && letzteSeite !== seite) {
    window.scrollTo(0, 0);
    website.scrollTop = 0;
  }
  letzteSeite = seite;
  gerendertesDatum = simuliertesDatum;
}

/**
 * @param {'seite'|'datum'} art  „seite“: Studio, Design oder Ansicht wechseln (weich ein- und ausblenden).
 *   „datum“: nur das Datum ändert sich, die Seite bleibt stehen und zeigt, was sich ändert.
 */
async function zeige(art = 'seite') {
  const nr = ++wechselNr;
  const zustand = leseHash();
  const { studio, theme, ort } = zustand;

  // URL vereinheitlichen, damit geteilte Links immer vollständig sind
  const hash = hashFuer(studio.id, theme, ort?.slug);
  if (location.hash !== hash) history.replaceState(null, '', hash);
  zeigeInLeiste(zustand);

  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (art === 'datum' && letzteSeite !== null) {
    const vorher = schnappschuss();
    const sichtbar = ansicht === 'alle' ? [...studios.values()] : [studio];
    const meldungen = sichtbar.flatMap((s) => aenderungen(s, gerendertesDatum, simuliertesDatum)
      .map((m) => (ansicht === 'alle' ? { ...m, text: `${s.name}: ${m.text}` } : m)));
    rendern(zustand);
    if (!ruhig) animiere(vorher);
    zeigeMeldungen(meldungen);
    return;
  }

  if (letzteSeite === null || ruhig) {
    rendern(zustand);
    return;
  }

  // weicher Übergang: kurz ausblenden, neu rendern, wieder einblenden
  buehne.classList.add('blendet');
  await new Promise((fertig) => setTimeout(fertig, 150));
  if (nr !== wechselNr) return; // ein neuerer Wechsel hat übernommen
  rendern(zustand);
  requestAnimationFrame(() => buehne.classList.remove('blendet'));
}

// ---------- Ereignisse ----------

leiste.addEventListener('change', (ereignis) => {
  if (ereignis.target.id === 'wahl-datum') {
    if (!ereignis.target.value) return; // Feld geleert: altes Datum behalten
    stoppeZeitraffer();
    setzeDatum(parseDatum(ereignis.target.value));
    return;
  }
  // Studio und Design wechseln unabhängig voneinander; der Hash ist der einzige Zustand der Auswahl.
  // Die Ortsseite bleibt erhalten, falls es den Ort auch beim neuen Studio gibt
  // (sonst fällt leseHash auf die Startseite zurück).
  location.hash = hashFuer(
    leiste.querySelector('#wahl-studio').value,
    leiste.querySelector('#wahl-theme').value,
    leseHash().ort?.slug,
  );
});

// Regler: während des Ziehens laufend aktualisieren
leiste.addEventListener('input', (ereignis) => {
  if (ereignis.target.id !== 'strahl-regler') return;
  stoppeZeitraffer();
  setzeDatum(tagPlusN(strahlBereich().start, Number(ereignis.target.value)));
});

leiste.addEventListener('click', (ereignis) => {
  if (ereignis.target.closest('#hinweis-zu')) {
    leiste.querySelector('#leiste-hinweis').hidden = true;
    merkeHinweisGesehen();
    misseLeistenhoehe();
    return;
  }
  const menue = ereignis.target.closest('#leiste-menue');
  if (menue) {
    const offen = menue.getAttribute('aria-expanded') !== 'true';
    menue.setAttribute('aria-expanded', String(offen));
    leiste.querySelector('#leiste-felder').classList.toggle('offen', offen);
    misseLeistenhoehe();
    return;
  }
  const ansichtKnopf = ereignis.target.closest('[data-ansicht]');
  if (ansichtKnopf) {
    ansicht = ansichtKnopf.dataset.ansicht;
    zeige();
  } else if (ereignis.target.closest('#wahl-heute')) {
    stoppeZeitraffer();
    setzeDatum(echtesHeute());
  } else if (ereignis.target.closest('#strahl-play')) {
    if (strahlTimer) stoppeZeitraffer();
    else starteZeitraffer();
  } else if (ereignis.target.closest('#wahl-check')) {
    schaltePanel('check');
  } else if (ereignis.target.closest('#wahl-daten')) {
    schaltePanel('daten');
  } else if (ereignis.target.closest('#wahl-editor')) {
    schaltePanel('editor');
  } else if (ereignis.target.closest('#wahl-neu')) {
    schaltePanel('neu');
  } else if (ereignis.target.closest('#wahl-typisch')) {
    typisch = !typisch;
    zeige();
  }
});

// Editor: Eingaben, Haken und Knöpfe
panels.addEventListener('input', (ereignis) => {
  const el = ereignis.target;
  if (el.closest('#editor-inhalt') && el.dataset.pfad) editorFeldGeaendert(el);
});

panels.addEventListener('change', (ereignis) => {
  const el = ereignis.target;
  if (!el.closest('#editor-inhalt') || !el.dataset.tag) return;
  const { studio } = leseHash();
  setzeTagGeoeffnet(studio, el.dataset.tag, el.checked);
  baueEditorInhalt(studio);
  panels.querySelector(`[data-tag="${el.dataset.tag}"]`)?.focus();
  nachAenderung('oeffnungszeiten', studio);
});

panels.addEventListener('click', async (ereignis) => {
  const zu = ereignis.target.closest('[data-panel-zu]');
  if (zu) {
    schaltePanel(zu.dataset.panelZu, false);
    return;
  }
  const beheben = ereignis.target.closest('.check-beheben');
  if (beheben) {
    springeZumFeld(beheben.dataset.ziel);
    return;
  }
  const editorKnopf = ereignis.target.closest('#editor-inhalt [data-aktion]');
  if (editorKnopf) {
    editorKlick(editorKnopf);
    return;
  }
  const { studio: aktuell } = leseHash();
  if (ereignis.target.closest('#editor-kopieren')) {
    const knopf = ereignis.target.closest('#editor-kopieren');
    const ok = await kopiere(JSON.stringify(aktuell, null, 2));
    knopf.textContent = ok ? 'Kopiert ✓' : 'Nicht möglich';
    setTimeout(() => { knopf.textContent = 'JSON kopieren'; }, 1800);
    return;
  }
  if (ereignis.target.closest('#editor-download')) {
    herunterladen(JSON.stringify(aktuell, null, 2), `${aktuell.id}.json`);
    return;
  }
  if (ereignis.target.closest('#editor-reset')) {
    studios.set(aktuell.id, structuredClone(originale.get(aktuell.id)));
    const frisch = studios.get(aktuell.id);
    baueEditorInhalt(frisch);
    zeige('datum');
    zeigeMeldungen([{ icon: '↩️', text: `${frisch.name}: Originaldaten wiederhergestellt.` }]);
    return;
  }
  const tab = ereignis.target.closest('[data-tab]');
  if (tab) {
    waehleDatenTab(tab.dataset.tab);
    return;
  }
  const kopieren = ereignis.target.closest('#daten-kopieren');
  if (kopieren) {
    const ok = await kopiere(datenTexte[datenTab]);
    kopieren.textContent = ok ? 'Kopiert ✓' : 'Nicht möglich';
    setTimeout(() => { kopieren.textContent = 'Kopieren'; }, 1800);
  }
});

// Tabs per Pfeiltasten wechseln (Standardverhalten für Tab-Leisten)
panels.addEventListener('keydown', (ereignis) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(ereignis.key) || !ereignis.target.matches('[role="tab"]')) return;
  const schritt = ereignis.key === 'ArrowRight' ? 1 : -1;
  const neu = DATEN_TABS[(DATEN_TABS.indexOf(datenTab) + schritt + DATEN_TABS.length) % DATEN_TABS.length];
  waehleDatenTab(neu);
  panels.querySelector(`#tab-${neu}`).focus();
});

document.addEventListener('keydown', (ereignis) => {
  if (ereignis.key === 'Escape' && offenesPanel) schaltePanel(offenesPanel, false);
});

// Navigation innerhalb der Seite: scrollt zum Abschnitt, ohne den Hash (= Zustand) zu ändern.
buehne.addEventListener('click', (ereignis) => {
  const link = ereignis.target.closest('[data-scroll]');
  if (link) {
    ereignis.preventDefault();
    const ziel = document.getElementById(link.dataset.scroll);
    if (!ziel) return;
    const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behaelter = ziel.closest('.website');
    const scrollt = getComputedStyle(behaelter).overflowY === 'auto';
    if (scrollt) {
      // Handy-Rahmen: nur im Rahmen scrollen, nicht die ganze Seite
      const oben = ziel.getBoundingClientRect().top - behaelter.getBoundingClientRect().top + behaelter.scrollTop;
      behaelter.scrollTo({ top: oben, behavior: ruhig ? 'auto' : 'smooth' });
    } else {
      ziel.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
    }
    ziel.focus({ preventScroll: true });
    return;
  }
  // „Alle Studios“ ist eine reine Vorschau: Links auf andere Seiten sind dort ohne Wirkung
  if (ansicht === 'alle' && ereignis.target.closest('a[href^="#/"]')) ereignis.preventDefault();
});

// ---------- Neues Studio ----------

function erzeugeStudio({ name, ort, theme, akzent }) {
  const vorlage = structuredClone(originale.get('kuechenwerk-elbtal') ?? [...originale.values()][0]);
  const id = slugFuer(name, [...studios.keys()]);
  Object.assign(vorlage, { id, name, theme, akzent });
  vorlage.kontakt = {
    strasse: 'Musterstraße 1', plz: '00000', ort, telefon: '0123 4567000', email: `info@${id}.example`,
  };
  vorlage.seo = {
    titel: `Küchenstudio in ${ort} | ${name}`,
    beschreibung: `Ihr Küchenstudio in ${ort}: Persönliche Planung, eigene Montage und Service nach dem Einbau. Jetzt Beratungstermin vereinbaren.`,
  };
  vorlage.hero.titel = `Ihre neue Küche. Geplant in ${ort}, gebaut für Ihren Alltag.`;
  // Bewusst leer: Der Qualitäts-Check zeigt, was ein neues Studio noch braucht
  vorlage.nachbarorte = [];
  vorlage.stimmen = [];
  vorlage.team = [{ name: 'Name der Inhaberin oder des Inhabers', rolle: 'Inhaberin oder Inhaber', seit: 2020 }];
  studios.set(id, vorlage);
  originale.set(id, structuredClone(vorlage));
  return vorlage;
}

panels.addEventListener('submit', (ereignis) => {
  if (ereignis.target.id !== 'neu-formular') return;
  ereignis.preventDefault();
  const daten = new FormData(ereignis.target);
  const neu = erzeugeStudio({
    name: String(daten.get('name')).trim(),
    ort: String(daten.get('ort')).trim(),
    theme: String(daten.get('theme')),
    akzent: String(daten.get('akzent')),
  });
  leiste.querySelector('#wahl-studio').innerHTML = studioOptionen();
  ereignis.target.reset();
  location.hash = hashFuer(neu.id, neu.theme);
  schaltePanel('check', true);
  zeigeMeldungen([{ icon: '🆕', text: `${neu.name} ist angelegt: eine neue JSON-Datei, fertig. Der Qualitäts-Check zeigt, was noch fehlt.` }]);
});

// ---------- Konfigurator im Hero und Ansicht „Typische Website“ ----------

buehne.addEventListener('input', (ereignis) => {
  const eingabe = ereignis.target.closest('.konfig input[data-farbe]');
  if (!eingabe) return;
  const konfig = eingabe.closest('.konfig');
  const studio = studios.get(konfig.dataset.studio);
  const index = studio.kuechen.findIndex((k) => k.id === konfig.dataset.kueche);
  const kueche = studio.kuechen[index];
  kueche[eingabe.dataset.farbe] = eingabe.value;
  // Nur die Bilder neu zeichnen, damit der Farbwähler nicht verschwindet
  const wurzel = eingabe.closest('.website');
  const heroBild = wurzel.querySelector('.hero-bild > svg');
  if (heroBild) heroBild.outerHTML = kuechenSVG(kueche);
  const galerieBild = wurzel.querySelector(`.kueche[data-kueche="${CSS.escape(kueche.id)}"] .kueche-bild`);
  if (galerieBild) galerieBild.innerHTML = kuechenSVG(kueche);
  const editorFeld = panels.querySelector(`[data-pfad="kuechen.${index}.${eingabe.dataset.farbe}"]`);
  if (editorFeld) editorFeld.value = eingabe.value;
  aktualisiereDaten(studio);
});

buehne.addEventListener('click', (ereignis) => {
  if (!ereignis.target.closest('[data-typisch-aus]')) return;
  typisch = false;
  zeige();
});

// ---------- Terminanfrage (nur Demo) ----------

// Wunschtag geändert: passende Uhrzeiten und Hinweise (Ruhetag, Betriebsferien) neu berechnen
buehne.addEventListener('change', (ereignis) => {
  const datumFeld = ereignis.target.closest('.termin-datum');
  if (!datumFeld) return;
  const formular = datumFeld.closest('form');
  const studio = studios.get(formular.dataset.studio);
  const zeitFeld = formular.querySelector('.termin-zeit');
  const hinweis = formular.querySelector('.termin-hinweis');
  if (!datumFeld.value) {
    zeitFeld.innerHTML = '';
    hinweis.textContent = 'Bitte einen Wunschtag wählen.';
    return;
  }
  const auswahl = terminAuswahl(studio, parseDatum(datumFeld.value), parseDatum(formular.dataset.heute));
  zeitFeld.innerHTML = auswahl.slots.map((z) => `<option>${esc(z)} Uhr</option>`).join('');
  hinweis.textContent = auswahl.hinweis;
});

// Abschicken: es wird nichts gesendet, die Bestätigung zeigt nur den Ablauf
buehne.addEventListener('submit', (ereignis) => {
  const formular = ereignis.target.closest('.termin-formular');
  if (!formular) return;
  ereignis.preventDefault();
  const daten = new FormData(formular);
  formular.innerHTML = `
    <div class="termin-danke" role="status" tabindex="-1">
      <h3>Vielen Dank, ${esc(daten.get('name'))}!</h3>
      <p>Ihre Anfrage für <strong>${esc(langesDatum(daten.get('tag')))}, ${esc(daten.get('zeit'))}</strong>
        wäre jetzt bei uns eingegangen. Sie würden eine Bestätigung per E-Mail erhalten.</p>
      <ul class="termin-zusammenfassung">
        <li>Beratung: ${esc(daten.get('beratung'))}</li>
        <li>Thema: ${esc(daten.get('projekt'))}</li>
        <li>Küche gewünscht: ${esc(daten.get('zeitraum'))}</li>
      </ul>
      <p class="klein-hinweis">Demo: Es wurde nichts gesendet oder gespeichert.</p>
      <button type="button" class="btn btn-zweit" data-termin-neu>Neue Anfrage</button>
    </div>`;
  formular.querySelector('.termin-danke').focus();
});

buehne.addEventListener('click', (ereignis) => {
  if (ereignis.target.closest('[data-termin-neu]')) zeige('datum');
});

/** Faktor, mit dem alle Handy-Rahmen nebeneinander auf die Fensterbreite passen. Bei schmalen Fenstern
 *  (Faktor unter 0,65) bleibt es bei voller Größe, die Rahmen stehen dann untereinander. */
function setzeAlleZoom() {
  const anzahl = studios.size;
  // Platz für die Rahmen = Fensterbreite ohne Scrollleiste, Seitenränder und die Abstände zwischen den
  // Rahmen (die nicht mitverkleinert werden); ein Rahmen ist 414 px breit (siehe demo.css)
  const platz = document.documentElement.clientWidth - 32 - (anzahl - 1) * 40;
  const faktor = Math.min(1, platz / (anzahl * 414));
  alleStudios.style.setProperty('--alle-zoom', faktor >= 0.65 ? faktor.toFixed(3) : '1');
}

/** Misst die Demo-Leiste und legt ihre Höhe als --leiste-hoehe ab (für Anker-Sprünge und Rahmenhöhen). */
function misseLeistenhoehe() {
  document.documentElement.style.setProperty('--leiste-hoehe', `${Math.round(leiste.getBoundingClientRect().height)}px`);
}

// Der ResizeObserver fängt Änderungen durch Fenstergröße und Umbrüche ab. Zusätzlich wird bei jedem Rendern
// und an den Stellen gemessen, die die Höhe selbst ändern (Hinweis, Menü), das ist zuverlässiger.
function beobachteLeistenhoehe() {
  misseLeistenhoehe();
  window.addEventListener('resize', () => {
    misseLeistenhoehe();
    if (ansicht === 'alle') setzeAlleZoom();
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(misseLeistenhoehe).observe(leiste);
}

async function start() {
  for (const studio of await Promise.all(STUDIO_IDS.map(ladeStudio))) {
    studios.set(studio.id, studio);
    originale.set(studio.id, structuredClone(studio));
  }
  baueLeiste();
  beobachteLeistenhoehe();
  window.addEventListener('hashchange', () => zeige());
  await zeige();
}

start().catch((fehler) => {
  website.textContent = fehler.message;
});
