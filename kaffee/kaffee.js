// Kaffee-Seite: Freestyle-Rezept, Tassen eingießen, Geräte antippen, Tassen-Zähler.
(function () {
  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];

  // Freestyle-Rezept: alles nach Gefühl
  const METHODEN = {
    'Siebträger, als Flat White': {
      menge: ['ein Sieb voll', 'doppelt, wie immer', 'so viel, dass der Tamper gerade noch passt'],
      mahlgrad: ['eine Raste feiner als gestern', 'fein wie Puderzucker', 'so wie letztes Mal, nur besser'],
      zeit: ['bis es honigartig läuft', 'bis die Crema haselnussbraun ist', 'zwei Atemzüge länger als gedacht'],
    },
    'Siebträger, als Espresso': {
      menge: ['ein Sieb voll', 'ein bisschen mehr als letztes Mal', 'bis es oben glatt ist'],
      mahlgrad: ['fein, aber nicht zu fein', 'eine Raste feiner als gestern', 'genau richtig, hoffentlich'],
      zeit: ['bis es blond wird, dann Stopp', 'so lang wie ein guter Gedanke', 'bis die Tasse halb voll ist'],
    },
    'French Press': {
      menge: ['drei gute Schaufeln', 'eine Handvoll', 'bis der Boden ordentlich bedeckt ist'],
      mahlgrad: ['grob wie Meersalz', 'grob, sonst wird es Schlamm', 'so grob, wie die Mühle es hergibt'],
      zeit: ['einmal diese Seite durchlesen', 'bis der Toast fertig ist', 'vier Minuten, ungefähr'],
    },
    'Mokka': {
      menge: ['Trichter randvoll, nicht pressen', 'bis knapp unter den Rand', 'ein kleiner Hügel, glattgestrichen'],
      mahlgrad: ['fein wie Tafelsalz', 'zwischen Espresso und Filter', 'etwas gröber als für den Siebträger'],
      zeit: ['bis es blubbert', 'bis die Küche nach Haselnuss riecht', 'Herd aus, sobald es gurgelt'],
    },
    'Mokka am Stellplatz': {
      menge: ['was die Dose noch hergibt', 'ein Trichter voll', 'nach Augenmaß im Halbdunkel'],
      mahlgrad: ['Hario Skerton, nach Gefühl', 'fein wie Tafelsalz, ungefähr', 'was die Kurbel hergibt'],
      zeit: ['bis es über dem Gaskocher blubbert', 'bis der Sonnenaufgang fertig ist', 'bis das Zelt eingepackt ist'],
    },
  };
  const DAZU = ['Blick in die Berge', 'ein Stück Kuchen', 'Musik laut', 'absolute Stille', 'der erste Mail-Check des Tages',
    'Sonnenaufgang', 'ein Croissant, wenn’s geht', 'kein Handy für fünf Minuten', 'Regen am Fenster', 'Hund vom Nachbarn'];

  const rezept = document.getElementById('rezept');
  const wuerfeln = () => {
    if (!rezept) return;
    const name = zufall(Object.keys(METHODEN));
    const m = METHODEN[name];
    const werte = { methode: name, menge: zufall(m.menge), mahlgrad: zufall(m.mahlgrad), zeit: zufall(m.zeit), dazu: zufall(DAZU) };
    rezept.querySelectorAll('[data-feld]').forEach((dd) => { dd.textContent = werte[dd.dataset.feld]; });
    if (!ruhig) {
      rezept.classList.remove('neu');
      void rezept.offsetWidth; // Animation neu starten
      rezept.classList.add('neu');
    }
  };
  document.getElementById('wuerfeln')?.addEventListener('click', wuerfeln);
  wuerfeln();

  // Tassen: frisch eingießen
  document.querySelectorAll('.tassen-knopf').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.remove('giesst');
      void btn.offsetWidth;
      btn.classList.add('giesst');
    });
    btn.addEventListener('animationend', (e) => {
      if (e.target.classList.contains('strahl')) btn.classList.remove('giesst');
    });
  });

  // Geräte: am Handy antippen startet die Bewegung kurz
  document.querySelectorAll('.setup-list li').forEach((li) => {
    li.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      li.classList.add('an');
      clearTimeout(li._t);
      li._t = setTimeout(() => li.classList.remove('an'), 1800);
    });
  });

  // Tassen-Zähler, pro Tag im eigenen Browser
  const heute = new Date().toISOString().slice(0, 10);
  const SCHLUESSEL = 'kaffee-zaehler';
  const lesen = () => {
    try {
      const d = JSON.parse(localStorage.getItem(SCHLUESSEL) || '{}');
      return d.tag === heute ? d.anzahl || 0 : 0;
    } catch (e) { return 0; }
  };
  const schreiben = (n) => {
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify({ tag: heute, anzahl: n })); } catch (e) { /* egal */ }
  };
  const SPRUECHE = [
    'Noch keiner. Zeit wird’s.',
    'Der erste. Der wichtigste.',
    'Zwei. Jetzt läuft der Tag.',
    'Drei. Solide.',
    'Vier. Vielleicht ein Glas Wasser dazwischen?',
  ];
  const tassenEl = document.getElementById('zaehler-tassen');
  const textEl = document.getElementById('zaehler-text');
  const tasseSvg = '<svg viewBox="0 0 40 32" aria-hidden="true"><path d="M5 8 H29 V18 Q29 28 17 28 Q5 28 5 18 Z"/><path d="M29 11 Q36 11 36 16 Q36 21 29 21"/></svg>';
  let anzahl = lesen();
  const zeigen = () => {
    if (!tassenEl) return;
    tassenEl.innerHTML = tasseSvg.repeat(Math.min(anzahl, 12)) + (anzahl > 12 ? `<span>+${anzahl - 12}</span>` : '');
    tassenEl.setAttribute('aria-label', `${anzahl} ${anzahl === 1 ? 'Tasse' : 'Tassen'}`);
    textEl.textContent = SPRUECHE[anzahl] || 'Okay, jetzt reicht’s aber.';
  };
  document.getElementById('plus-tasse')?.addEventListener('click', () => { anzahl += 1; schreiben(anzahl); zeigen(); });
  document.getElementById('reset-tasse')?.addEventListener('click', () => { anzahl = 0; schreiben(anzahl); zeigen(); });
  zeigen();
})();
