// jsonld.js – erzeugt aus dem Studio-JSON die schema.org-Daten (JSON-LD) für Suchmaschinen.
// Typ „FurnitureStore“ mit Adresse, Kontakt, Öffnungszeiten, Schließtagen und Einzugsgebiet.

const TAG_ENGLISCH = {
  mo: 'Monday', di: 'Tuesday', mi: 'Wednesday', do: 'Thursday', fr: 'Friday', sa: 'Saturday', so: 'Sunday',
};
const TAG_REIHENFOLGE = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

/** Tage mit gleichen Zeiten werden zu einem Eintrag zusammengefasst; Ruhetage (null) entfallen. */
function oeffnungszeiten(studio) {
  const gruppen = new Map();
  for (const tag of TAG_REIHENFOLGE) {
    const zeiten = studio.oeffnungszeiten[tag];
    if (!zeiten) continue;
    const schluessel = zeiten.join('-');
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, { zeiten, tage: [] });
    gruppen.get(schluessel).tage.push(TAG_ENGLISCH[tag]);
  }
  return [...gruppen.values()].map(({ zeiten, tage }) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: tage,
    opens: zeiten[0],
    closes: zeiten[1],
  }));
}

/** Schließzeiträume: „geschlossen“ wird in schema.org als opens = closes = 00:00 ausgedrückt. */
function schliesstage(studio) {
  return studio.schliesstage.map((s) => ({
    '@type': 'OpeningHoursSpecification',
    opens: '00:00',
    closes: '00:00',
    validFrom: s.von,
    validThrough: s.bis,
  }));
}

/** @returns {object} JSON-LD-Objekt für ein Studio */
export function erzeugeJsonLd(studio) {
  const k = studio.kontakt;
  return {
    '@context': 'https://schema.org',
    '@type': 'FurnitureStore',
    name: studio.name,
    description: studio.seo.beschreibung,
    address: {
      '@type': 'PostalAddress',
      streetAddress: k.strasse,
      postalCode: k.plz,
      addressLocality: k.ort,
      addressCountry: 'DE',
    },
    telephone: k.telefon,
    email: k.email,
    openingHoursSpecification: oeffnungszeiten(studio),
    specialOpeningHoursSpecification: schliesstage(studio),
    areaServed: [k.ort, ...studio.nachbarorte.map((o) => o.name)].map((name) => ({
      '@type': 'City',
      name,
    })),
  };
}

/** Schreibt (oder ersetzt) das JSON-LD-Skript im <head>. */
export function setzeJsonLd(daten) {
  let skript = document.getElementById('json-ld');
  if (!skript) {
    skript = document.createElement('script');
    skript.type = 'application/ld+json';
    skript.id = 'json-ld';
    document.head.append(skript);
  }
  skript.textContent = JSON.stringify(daten, null, 2);
}
