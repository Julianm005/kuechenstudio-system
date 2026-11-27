// meldungen.js – kurze Meldungen unten rechts (z. B. „Aktion automatisch ausgeblendet“).
// Der Container ist eine Live-Region, Screenreader lesen neue Meldungen vor.

import { esc } from './render.js';

const MAX_SICHTBAR = 4;
const DAUER_MS = 6500;

/** @param {{icon: string, text: string}[]} liste */
export function zeigeMeldungen(liste) {
  const behaelter = document.getElementById('demo-meldungen');
  if (!behaelter) return;
  for (const meldung of liste) {
    const eintrag = document.createElement('li');
    eintrag.className = 'meldung';
    eintrag.innerHTML = `<span class="meldung-icon" aria-hidden="true">${meldung.icon}</span><span>${esc(meldung.text)}</span>`;
    behaelter.append(eintrag);
    setTimeout(() => eintrag.classList.add('weg'), DAUER_MS);
    setTimeout(() => eintrag.remove(), DAUER_MS + 500);
  }
  while (behaelter.children.length > MAX_SICHTBAR) behaelter.firstElementChild.remove();
}
