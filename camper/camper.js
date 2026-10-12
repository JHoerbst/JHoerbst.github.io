// Reisen mit dem Camper-Tag aus reisen.json, dazu eine kleine Karte.
(async function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MONATE = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
    'August', 'September', 'Oktober', 'November', 'Dezember'];
  const karte = document.getElementById('mini-karte');

  let daten, laender, svgText;
  try {
    [daten, laender, svgText] = await Promise.all([
      fetch('../reisen/reisen.json', { cache: 'no-cache' }).then((r) => r.json()),
      fetch('../reisen/laender.json').then((r) => r.json()),
      fetch('../reisen/welt.svg').then((r) => r.text()),
    ]);
  } catch (e) {
    document.getElementById('touren-zahl').textContent =
      'Die Reisen konnten nicht geladen werden. Lokal über einen Webserver öffnen.';
    return;
  }

  const touren = (daten.reisen || [])
    .filter((r) => (r.tags || []).includes('camper'))
    .sort((a, b) => (b.wann || '').localeCompare(a.wann || ''));
  const iso = new Set(touren.flatMap((r) => r.laender || []));
  const datum = (w) => {
    const [j, m] = (w || '').split('-');
    return m ? `${MONATE[+m - 1]} ${j}` : j || '';
  };
  const landName = (l) => (laender[l] && laender[l].name) || l;

  document.getElementById('touren-zahl').textContent =
    `${touren.length} ${touren.length === 1 ? 'Reise' : 'Reisen'} in ${iso.size} ${iso.size === 1 ? 'Land' : 'Ländern'}, und es werden mehr.`;

  document.getElementById('touren').innerHTML = touren.map((r) => `
    <li>
      <strong>${r.titel}</strong>
      <span>${(r.laender || []).map(landName).join(', ')}, ${datum(r.wann)}</span>
    </li>`).join('');

  // Karte: Ausschnitt um die besuchten Länder und Orte
  karte.innerHTML = svgText;
  const svg = karte.querySelector('svg');
  const k = +svg.dataset.k, tx = +svg.dataset.tx, ty = +svg.dataset.ty;
  const projiziere = (lon, lat) => {
    const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
    const lam = lon * Math.PI / 180, phi = lat * Math.PI / 180;
    const l = Math.asin(M * Math.sin(phi)), l2 = l * l, l6 = l2 * l2 * l2;
    return [
      tx + k * lam * Math.cos(l) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))),
      ty - k * l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)),
    ];
  };

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const erweitere = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };

  const ebene = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(ebene);
  const pins = [];
  touren.forEach((r) => (r.orte || []).forEach((o) => {
    if (o.lat == null) return;
    const [x, y] = projiziere(o.lon, o.lat);
    erweitere(x, y);
    pins.push({ x, y, ort: o.ort });
  }));

  // Länder einfärben; den Ausschnitt bestimmen nur die Pins, außer es gibt keine
  svg.querySelectorAll('path[data-iso]').forEach((p) => {
    if (!iso.has(p.dataset.iso)) return;
    p.classList.add('camper');
    if (pins.length) return;
    const b = p.getBBox();
    if (b.width < 80) { erweitere(b.x, b.y); erweitere(b.x + b.width, b.y + b.height); }
  });

  // Rand dazu und auf 16:9 bringen
  let w = Math.max((x1 - x0) * 1.9, 30), h = Math.max((y1 - y0) * 1.9, 17);
  if (w / h > 16 / 9) h = w * 9 / 16; else w = h * 16 / 9;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  svg.setAttribute('viewBox', `${cx - w / 2} ${cy - h / 2} ${w} ${h}`);
  svg.setAttribute('aria-label', 'Karte der Camper-Reisen');

  const r = w / 150, fs = w / 44;
  // Beschriftungen: erste freie Position rechts, links, oben oder unten
  const belegt = pins.map((p) => ({ x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r }));
  const frei = (b) => belegt.every((o) => b.x1 < o.x0 || b.x0 > o.x1 || b.y1 < o.y0 || b.y0 > o.y1);
  pins.forEach((p) => {
    const tw = p.ort.length * fs * 0.62, th = fs, g = r * 1.8;
    const optionen = [
      { x: p.x + g, y: p.y + th * 0.35, anchor: 'start', box: { x0: p.x + g, y0: p.y - th / 2, x1: p.x + g + tw, y1: p.y + th / 2 } },
      { x: p.x - g, y: p.y + th * 0.35, anchor: 'end', box: { x0: p.x - g - tw, y0: p.y - th / 2, x1: p.x - g, y1: p.y + th / 2 } },
      { x: p.x, y: p.y - g - th * 0.2, anchor: 'middle', box: { x0: p.x - tw / 2, y0: p.y - g - th, x1: p.x + tw / 2, y1: p.y - g } },
      { x: p.x, y: p.y + g + th * 0.85, anchor: 'middle', box: { x0: p.x - tw / 2, y0: p.y + g, x1: p.x + tw / 2, y1: p.y + g + th } },
    ];
    const wahl = optionen.find((o) => frei(o.box)) || optionen[0];
    belegt.push(wahl.box);

    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('class', 'pin');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', r);
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('class', 'pin-label');
    t.setAttribute('x', wahl.x); t.setAttribute('y', wahl.y);
    t.setAttribute('text-anchor', wahl.anchor);
    t.setAttribute('font-size', fs);
    t.textContent = p.ort;
    ebene.append(c, t);
  });
})();

