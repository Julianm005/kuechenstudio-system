# Küchenstudio-Website-System

**Eine komplette Website für ein Küchenstudio entsteht aus einer einzigen JSON-Datei plus einem austauschbaren Design-Layer, und sie hält sich aus ihren Daten selbst aktuell.**

Reines HTML, CSS und Vanilla JavaScript. Kein Framework, kein Build-Schritt, keine Abhängigkeiten, keine externen Schriften oder Bilder.

> **Alle Studios, Namen, Adressen, Telefonnummern und E-Mail-Adressen sind erfunden.** Herstellernamen stehen nur als Text, ohne Logos.

**Live-Demo: https://julianm005.github.io/kuechenstudio-system/**

<!-- TODO ergänzen:
     - GIF vom Datums-Simulator (Datum vorspulen: Aktion verschwindet, Badge wechselt auf „Heute geschlossen“)
     - Screenshots (Desktop, Handy, Alle Studios, Qualitäts-Check)
     - Lighthouse-Screenshot, sobald gemessen -->

## So funktioniert's

```
data/<studio>.json ──► js/render.js ──► HTML-Bausteine ──► css/base.css + css/themes/<design>.css
   (Inhalt)            (Bausteine)                          (Layout)        (nur Variablen)
        │
        ├──► js/jsonld.js   schema.org-Daten (FurnitureStore) im <head>
        └──► js/check.js    Qualitäts-Check mit 9 Prüfungen
```

- **Inhalt:** Eine JSON-Datei pro Studio (Adresse, Küchen, Team, Aktionen, Öffnungszeiten, Schließtage, Nachbarorte, FAQ).
- **Bausteine:** `render.js` erzeugt daraus Header, Hero, Aktionen, Vorteile, Galerie, Marken, Team, Öffnungszeiten, FAQ, Nachbarorte und Footer.
- **Design-Layer:** `base.css` benutzt ausschließlich CSS-Variablen. Jedes Theme (`modern`, `landhaus`, `atelier`) setzt nur diese Variablen plus wenige gezielte Überschreibungen. Die Studio-Farbe aus dem JSON gilt nur im Standard-Design des Studios, damit fremde Kombinationen lesbar bleiben.
- **Bilder:** Die Küchen-Illustrationen entstehen als SVG aus den Farbwerten im JSON (`js/kitchen-art.js`), in den Stilen *grifflos*, *landhaus* und *insel*. Jedes Bild ist winzig, einzigartig und frei von Urheberrechtsfragen.
- **Responsiv:** über CSS Container Queries statt Media Queries. Deshalb stimmt das Mobil-Layout auch in der Handy-Vorschau und in „Alle Studios“, ganz ohne iframes.

## Die Probleme aus der Marktstudie und wie die Demo sie löst

Grundlage: Marktstudie über rund 2.300 Küchenstudio-Websites (Juli 2026).

| Problem | Lösung in der Demo |
|---|---|
| **Veraltete Inhalte:** abgelaufene Aktionen, alte Jahreszahlen | Aktionen haben `gueltigAb`/`gueltigBis` und blenden sich selbst ein und aus. Der Qualitäts-Check findet Jahreszahlen wie „Küchenneuheiten 2025“. |
| **Schwache lokale Suche:** 67 % ohne Seiten für Nachbarorte, 54 % ohne Ort im Seitentitel | Für jeden Nachbarort entsteht automatisch eine eigene Seite mit eigenem Titel (`#/<studio>/<design>/ort/<slug>`). Der Check prüft den Ort im Titel und mindestens 3 Ortsseiten. |
| **Mobil:** 6 von 10 Besuchen kommen vom Handy | Mobile-first-Layout, große Tipp-Ziele, klickbare Telefonnummer und E-Mail. Handy-Ansicht und „Alle Studios“ zeigen das direkt. |
| **Öffnungszeiten und Schließtage** fehlen oder sind falsch, auch bei Google | Live-Badge „Jetzt geöffnet · bis 18:00“, Hinweis auf kommende Betriebsferien, und Schließtage gehen als `specialOpeningHoursSpecification` in die schema.org-Daten. |

**Abgrenzung zu KI-Baukästen:** Die erstellen schnell einen ersten Entwurf, aber die Pflege danach bleibt beim Kunden. Diese Demo zeigt eine Website, die sich aus ihren Daten selbst aktuell hält.

## Die Demo ausprobieren

Oben steht die Demo-Leiste (bewusst grau und klar von der Website getrennt):

