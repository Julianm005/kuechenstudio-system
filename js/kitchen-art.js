// kitchen-art.js – erzeugt Küchen-Illustrationen als SVG-String aus den Farbwerten im JSON.
// kuechenSVG(kueche) → SVG-String (viewBox 0 0 480 300), nur flache Formen, keine IDs
// (mehrere SVGs auf einer Seite würden sich sonst gegenseitig stören).
// Stile: "grifflos" | "landhaus" | "insel"

// ---------- Farb-Hilfen ----------

function zuRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function zuHex(rgb) {
  return `#${rgb.map((k) => Math.round(Math.min(255, Math.max(0, k))).toString(16).padStart(2, '0')).join('')}`;
}

/** Mischt zwei Farben: t = 0 → hex1, t = 1 → hex2. */
export function mischen(hex1, hex2, t) {
  const a = zuRgb(hex1);
  const b = zuRgb(hex2);
  return zuHex(a.map((k, i) => k + (b[i] - k) * t));
}

/** Dunkelt eine Farbe ab (wert 0–1). */
export function abdunkeln(hex, wert) {
  return mischen(hex, '#000000', wert);
}

function aufhellen(hex, wert) {
  return mischen(hex, '#ffffff', wert);
}

/** Wahrgenommene Helligkeit 0 (schwarz) bis 1 (weiß). */
function helligkeit(hex) {
  const [r, g, b] = zuRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Setzt sich von der Farbe ab: auf dunklen Flächen heller, auf hellen dunkler. */
function abheben(hex, wert) {
  return helligkeit(hex) < 0.45 ? aufhellen(hex, wert) : abdunkeln(hex, wert);
}

function esc(text) {
  return String(text).replace(/[&<>"']/g, (z) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]
  ));
}

// ---------- gemeinsame Bauteile ----------

const BLATT = '#5d8a58';
const TOPF = '#b5694a';
const EDELSTAHL = '#aeb4ba';
const GERAET = '#1f2225';

function pflanze(x, y) {
  // x = Mitte des Topfes, y = Oberkante der Arbeitsplatte
  return `
  <rect x="${x - 8}" y="${y - 18}" width="16" height="18" fill="${TOPF}"/>
  <ellipse cx="${x}" cy="${y - 30}" rx="4" ry="12" fill="${BLATT}"/>
  <ellipse cx="${x}" cy="${y - 28}" rx="4" ry="11" fill="${BLATT}" transform="rotate(-30 ${x} ${y - 18})"/>
  <ellipse cx="${x}" cy="${y - 28}" rx="4" ry="11" fill="${BLATT}" transform="rotate(30 ${x} ${y - 18})"/>`;
}

function wasserhahn(x, y) {
  // Becken in der Arbeitsplatte plus Hahn
  return `
  <rect x="${x - 26}" y="${y}" width="52" height="3" fill="${GERAET}" opacity="0.55"/>
  <path d="M${x} ${y} V${y - 22} Q${x} ${y - 30} ${x + 9} ${y - 30} H${x + 15}" fill="none" stroke="${EDELSTAHL}" stroke-width="4" stroke-linecap="round"/>`;
}

function kochfeld(x, y, breite) {
  return `
  <rect x="${x}" y="${y - 3}" width="${breite}" height="3" fill="${GERAET}"/>
  <ellipse cx="${x + breite * 0.28}" cy="${y - 4.5}" rx="${breite * 0.16}" ry="1.6" fill="#454a4f"/>
  <ellipse cx="${x + breite * 0.72}" cy="${y - 4.5}" rx="${breite * 0.16}" ry="1.6" fill="#454a4f"/>`;
}

// ---------- Stil: grifflos ----------

function grifflos({ front, arbeitsplatte, wand }) {
  const fuge = abheben(front, 0.2);
  const boden = abheben(wand, 0.1);
  const spiegel = mischen(wand, arbeitsplatte, 0.35);
  let oben = '';
  for (let i = 0; i < 4; i += 1) {
    oben += `<rect x="${108 + i * 86.5}" y="36" width="82.5" height="84" fill="${front}"/>`;
  }
  return `
  <rect width="480" height="300" fill="${wand}"/>
  <rect x="102" y="120" width="348" height="52" fill="${spiegel}"/>
  <rect y="262" width="480" height="38" fill="${boden}"/>
  ${oben}
  <rect x="30" y="30" width="72" height="232" fill="${front}"/>
  <path d="M30 108H102M30 176H102" stroke="${fuge}" stroke-width="1.5"/>
  <rect x="38" y="114" width="56" height="56" fill="${GERAET}"/>
  <rect x="44" y="128" width="44" height="34" fill="#3d4349"/>
  <circle cx="52" cy="121" r="2.5" fill="#8a9096"/><circle cx="66" cy="121" r="2.5" fill="#8a9096"/><circle cx="80" cy="121" r="2.5" fill="#8a9096"/>
  <rect x="108" y="182" width="342" height="80" fill="${front}"/>
  <path d="M108 222H450M222 182V262M336 182V262" stroke="${fuge}" stroke-width="1.5"/>
  <rect x="108" y="254" width="342" height="8" fill="#000" opacity="0.3"/>
  <rect x="102" y="172" width="354" height="10" fill="${arbeitsplatte}"/>
  <rect x="102" y="182" width="354" height="3" fill="#000" opacity="0.25"/>
  ${kochfeld(215, 172, 84)}
  ${wasserhahn(385, 172)}
  ${pflanze(136, 172)}`;
}

// ---------- Stil: landhaus ----------

function landhaus({ front, arbeitsplatte, wand }) {
  const fuge = abheben(front, 0.22);
  const holz = mischen('#a98a63', wand, 0.15);
  const spiegel = mischen(wand, '#ffffff', 0.5);
  const hauben = mischen(front, '#000000', 0.06);
  let dielen = '';
  for (let x = 0; x <= 480; x += 48) {
    dielen += `<path d="M${x} 262V300" stroke="${abdunkeln(holz, 0.2)}" stroke-width="1.5"/>`;
  }
  let teller = '';
  for (let i = 0; i < 6; i += 1) {
    const cx = 66 + i * 40;
    teller += `<circle cx="${cx}" cy="93" r="15" fill="#f4f1ea" stroke="#cfc8b8" stroke-width="1.5"/>
    <circle cx="${cx}" cy="93" r="9" fill="none" stroke="#cfc8b8" stroke-width="1.5"/>`;
  }
  let tueren = '';
  for (let i = 0; i < 4; i += 1) {
    const x = 42 + i * 100;
    tueren += `
  <rect x="${x}" y="186" width="96" height="70" fill="${front}"/>
  <rect x="${x + 10}" y="196" width="76" height="50" fill="${mischen(front, fuge, 0.1)}" stroke="${fuge}" stroke-width="1.5"/>
  <circle cx="${x + 84}" cy="192" r="3.5" fill="#8a6a4a" stroke="${fuge}"/>`;
  }
  return `
  <rect width="480" height="300" fill="${wand}"/>
  <rect x="34" y="118" width="412" height="52" fill="${spiegel}"/>
  <rect y="262" width="480" height="38" fill="${holz}"/>
  ${dielen}
  <rect x="378" y="0" width="24" height="28" fill="${hauben}" stroke="${fuge}" stroke-width="1.5"/>
  <path d="M360 28H420L438 106H342Z" fill="${hauben}" stroke="${fuge}" stroke-width="1.5"/>
  <rect x="44" y="108" width="270" height="6" fill="#8a6a4a"/>
  <rect x="60" y="114" width="6" height="12" fill="#8a6a4a"/><rect x="290" y="114" width="6" height="12" fill="#8a6a4a"/>
  ${teller}
  <rect x="40" y="182" width="400" height="80" fill="${abdunkeln(front, 0.3)}"/>
  ${tueren}
  <rect x="40" y="256" width="400" height="6" fill="${abdunkeln(front, 0.45)}"/>
  <rect x="34" y="172" width="412" height="10" fill="${arbeitsplatte}"/>
  ${kochfeld(352, 172, 76)}
  ${pflanze(72, 172)}`;
}

// ---------- Stil: insel ----------

function insel({ front, arbeitsplatte, wand }) {
  const fuge = abheben(front, 0.2);
  const boden = abheben(wand, 0.1);
  const spiegel = mischen(wand, arbeitsplatte, 0.3);
  const metall = helligkeit(wand) < 0.3 ? '#a9afb5' : '#2b2b2b';
  const breite = (420 - 5 * 4) / 6;
  let oben = '';
  let unten = '';
  for (let i = 0; i < 6; i += 1) {
    const x = 30 + i * (breite + 4);
    oben += `<rect x="${x}" y="40" width="${breite}" height="56" fill="${front}"/>`;
    unten += `<rect x="${x}" y="154" width="${breite}" height="78" fill="${front}"/>`;
  }
  const lampen = [160, 240, 320].map((cx) => `
  <path d="M${cx} 0V114" stroke="${metall}" stroke-width="1.5"/>
  <path d="M${cx - 18} 134A18 18 0 0 1 ${cx + 18} 134Z" fill="${metall}"/>
  <ellipse cx="${cx}" cy="135" rx="12" ry="2.5" fill="#ffe9a8"/>`).join('');
  const hocker = [44, 436].map((cx) => `
  <rect x="${cx - 14}" y="214" width="28" height="6" rx="3" fill="#9a7a52"/>
  <path d="M${cx - 9} 220L${cx - 13} 262M${cx + 9} 220L${cx + 13} 262M${cx - 11} 244H${cx + 11}" stroke="${metall}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`).join('');
  return `
  <rect width="480" height="300" fill="${wand}"/>
  <rect y="250" width="480" height="50" fill="${boden}"/>
  <rect x="30" y="96" width="420" height="50" fill="${spiegel}"/>
  ${oben}
  ${unten}
  <rect x="30" y="232" width="420" height="8" fill="#000" opacity="0.3"/>
  <rect x="30" y="146" width="420" height="8" fill="${mischen(arbeitsplatte, '#000000', 0.12)}"/>
  ${kochfeld(200, 146, 80)}
  ${wasserhahn(100, 146)}
  <rect x="70" y="256" width="340" height="6" fill="#000" opacity="0.12"/>
  ${hocker}
  <rect x="84" y="206" width="312" height="50" fill="${front}"/>
  <path d="M188 206V256M292 206V256" stroke="${fuge}" stroke-width="1.5"/>
  <rect x="84" y="206" width="312" height="3" fill="#000" opacity="0.25"/>
  <rect x="84" y="248" width="312" height="8" fill="#000" opacity="0.35"/>
  <rect x="66" y="192" width="348" height="14" fill="${arbeitsplatte}"/>
  ${pflanze(116, 192)}
  ${lampen}`;
}

const STILE = { grifflos, landhaus, insel };

/** Erzeugt die SVG-Küche für einen Eintrag aus „kuechen“ im Studio-JSON. */
export function kuechenSVG(kueche) {
  const zeichne = STILE[kueche.stil] ?? grifflos;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300" role="img" aria-label="${esc(kueche.alt)}">${zeichne(kueche)}
</svg>`;
}
