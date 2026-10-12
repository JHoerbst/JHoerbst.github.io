# jhoerbst.github.io

Persönliche Website von Julian Hörbst, live unter https://jhoerbst.github.io.

Reines HTML, CSS und JavaScript ohne Build-Schritt und ohne Abhängigkeiten. Ein Push auf
`master` ist nach ein bis zwei Minuten online (GitHub Pages).

## Seiten

| Pfad | Inhalt | Look |
|---|---|---|
| `/` | Startseite, Projekte, Hobbys | dunkel, Dev-Look |
| `/reisen/` | Reisen als Stempel im Reisepass, Weltkarte, Wunschliste | Reisepass |
| `/camper/` | Der Pajero: Steckbrief, Ausbau, Fotos, selber fahren | 80er-Prospekt |
| `/kaffee/` | Setup, Lieblingsbohne, Rezept-Würfel | Röster-Etikett |
| `/gipfel/` | Gipfelbuch mit Panorama, Spiel und Karte | Gipfelbuch auf Papier |

Jede Seite hat ihr eigenes Stylesheet. Gemeinsam ist nur die Navigation in
`assets/nav.css`, die auf allen Seiten gleich aussieht und nur die Farbe vom Theme
übernimmt (`--nav-fg` am `<body>`).

## Lokal ansehen

Reise-, Pajero- und Gipfelseite laden ihre Daten per `fetch`. Über `file://` geht das
nicht, deshalb einen kleinen Webserver im Repo starten:

```sh
python3 -m http.server 8765
```

Dann http://127.0.0.1:8765/ öffnen.

## Daten pflegen

Reisen und Gipfel stehen in JSON-Dateien. Die Startseite, der Reisepass, die Pajero-Seite
und das Gipfelbuch rechnen ihre Zahlen daraus selbst aus, sonst muss nichts angepasst
werden.

### Reisen: `reisen/reisen.json`

```json
{
  "titel": "Kroatien-Roadtrip",
  "wann": "2026-07",
  "notiz": "Mit dem Pajero nach Dugi Otok.",
  "tags": ["camper"],
  "laender": ["HR", "SI"],
  "orte": [{ "ort": "Dugi Otok", "land": "HR", "lat": 44.03, "lon": 15.0 }],
  "fotos": ["../camper/fotos/dugi-otok-bucht.jpg"]
}
```

- `wann` ist `JJJJ-MM` oder nur `JJJJ`. Für längere Reisen gibt es zusätzlich `bis` im selben Format.
- `laender` sind ISO-Codes mit zwei Buchstaben. Sie färben die Karte und zählen in der Statistik.
- `orte` sind optional. Ohne Orte gibt es nur das eingefärbte Land, keinen Pin.
- `tags`: `camper` heißt mit dem Pajero. Die Reise erscheint dann auch auf der Pajero-Seite.
  `rundreise` zeichnet beim Überfahren des Stempels eine Route ab Linz und zurück
  (der Startort steht oben in der Datei unter `start`). Pajero-Reisen mit mehreren
  Orten sind automatisch Rundreisen.
- Ein Wunschziel kommt in `wunschliste`: `{ "ziel": "Japan", "land": "JP", "lat": 36.2, "lon": 138.25 }`.
  Zum Abhaken den Eintrag nach `reisen` verschieben.

### Gipfel: `gipfel/gipfel.json`

```json
{ "name": "Rinsennock", "hoehe": 2334, "gebiet": "Nockberge", "land": "AT", "lat": 46.915, "lon": 13.846 }
```

- `"art": "klettersteig"` setzt den roten Klettersteig-Stempel.
- `"hinauf": "lift"` oder `"hinauf": "pajero"` für Gipfel, die nicht zu Fuß erreicht wurden.
  Sie zählen extra und nicht beim höchsten Gipfel zu Fuß.
- `"ungefaehr": true` schreibt „ca.“ vor die Höhe. Ohne Höhe (`null`) steht „–“.
- Wunschgipfel kommen nach `wunsch` und erscheinen als Wegweiser.

## Fotos

Fotos liegen bei der jeweiligen Seite, zum Beispiel `camper/fotos/`, das Porträt unter
`assets/img/me.jpg`. Vor dem Einchecken:

- auf etwa 1400 px Kantenlänge verkleinern
- EXIF-Daten entfernen, vor allem GPS
- Kennzeichen und fremde Personen unkenntlich machen

Fotos mit anderen Personen kommen nur mit deren Okay auf die Seite.

## Weltkarte neu erzeugen

`reisen/welt.svg` und `reisen/laender.json` erzeugt `tools/gen_map.py` aus Natural-Earth-Daten.
Neu erzeugen muss man sie nur, wenn sich Projektion oder Ländergrenzen ändern sollen:

```sh
mkdir -p /tmp/mapdata && cd /tmp/mapdata
curl -fsSLO https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json
curl -fsSLO https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.14.0/codes.json
curl -fsSLO https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.14.0/langs/de.json
curl -fsSL -o countries-list.json https://cdn.jsdelivr.net/npm/countries-list@3.1.1/countries.min.json
cd -
python3 -I tools/gen_map.py /tmp/mapdata reisen
```

Die Karte nutzt die Equal-Earth-Projektion. Dieselbe Formel steckt in `reisen/reisen.js`,
`camper/camper.js` und `gipfel/gipfel.js`, damit die Pins genau auf der Karte sitzen.

## Schriften und Datenschutz

Alle Schriften liegen in `assets/fonts/` (Martian Mono, Instrument Sans, Archivo, Caveat,
alle unter der SIL Open Font License). Die Seite lädt nichts von Google oder anderen
fremden Servern, setzt keine Cookies und trackt nicht. Nur der Tassen-Zähler auf der
Kaffee-Seite und der Rekord im Gipfel-Spiel speichern etwas im `localStorage` des
eigenen Browsers.

Im Footer jeder Seite steht die Offenlegung nach § 25 Mediengesetz.