- **Studio und Design** wechseln unabhängig voneinander. Der Zustand steht in der URL, z. B. `#/kuechenwerk-elbtal/atelier`, damit Links teilbar sind.
- **Datum simulieren:** Spul zum 16.11.2026, 28.12.2026 oder 05.01.2027 und sieh zu, wie Aktionen verschwinden und erscheinen und der Öffnungsstatus reagiert. Die Uhrzeit bleibt die echte.
- **Ansicht:** Desktop, Handy (390 px) oder alle Studios nebeneinander.
- **Qualitäts-Check:** 9 Prüfungen mit ✅ in Ordnung, ⚙️ automatisch gelöst, ⚠️ Warnung, ❌ Fehler. Küchenwerk Elbtal erreicht 9/9, Landhausküchen Moritzburg zeigt bewusst zwei Warnungen (nur 2 Nachbarorte, veraltete Jahreszahl).
- **Daten ansehen:** das Studio-JSON und das daraus erzeugte JSON-LD. Diese eine Datei ist die ganze Website.

## Lokal starten

Die JSON-Dateien werden mit `fetch()` geladen, deshalb funktioniert `index.html` nicht direkt per Doppelklick. Einen einfachen Server im Projektordner starten:

```
python -m http.server 8000
```

oder

```
npx serve .
```

Dann `http://localhost:8000` öffnen.

## Neues Studio anlegen in 2 Minuten

1. Eine bestehende Datei aus `data/` kopieren, z. B. `kuechenwerk-elbtal.json` nach `data/mein-studio.json`.
2. Darin `id` (gleich dem Dateinamen), `name`, `theme` (`modern`, `landhaus` oder `atelier`), `akzent`, Kontakt, Texte, Küchen (Farben und Stil), Team, Aktionen, Öffnungszeiten, Schließtage und Nachbarorte anpassen.
3. Die ID in `js/app.js` in die Liste `STUDIO_IDS` eintragen.

Fertig: Das Studio erscheint in der Auswahl und in „Alle Studios“, bekommt Ortsseiten, schema.org-Daten und einen Qualitäts-Check.

## Projektstruktur

```
index.html
data/                 eine JSON-Datei pro Studio
css/base.css          Layout und Bausteine (nur CSS-Variablen)
css/themes/           modern.css, landhaus.css, atelier.css
css/demo.css          Demo-Leiste, Panels, Geräterahmen (getrennt von der Website)
js/app.js             Laden, Zustand (URL-Hash), Demo-Leiste, Panels
js/render.js          Website aus JSON rendern
js/zeit.js            Datum, Öffnungsstatus, Schließtage
js/kitchen-art.js     SVG-Küchen aus Farbwerten
js/jsonld.js          schema.org-Daten
js/check.js           Qualitäts-Check
```

## Qualität

- Semantisches HTML, Alt-Texte für alle Küchenbilder, Tastaturbedienung, sichtbare Fokusrahmen, `prefers-reduced-motion` wird respektiert.
- Kontraste der Website wurden für alle 3 × 3 Studio-Design-Kombinationen per Skript geprüft (mindestens AA).
- Lighthouse (gemessen mit PageSpeed Insights auf der Live-Seite, 27.11.2026, Lighthouse 13.6):

  | | Performance | Accessibility | Best Practices | SEO |
  |---|---|---|---|---|
  | Mobil | 100 | 100 | 100 | 100 |
  | Desktop | 100 | 100 | 100 | 100 |

  <!-- TODO: Lighthouse-Screenshot ergänzen -->
- Bei der ersten Messung lag der Desktop-Wert bei 97, weil die per Skript eingefügte Demo-Leiste die Seite verschob (Layout-Versatz 0,101). Der Hinweis liegt jetzt als Overlay über der Seite und die Leiste reserviert ihre Höhe: 0,025.

## Wie das Projekt entstanden ist

<!-- TODO: ehrlicher Hinweis, dass das Projekt mit Claude Code gebaut wurde, und welche Entscheidungen
     ich selbst getroffen habe (Konzept, Marktstudie, Datenmodell, Auswahl der Probleme, ...).
     Das kann nur die Person schreiben, die sie getroffen hat. -->

## Nicht Teil dieses Projekts

Kein echtes CMS, kein Backend, keine Formulare, die etwas senden, keine echten Fotos, kein Cookie-Banner, kein Tracking. Ein Änderungs-Concierge (Vorschau und Freigabe) ist ein eigenes Projekt.