// Szene: Dachzelt per Klick oder Tastatur, leichte Parallaxe mit der Maus
(function () {
  const szene = document.getElementById('szene');
  const zelt = document.getElementById('zelt');
  if (!szene || !zelt) return;

  const umschalten = () => {
    const offen = szene.classList.toggle('offen');
    zelt.setAttribute('aria-pressed', offen);
    zelt.setAttribute('aria-label', offen ? 'Dachzelt zuklappen' : 'Dachzelt aufklappen');
  };
  zelt.addEventListener('click', umschalten);
  zelt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); umschalten(); }
  });

  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Tag und Nacht
  const nacht = document.getElementById('nacht');
  nacht?.addEventListener('click', () => {
    const an = szene.classList.toggle('nacht');
    nacht.setAttribute('aria-pressed', an);
    nacht.textContent = an ? 'Tag' : 'Nacht';
  });

  // Kilometerzähler: rollt beim Laden hoch, beim Fahren zählt der Trip mit
  const STAND = 191000;
  const tacho = document.getElementById('tacho');
  const tripEl = document.getElementById('trip');
  let trip = 0;
  const zeigeTacho = (km) => { tacho.textContent = String(Math.floor(km)).padStart(6, '0'); };
  if (ruhig) zeigeTacho(STAND);
  else {
    let t0 = null;
    const hoch = (t) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / 1800);
      zeigeTacho(STAND * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(hoch);
    };
    requestAnimationFrame(hoch);
  }

  // Selber fahren: der Pajero bleibt fast stehen, die Welt zieht endlos vorbei
  const fahrt = szene.querySelector('.auto-fahrt');
  const raeder = szene.querySelectorAll('.rad');
  const NS = 'http://www.w3.org/2000/svg';
  const BW = 1200, BODEN = 392, CW = 600;

  // reproduzierbarer Zufall pro Abschnitt
  const zufall = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rauschen = (i, seed) => zufall(i * 7919 + seed * 104729)();
  // Bergkamm als Funktion von x: Wellen plus Zacken an festen Stützstellen
  const kamm = (x, seed, basis, hub, zacken) => {
    const s = (k) => rauschen(Math.floor(x / k), seed + k);
    const welle = Math.sin(x / 260 + seed) * 0.5 + Math.sin(x / 113 + seed * 2) * 0.3;
    const i = Math.floor(x / zacken), f = x / zacken - i;
    const z = rauschen(i, seed) * (1 - f) + rauschen(i + 1, seed) * f;
    return basis - hub * (0.55 + welle * 0.35 + z * 0.45) + s(997) * 0;
  };
  const svgEl = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };

  const SCHICHTEN = [
    { id: 'schicht-fern', faktor: 0.12, bau: (g, x0) => {
      let d = `M${x0},${BODEN}`;
      for (let x = x0; x <= x0 + CW; x += 30) d += ` L${x},${kamm(x, 11, 300, 150, 90).toFixed(1)}`;
      g.appendChild(svgEl('path', { class: 'berge-fern', d: `${d} L${x0 + CW + 2},${kamm(x0 + CW + 2, 11, 300, 150, 90).toFixed(1)} L${x0 + CW + 2},${BODEN} Z` }));
    } },
    { id: 'schicht-berge', faktor: 0.3, bau: (g, x0) => {
      let d = `M${x0},${BODEN}`;
      for (let x = x0; x <= x0 + CW; x += 24) d += ` L${x},${kamm(x, 23, 345, 85, 120).toFixed(1)}`;
      g.appendChild(svgEl('path', { class: 'berge', d: `${d} L${x0 + CW + 2},${kamm(x0 + CW + 2, 23, 345, 85, 120).toFixed(1)} L${x0 + CW + 2},${BODEN} Z` }));
    } },
    { id: 'schicht-mitte', faktor: 0.6, bau: (g, x0, r) => {
      let x = x0 + r() * 60;
      while (x < x0 + CW - 20) {
        const art = r();
        if (art < 0.12) see(g, x, r); else if (art < 0.22) huette(g, x, r);
        else if (art < 0.27) wegweiser(g, x); else if (art < 0.62) tanne(g, x, r); else baum(g, x, r);
        x += 40 + r() * 110;
      }
    } },
    { id: 'schicht-vorne', faktor: 1, bau: (g, x0, r) => {
      for (let x = x0; x < x0 + CW; x += 150) {
        g.appendChild(svgEl('rect', { class: 'pfosten', x: x + 40, y: BODEN - 26, width: 5, height: 26, rx: 1 }));
        g.appendChild(svgEl('rect', { class: 'pfosten-reflektor', x: x + 40, y: BODEN - 22, width: 5, height: 5 }));
        if (r() < 0.6) g.appendChild(svgEl('path', { class: 'gras', d: `M${x + 95} ${BODEN} l4 -9 l3 9 l4 -12 l3 12` }));
      }
    } },
  ];
  function tanne(g, x, r) {
    const h = 55 + r() * 55, w = h * 0.45;
    g.appendChild(svgEl('rect', { class: 'stamm', x: x - 2.5, y: BODEN - 10, width: 5, height: 10 }));
    g.appendChild(svgEl('polygon', { class: 'tanne', points: `${x},${BODEN - h} ${x + w / 2},${BODEN - 8} ${x - w / 2},${BODEN - 8}` }));
    g.appendChild(svgEl('polygon', { class: 'tanne', points: `${x},${BODEN - h * 0.78} ${x + w * 0.6},${BODEN - h * 0.22} ${x - w * 0.6},${BODEN - h * 0.22}` }));
  }
  function baum(g, x, r) {
    const h = 45 + r() * 35;
    g.appendChild(svgEl('rect', { class: 'stamm', x: x - 3, y: BODEN - h * 0.45, width: 6, height: h * 0.45 }));
    g.appendChild(svgEl('ellipse', { class: 'laub', cx: x, cy: BODEN - h * 0.62, rx: h * 0.33, ry: h * 0.38 }));
  }
  function see(g, x, r) {
    const rx = 55 + r() * 60;
    g.appendChild(svgEl('ellipse', { class: 'see', cx: x + rx, cy: BODEN - 7, rx, ry: 7 + r() * 4 }));
    g.appendChild(svgEl('path', { class: 'see-glanz', d: `M${x + rx * 0.6} ${BODEN - 9} h${rx * 0.5} M${x + rx * 1.1} ${BODEN - 5} h${rx * 0.4}` }));
  }
  function huette(g, x, r) {
    const w = 34 + r() * 14, h = w * 0.6;
    g.appendChild(svgEl('rect', { class: 'huette', x: x - w / 2, y: BODEN - h, width: w, height: h }));
    g.appendChild(svgEl('polygon', { class: 'dach', points: `${x - w / 2 - 5},${BODEN - h} ${x},${BODEN - h - w * 0.45} ${x + w / 2 + 5},${BODEN - h}` }));
    g.appendChild(svgEl('rect', { class: 'fenster', x: x - w / 4 - 3, y: BODEN - h * 0.7, width: 7, height: 7 }));
    g.appendChild(svgEl('rect', { class: 'fenster', x: x + w / 4 - 4, y: BODEN - h * 0.7, width: 7, height: 7 }));
  }
  function wegweiser(g, x) {
    g.appendChild(svgEl('rect', { class: 'pfosten', x: x - 1.5, y: BODEN - 40, width: 3, height: 40 }));
    g.appendChild(svgEl('polygon', { class: 'schild-gelb', points: `${x - 2},${BODEN - 40} ${x + 22},${BODEN - 40} ${x + 28},${BODEN - 35} ${x + 22},${BODEN - 30} ${x - 2},${BODEN - 30}` }));
  }

  const ebenen = SCHICHTEN.map((s, n) => ({ ...s, n, g: document.getElementById(s.id), stuecke: new Map(), neu: true }));
  let welt = 0;
  const zeichneWelt = () => {
    ebenen.forEach((e) => {
      if (e.neu) { e.g.innerHTML = ''; e.neu = false; }
      const off = welt * e.faktor;
      const von = Math.floor(off / CW) - 1, bis = Math.floor((off + BW) / CW) + 1;
      for (let i = von; i <= bis; i++) {
        if (e.stuecke.has(i)) continue;
        const g = svgEl('g', {});
        e.bau(g, i * CW, zufall(i * 31 + e.n * 977 + 5));
        e.g.appendChild(g);
        e.stuecke.set(i, g);
      }
      e.stuecke.forEach((g, i) => { if (i < von - 1 || i > bis + 1) { g.remove(); e.stuecke.delete(i); } });
      e.g.setAttribute('transform', `translate(${(-off).toFixed(1)} 0)`);
    });
  };
  zeichneWelt();

  let v = 0, gas = 0, laeuft = false, winkel = 0, lage = 0;
  const schritt = () => {
    v += gas * 0.55;
    v *= 0.92;
    if (Math.abs(v) < 0.05 && !gas) v = 0;
    welt += v;
    winkel += v / (2 * Math.PI * 52) * 360;
    // das Auto rutscht beim Beschleunigen ein Stück nach vorn bzw. zurück
    lage += ((Math.max(-6, Math.min(6, v)) * 22) - lage) * 0.08;
    fahrt.style.translate = `${lage.toFixed(1)}px 0`;
    raeder.forEach((rad) => { rad.style.rotate = `${winkel.toFixed(1)}deg`; });
    zeichneWelt();
    trip += Math.abs(v) / 120;
    tripEl.textContent = trip.toFixed(1).replace('.', ',');
    zeigeTacho(STAND + trip);
    if (v || gas || Math.abs(lage) > 0.5) requestAnimationFrame(schritt); else laeuft = false;
  };
  const losfahren = (richtung) => {
    gas = richtung;
    if (!laeuft) { laeuft = true; requestAnimationFrame(schritt); }
  };
  const bremsen = () => { gas = 0; };

  szene.querySelectorAll('.pedal').forEach((b) => {
    const richtung = +b.dataset.richtung;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); losfahren(richtung); });
    b.addEventListener('pointerup', bremsen);
    b.addEventListener('pointercancel', bremsen);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); losfahren(richtung); } });
    b.addEventListener('keyup', bremsen);
  });

  // Pfeiltasten nur, solange die Szene im Bild ist
  let sichtbar = false;
  new IntersectionObserver((e) => { sichtbar = e[0].isIntersecting; }, { threshold: 0.4 }).observe(szene);
  addEventListener('keydown', (e) => {
    if (!sichtbar || e.target.closest?.('input, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      losfahren(e.key === 'ArrowRight' ? 1 : -1);
    }
  });
  addEventListener('keyup', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') bremsen(); });
})();

// Fotos groß anzeigen
(function () {
  const dialog = document.getElementById('foto-dialog');
  if (!dialog) return;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.bild');
    if (btn) {
      const img = btn.querySelector('img');
      dialog.querySelector('img').src = img.src;
      dialog.querySelector('img').alt = img.alt;
      dialog.querySelector('figcaption').textContent = btn.dataset.text;
      dialog.showModal();
      return;
    }
    if (e.target === dialog || e.target.closest('.schliessen')) dialog.close();
  });
})();
