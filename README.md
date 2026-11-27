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
- **Zeitstrahl und Zeitraffer:** Ein Regler über das ganze Jahr mit Balken für Aktionen (blau) und Schließzeiträume (rot). Ziehen oder „Zeitraffer“ drücken, und die Seite altert live: Aktionen verschwinden und erscheinen, der Öffnungsstatus wechselt. Jede Änderung meldet die Demo in Worten („… ist abgelaufen und wurde automatisch ausgeblendet“). Die Uhrzeit bleibt die echte. Alternativ das Datumsfeld, z. B. 16.11.2026, 28.12.2026 oder 05.01.2027.
- **Studio und Design** wechseln unabhängig voneinander. Der Zustand steht in der URL, z. B. `#/kuechenwerk-elbtal/atelier`, damit Links teilbar sind.
- **Ansicht:** Desktop, Handy (390 px) oder alle Studios nebeneinander.
- **Typische Website:** Zeigt dasselbe Studio so, wie die Marktstudie typische Seiten beschreibt: abgelaufene Aktion noch sichtbar, kein Live-Status, keine Ortsseiten. Rote Markierungen zählen die Probleme.
- **Live-Editor:** Öffnungszeiten, Aktionen, Schließzeiträume, Küchenfarben und Nachbarorte ändern, und Website, Qualitäts-Check und schema.org-Daten reagieren sofort. Nichts wird gespeichert, „Zurücksetzen“ stellt das Original wieder her, das JSON lässt sich kopieren oder herunterladen.
- **Qualitäts-Check:** 9 Prüfungen mit ✅ in Ordnung, ⚙️ automatisch gelöst, ⚠️ Warnung, ❌ Fehler. Küchenwerk Elbtal erreicht 9/9, Landhausküchen Moritzburg zeigt bewusst zwei Warnungen. Bei jeder Warnung springt „Im Editor beheben“ direkt zum passenden Feld.
- **Daten:** das Studio-JSON, das daraus erzeugte JSON-LD und „So sieht die Suche dich“, eine neutrale Vorschau, wie Suchmaschinen Name, Status, Öffnungszeiten und Einzugsgebiet aus den strukturierten Daten lesen.
- **+ Studio:** Ein neues Studio entsteht aus einer Vorlage in Sekunden. Der Check zeigt danach, was noch fehlt.
- **Auf der Website selbst:** Beratungstermin-Formular (nur freie Zeiten innerhalb der Öffnungszeiten, Schließtage gesperrt), Farbwähler unter dem Hero-Bild und auf dem Handy eine feste Schnellleiste (Anrufen, Termin, Besuch).

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
js/zeit.js            Datum, Öffnungsstatus, Schließtage, Änderungen zwischen zwei Daten
js/zeitstrahl.js      Balken für den Zeitstrahl
js/meldungen.js       Meldungen der Demo (Live-Region)
js/editor.js          Live-Editor: Formular, Prüfen, Setzen
js/termin.js          mögliche Beratungstermine
js/suche.js           „So sieht die Suche dich“
js/kitchen-art.js     SVG-Küchen aus Farbwerten
js/jsonld.js          schema.org-Daten
js/check.js           Qualitäts-Check
```

## Ehrliche Grenzen der Demo

- **Ortsseiten sind in der Demo echte Seiten, für Google aber noch nicht.** Sie leben hinter dem `#` in der Adresse, und Suchmaschinen werten das nicht als eigene Seiten. Für den Produktivbetrieb müssten die Seiten vorab als HTML erzeugt werden (z. B. `/coswig/`). Die Demo zeigt Inhalt und Titel je Ort, löst aber nicht das Indexierungsproblem. Das wäre ein bewusst anderer Schritt, weil das Projekt hier ohne Build-Schritt bleibt.
- **Kundenstimmen sind erfunden** und stehen nur als Text auf der Seite. Sie sind absichtlich nicht Teil der schema.org-Daten, denn erfundene Bewertungen in strukturierten Daten wären ein Verstoß gegen die Richtlinien der Suchmaschinen.
- **Das Terminformular sendet nichts.** Es zeigt nur, wie Öffnungszeiten und Schließtage die Auswahl steuern.
- **Der Live-Editor speichert nichts.** Änderungen leben im Speicher der Seite, ein Neuladen stellt die Originaldaten wieder her.

