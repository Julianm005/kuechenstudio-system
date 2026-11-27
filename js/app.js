// Einstiegspunkt: lädt die Studio-Daten, hält den Zustand (URL-Hash + Ansicht + simuliertes Datum),
// baut die Demo-Leiste und die Seitenpanels.
// Neues Studio anlegen: JSON-Datei in data/ ablegen und die ID hier eintragen.

import { esc, renderSeite, seitenAttribute } from './render.js';
import {
  isoDatum, parseDatum, tagPlusN, tageZwischen, aenderungen, zeitraumAllerStudios,
} from './zeit.js';
import { spurenHtml, tageImBereich } from './zeitstrahl.js';
import { zeigeMeldungen } from './meldungen.js';
import { erzeugeJsonLd, setzeJsonLd } from './jsonld.js';
import { pruefe, STATUS_ZEICHEN } from './check.js';

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

const studios = new Map();
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
let gerendertesDatum = simuliertesDatum; // Datum der zuletzt gezeigten Seite (für die Meldungen)
let strahlTimer = null; // läuft der Zeitraffer?
let offenesPanel = null; // 'check' | 'daten' | null
let datenTab = 'studio'; // 'studio' | 'jsonld'
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

function baueLeiste() {
  const optionen = (eintraege) => eintraege
    .map(([wert, text]) => `<option value="${esc(wert)}">${esc(text)}</option>`).join('');
  leiste.innerHTML = `
    <div class="leiste-innen">
      <span class="leiste-marke">Demo</span>
      <button type="button" class="leiste-knopf leiste-menue" id="leiste-menue" aria-expanded="false" aria-controls="leiste-felder">Steuerung</button>
      <div class="leiste-felder" id="leiste-felder" role="group" aria-label="Demo-Steuerung">
      <label class="leiste-feld">Studio
        <select id="wahl-studio">${optionen([...studios.values()].map((s) => [s.id, s.name]))}</select>
      </label>
      <label class="leiste-feld">Design
        <select id="wahl-theme">${optionen(Object.entries(THEMES))}</select>
      </label>
      <span class="leiste-feld">
        <label class="leiste-feld" for="wahl-datum">Datum simulieren</label>
        <input type="date" id="wahl-datum" required>
        <button type="button" id="wahl-heute">Heute</button>
      </span>
      <fieldset class="ansicht-wahl">
        <legend>Ansicht</legend>
        <span class="ansicht-knoepfe">
          ${Object.entries(ANSICHTEN).map(([schluessel, text]) =>
            `<button type="button" data-ansicht="${schluessel}" aria-pressed="false">${text}</button>`).join('')}
        </span>
      </fieldset>
      <button type="button" class="leiste-knopf" id="wahl-check" aria-expanded="false" aria-controls="panel-check">
        Qualitäts-Check <span class="badge" id="check-badge"></span>
      </button>
      <button type="button" class="leiste-knopf" id="wahl-daten" aria-expanded="false" aria-controls="panel-daten">
        Daten ansehen
      </button>
      <div class="leiste-strahl">
        <button type="button" class="leiste-knopf" id="strahl-play" aria-pressed="false">▶ Zeitraffer</button>
        <div class="strahl">
          <span class="strahl-spuren" id="strahl-spuren" aria-hidden="true"></span>
          <input type="range" id="strahl-regler" min="0" max="0" step="1" value="0" aria-label="Datum auf dem Zeitstrahl">
        </div>
        <output class="strahl-datum" id="strahl-datum" for="strahl-regler"></output>
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
      </div>
      <div class="daten-zeile">
        <span id="daten-datei"></span>
        <button type="button" class="panel-kopieren" id="daten-kopieren">Kopieren</button>
      </div>
      <pre class="daten-code" id="daten-inhalt" role="tabpanel" tabindex="0"></pre>
    </aside>`;
}

function schaltePanel(name, offen) {
  const neu = offen ?? offenesPanel !== name;
  for (const n of ['check', 'daten']) {
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
  document.getElementById('daten-inhalt').setAttribute('aria-labelledby', `tab-${tab}`);
  document.getElementById('daten-inhalt').textContent = datenTexte[tab];
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
  badge.textContent = `${punkte}/${gesamt}`;
  badge.className = `badge badge-${schlechtester}`;
  document.getElementById('panel-check-unter').textContent =
    `${studio.name} · ${punkte} von ${gesamt} bestanden · Stand ${deDatum(simuliertesDatum)}`;
  document.getElementById('check-liste').innerHTML = ergebnisse.map((e) => `
    <li class="check check-${e.status}">
      <span class="check-zeichen" role="img" aria-label="${STATUS_ZEICHEN[e.status].name}">${STATUS_ZEICHEN[e.status].zeichen}</span>
      <div><strong>${esc(e.titel)}</strong><p>${esc(e.text)}</p></div>
    </li>`).join('');
}

function aktualisiereDaten(studio) {
  datenTexte.studio = JSON.stringify(studio, null, 2);
  datenTexte.jsonld = JSON.stringify(erzeugeJsonLd(studio), null, 2);
  waehleDatenTab(datenTab);
}

function zeigeInLeiste({ studio, theme }) {
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
  aktualisiereStrahl(studio);
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

function rendern({ studio, theme, ort }) {
  const optionen = { heute: simuliertesDatum, minuten: minutenJetzt() };
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
    website.innerHTML = ''; // sonst gäbe es dieselben IDs doppelt
    document.title = 'Alle Studios | Küchenstudio-Website-System';
  } else {
    alleStudios.innerHTML = '';
    setzeAttribute(website, studio, theme);
    website.innerHTML = renderSeite(studio, { ...optionen, theme, ort });
    document.title = ort ? `Küchenstudio für ${ort.name} | ${studio.name}` : studio.seo.titel;
    const beschreibung = ort
      ? `Küchenstudio für ${ort.name}: ${studio.name} in ${studio.kontakt.ort}, nur ${ort.km} km entfernt. ${studio.seo.beschreibung}`
      : studio.seo.beschreibung;
    document.querySelector('meta[name="description"]')?.setAttribute('content', beschreibung);
  }
  setzeJsonLd(erzeugeJsonLd(studio));

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
    return;
  }
  const menue = ereignis.target.closest('#leiste-menue');
  if (menue) {
    const offen = menue.getAttribute('aria-expanded') !== 'true';
    menue.setAttribute('aria-expanded', String(offen));
    leiste.querySelector('#leiste-felder').classList.toggle('offen', offen);
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
  }
});

panels.addEventListener('click', async (ereignis) => {
  const zu = ereignis.target.closest('[data-panel-zu]');
  if (zu) {
    schaltePanel(zu.dataset.panelZu, false);
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
  const neu = datenTab === 'studio' ? 'jsonld' : 'studio';
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

async function start() {
  for (const studio of await Promise.all(STUDIO_IDS.map(ladeStudio))) {
    studios.set(studio.id, studio);
  }
  baueLeiste();
  window.addEventListener('hashchange', () => zeige());
  await zeige();
}

start().catch((fehler) => {
  website.textContent = fehler.message;
});
