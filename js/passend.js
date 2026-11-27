// passend.js – Sicherheitsnetz gegen zerrissene Wörter in Überschriften.
//
// `hyphens: auto` trennt nur, wenn der Browser ein Trennwörterbuch für Deutsch hat. Fehlt es (z. B. in
// Opera und eingebetteten Browsern), läuft ein langes Wort über den Rand. Ein Umbruch mitten im Wort
// ohne Trennstrich soll es aber nie geben. Deshalb verkleinert diese Funktion eine Überschrift in
// kleinen Schritten, bis ihr längstes Wort in die Zeile passt. Wo der Browser trennt, ändert sich nichts.
// Nur wenn selbst die kleinste Größe nicht reicht, darf diese eine Überschrift umbrechen.

const MIN_FAKTOR = 0.6; // nie kleiner als 60 % der Sollgröße aus dem CSS
const SCHRITT = 0.94;
const MAX_SCHRITTE = 16;

/** Setzt für alle Überschriften in `wurzel` die Sollgröße und verkleinert nur, was nicht passt. */
export function passeUeberschriftenAn(wurzel) {
  for (const el of wurzel.querySelectorAll('h1, h2, h3')) {
    el.style.fontSize = ''; // zurück zur Größe aus dem CSS (clamp)
    el.style.overflowWrap = '';
    if (el.clientWidth === 0) continue; // nicht sichtbar
    const soll = parseFloat(getComputedStyle(el).fontSize);
    let groesse = soll;
    for (let i = 0; i < MAX_SCHRITTE && el.scrollWidth > el.clientWidth + 1 && groesse > soll * MIN_FAKTOR; i += 1) {
      groesse *= SCHRITT;
      el.style.fontSize = `${groesse.toFixed(2)}px`;
    }
    // Letzte Stufe: Auch in der kleinsten Größe zu breit (ein unrealistisch langes Wort). Dann darf nur
    // diese eine Überschrift umbrechen, statt über den Rand zu laufen.
    if (el.scrollWidth > el.clientWidth + 1) el.style.overflowWrap = 'anywhere';
  }
}

const beobachtet = new WeakMap(); // Container → zuletzt gesehene Breite

/** Rechnet neu, wenn sich die Breite eines Website-Containers ändert (Fenster, Handy-Rahmen, Zoom). */
export function beobachteBreite(wurzel) {
  if (beobachtet.has(wurzel) || typeof ResizeObserver === 'undefined') return;
  beobachtet.set(wurzel, wurzel.clientWidth);
  new ResizeObserver(() => {
    if (wurzel.clientWidth === beobachtet.get(wurzel)) return; // nur die Breite zählt, sonst Schleife
    beobachtet.set(wurzel, wurzel.clientWidth);
    passeUeberschriftenAn(wurzel);
  }).observe(wurzel);
}