## Qualität

- Semantisches HTML, Alt-Texte für alle Küchenbilder, Tastaturbedienung, sichtbare Fokusrahmen, `prefers-reduced-motion` wird respektiert.
- Kontraste der Website wurden für alle 3 × 3 Studio-Design-Kombinationen per Skript geprüft (mindestens AA).
- Lighthouse (gemessen mit PageSpeed Insights auf der Live-Seite, 27.11.2026, Lighthouse 13.6, nach Ergänzung von Zeitstrahl, Editor und Terminformular):

  | | Performance | Accessibility | Best Practices | SEO |
  |---|---|---|---|---|
  | Mobil | 99 | 100 | 100 | 100 |
  | Desktop | 100 | 100 | 100 | 100 |

  <!-- TODO: Lighthouse-Screenshot ergänzen -->
- Bei der ersten Messung lag der Desktop-Wert bei 97, weil die per Skript eingefügte Demo-Leiste die Seite verschob (Layout-Versatz 0,101). Mit einem Overlay-Hinweis und reservierter Leistenhöhe sank er auf 0,025. Seit der Hinweis fester Teil der Leiste ist und die Seite nach unten schiebt (statt sie zu überdecken), liegt er bei 0,058, also weiter im grünen Bereich (unter 0,1).

## Wie dieses Projekt entstanden ist

Ich habe dieses Projekt mit **Claude Code** gebaut. Dabei hat die KI den größten Teil des Codes geschrieben, die Richtung und die Qualitätskontrolle kamen von mir.

**1. Recherche und Konzept**
Ausgangspunkt war die Frage, woran Websites von Küchenstudios typischerweise scheitern: Aktionen laufen ab und bleiben online, Öffnungszeiten und Schließtage sind veraltet, der eigene Ort fehlt im Seitentitel, Nachbarorte werden nicht abgedeckt, viele Seiten sind auf dem Handy schwach. Daraus habe ich mit Unterstützung von Claude eine Projektbeschreibung mit Datenmodell, Funktionen und Akzeptanzkriterien erarbeitet.

**2. Schrittweiser Aufbau**
Claude Code hat das Projekt nicht in einem Durchgang erzeugt. Ich habe es in einzelnen Schritten bauen lassen: erst ein Studio in einem Design, dann die weiteren Designs, die Küchen-Grafiken, das Ablaufdatum für Aktionen, die Ortsseiten, die Google-Daten und den Qualitäts-Check. Bei größeren Schritten habe ich mir vorher einen Plan zeigen lassen und erst danach die Umsetzung freigegeben.

**3. Testen und Fehler finden**
Nach jedem Schritt habe ich die Seite selbst im Browser geprüft, auf dem Desktop und in der Handy-Ansicht, in verschiedenen Kombinationen aus Studio und Design. Fehler wie falsche Umbrüche, überlappende Elemente oder Logikfehler bei Öffnungszeiten habe ich gesucht, beschrieben (oft mit Screenshot) und gezielt beheben lassen. Seit den Erweiterungen (Zeitstrahl, Editor usw.) ist jeder Stand als eigener Git-Commit gespeichert.

**4. Was ich dabei gelernt habe**
- Gute Ergebnisse mit KI entstehen durch klare Anforderungen, kleine Schritte und konsequentes Prüfen, nicht durch einen einzelnen Prompt.
- Inhalt und Gestaltung zu trennen (JSON + Design-Layer) macht ein System skalierbar: Ein neues Studio ist nur eine neue Datei.
- Die KI liegt öfter knapp daneben, besonders bei Layout-Details und Sonderfällen. Das zu erkennen und präzise zu beschreiben, ist der wichtigste Teil der Arbeit.

> Alle Studios, Personen, Adressen und Telefonnummern in diesem Projekt sind frei erfunden.

## Nicht Teil dieses Projekts

Kein echtes CMS, kein Backend, keine Formulare, die etwas senden, keine echten Fotos, kein Cookie-Banner, kein Tracking. Ein Änderungs-Concierge (Vorschau und Freigabe) ist ein eigenes Projekt.
