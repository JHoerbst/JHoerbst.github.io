// Startseite: am_liebsten wechselt, terraform apply, Konami-Code.
(function () {
  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // am_liebsten: wechselt von selbst (Schreibmaschine), Klick springt weiter
  const WERTE = ['irgendwo am Berg', 'im Pajero am Stellplatz', 'beim Flat White', 'im Kiesbett vom Tagliamento',
    'auf der Ring Road', 'mit Gämsen am Gipfel', 'am Gaskocher mit Mokka', 'in Liberty City oder so', '↑↑↓↓←→←→BA'];
  const feld = document.getElementById('am-liebsten');
  let i = 0, laeuft = null, pause = false;
  const setze = (t) => { feld.textContent = `"${t}"`; };
  const tippe = (ziel, fertig) => {
    clearInterval(laeuft);
    let text = feld.textContent.replace(/"/g, '');
    let loeschen = true;
    laeuft = setInterval(() => {
      if (loeschen) {
        text = text.slice(0, -1);
        if (!text.length) loeschen = false;
      } else {
        text = ziel.slice(0, text.length + 1);
        if (text === ziel) { clearInterval(laeuft); fertig && fertig(); }
      }
      setze(text);
    }, loeschen ? 28 : 45);
  };
  const weiter = () => {
    i = (i + 1) % WERTE.length;
    if (ruhig) setze(WERTE[i]); else tippe(WERTE[i]);
  };
  if (feld) {
    feld.addEventListener('click', weiter);
    feld.addEventListener('mouseenter', () => { pause = true; });
    feld.addEventListener('mouseleave', () => { pause = false; });
    if (!ruhig) {
      setInterval(() => { if (!pause && !document.hidden) weiter(); }, 4500);
    }
  }

  // terraform apply mit echten Zahlen aus den Unterseiten
  const knopf = document.getElementById('apply');
  const term = document.getElementById('terminal');
  const holen = (url) => fetch(url, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const zahl = (n) => n.toLocaleString('de-AT');
  let timer = [];
  knopf?.addEventListener('click', async () => {
    timer.forEach(clearTimeout); timer = [];
    const [reisen, gipfel] = await Promise.all([holen('reisen/reisen.json'), holen('gipfel/gipfel.json')]);
    const zeilen = [['cmd', '$ terraform apply'], ['', 'julian: Refreshing state...'], ['', '']];
    let n = 0;
    if (reisen) {
      const r = reisen.reisen || [];
      const l = new Set(r.flatMap((x) => x.laender || []));
      zeilen.push(['plus', `  + resource "reisepass" "julian"   ${r.length} Reisen, ${l.size} Länder`]); n++;
      const p = r.filter((x) => (x.tags || []).includes('camper')).length;
      zeilen.push(['plus', `  + resource "pajero" "bj_1989"     ${p} Reisen, 191.000 km`]); n++;
    }
    if (gipfel) {
      const g = (gipfel.gipfel || []).filter((x) => x.hoehe != null).sort((a, b) => b.hoehe - a.hoehe);
      zeilen.push(['plus', `  + resource "gipfelbuch" "julian"  ${gipfel.gipfel.length} Gipfel, max. ${zahl(g[0].hoehe)} m`]); n++;
    }
    zeilen.push(['plus', '  + resource "kaffee" "flat_white"  Menge: nach Gefühl']); n++;
    zeilen.push(['', ''], ['', `Plan: ${n} to add, 0 to change, 0 to destroy.`], ['ok', `Apply complete! Resources: ${n} added. Urlaubsreif: true.`]);
    term.hidden = false;
    term.textContent = '';
    zeilen.forEach(([klasse, text], k) => {
      const zeige = () => {
        const z = document.createElement('span');
        z.className = `tz ${klasse}`;
        z.textContent = `${text}\n`;
        term.appendChild(z);
      };
      if (ruhig) zeige(); else timer.push(setTimeout(zeige, k * 220));
    });
  });

  // Konami-Code: der Pajero fährt einmal über die Seite
  const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let pos = 0;
  const auto = document.getElementById('konami');
  document.addEventListener('keydown', (e) => {
    const taste = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = taste === CODE[pos] ? pos + 1 : (taste === CODE[0] ? 1 : 0);
    if (pos === CODE.length) {
      pos = 0;
      auto.classList.remove('faehrt');
      void auto.offsetWidth;
      auto.classList.add('faehrt');
    }
  });
})();
