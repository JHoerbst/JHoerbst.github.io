// Gipfelbuch: liest gipfel.json und zeichnet Panorama, Einträge, Topo-Karte und Wegweiser.
(async function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const VIEWS = { alpen: [[8.6, 49.6], [17.6, 46.4]] };

  let daten, laender, svgText;
  try {
    [daten, laender, svgText] = await Promise.all([
      fetch('gipfel.json', { cache: 'no-cache' }).then((r) => r.json()),
      fetch('../reisen/laender.json').then((r) => r.json()),
      fetch('../reisen/welt.svg').then((r) => r.text()),
    ]);
  } catch (e) {
    document.getElementById('karte').innerHTML =
      '<p class="karte-hinweis">Die Gipfeldaten konnten nicht geladen werden. Lokal über einen Webserver öffnen.</p>';
    return;
  }

  const gipfel = (daten.gipfel || []).slice()
    .sort((a, b) => (b.hoehe ?? -1) - (a.hoehe ?? -1));
  const wunsch = daten.wunsch || [];
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const zahl = (n) => n.toLocaleString('de-AT');
  const hoeheText = (g) => (g.hoehe == null ? '–' : `${g.ungefaehr ? 'ca. ' : ''}${zahl(g.hoehe)} m`);
  const landName = (iso) => (laender[iso] && laender[iso].name) || iso;
  const flagge = (iso) => String.fromCodePoint(...[...iso].map((c) => 0x1f1a5 + c.charCodeAt(0)));
  const hash = (t) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const ks = (g) => g.art === 'klettersteig';
  // nicht selbst raufgegangen: mit Lift oder mit dem Pajero
  const gefahren = (g) => g.hinauf === 'lift' || g.hinauf === 'pajero';
  const HINAUF = { lift: 'mit Lift', pajero: 'mit dem Pajero' };
  const klasse = (g) => `${ks(g) ? ' klettersteig' : ''}${gefahren(g) ? ' gefahren' : ''}`;
  const el = (n, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, n);
    for (const [a, v] of Object.entries(attrs)) node.setAttribute(a, v);
    return node;
  };

  // Tooltip, geteilt von Panorama und Karte
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  const zeigeTip = (g, x, y) => {
    tip.innerHTML = `<strong>${esc(g.name)}</strong><br>${hoeheText(g)} · ${esc(g.gebiet)}${ks(g) ? ' · Klettersteig' : ''}${gefahren(g) ? ` · ${HINAUF[g.hinauf]}` : ''}`;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2))}px`;
    tip.style.top = `${Math.max(8, y - r.height - 14)}px`;
  };
  const versteckeTip = () => { tip.hidden = true; };
  const tipFuer = (node, g) => {
    node.addEventListener('mousemove', (e) => zeigeTip(g, e.clientX, e.clientY));
    node.addEventListener('mouseleave', versteckeTip);
    node.addEventListener('focus', () => { const r = node.getBoundingClientRect(); zeigeTip(g, r.left + r.width / 2, r.top); });
    node.addEventListener('blur', versteckeTip);
  };

  // ---------- Panorama ----------
  const mitHoehe = gipfel.filter((g) => g.hoehe != null);
  const W = 1000, H = 300, BODEN = 262, MAXH = 215;
  const maxHoehe = Math.max(...mitHoehe.map((g) => g.hoehe));
  const schritt = W / (mitHoehe.length + 1);
  const breite = schritt * 2.1;
  const pano = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group' });
  const ebeneBerge = el('g');
  const ebeneLaender = el('g', { class: 'land-marken' });
  const ebeneWanderer = el('g', { class: 'wanderer', 'aria-hidden': 'true' });
  pano.append(ebeneBerge, el('line', { class: 'boden', x1: 0, y1: BODEN, x2: W, y2: BODEN }), ebeneLaender, ebeneWanderer);
  const P = (pts) => pts.map((p) => p.map((x) => x.toFixed(1)).join(',')).join(' ');

  // Form jedes Bergs relativ zu seiner Mitte (x = 0), damit er sich verschieben lässt
  const formen = new Map();
  mitHoehe.forEach((g) => {
    const h = Math.max(18, (g.hoehe / maxHoehe) * MAXH);
    const v = hash(g.name);
    const s = ((v % 7) - 3) * 0.012;
    const w = breite * (0.75 + (g.hoehe / maxHoehe) * 0.35);
    const pts = [
      [-w / 2, BODEN],
      [-w * (0.22 - s), BODEN - h * 0.62],
      [-w * 0.1, BODEN - h * (0.82 + ((v >> 3) % 5) * 0.02)],
      [-w * 0.045, BODEN - h * 0.9],
      [w * s, BODEN - h],
      [w * 0.1, BODEN - h * 0.84],
      [w * (0.26 + s), BODEN - h * 0.52],
      [w / 2, BODEN],
    ];
    formen.set(g, { pts, spitze: [w * s, BODEN - h] });
  });

  // hohe Berge zuerst zeichnen, damit niedrige davor stehen
  const gruppen = new Map();
  mitHoehe.slice().forEach((g, n) => {
    const { pts, spitze } = formen.get(g);
    const gr = el('g', { class: 'berg-g' });
    const berg = el('polygon', {
      class: `berg${klasse(g)}`,
      points: P(pts),
      tabindex: 0,
      role: 'img',
      'aria-label': `${g.name}, ${hoeheText(g)}`,
      style: `--i: ${mitHoehe.length - n}`,
    });
    tipFuer(berg, g);
    gr.appendChild(berg);
    if (g.hoehe >= 1800) {
      const h = BODEN - spitze[1];
      gr.appendChild(el('polygon', {
        class: 'schnee',
        points: P([spitze, [pts[5][0] * 0.85, BODEN - h * 0.86], [spitze[0] + 2, BODEN - h * 0.87], [pts[3][0], BODEN - h * 0.9], [pts[3][0] - 3, BODEN - h * 0.86]]),
      }));
    }
    if (g === mitHoehe.find((x) => !gefahren(x))) {
      // nur der höchste bekommt eine feste Beschriftung, der Rest kommt per Tooltip
      gr.append(el('line', { class: 'leitlinie', x1: spitze[0], y1: spitze[1] - 4, x2: spitze[0], y2: spitze[1] - 24 }));
      const t = el('text', { class: 'marke', x: spitze[0], y: spitze[1] - 40, 'text-anchor': 'middle', 'font-size': 22 });
      t.textContent = g.name;
      const t2 = el('text', { class: 'marke-hoehe', x: spitze[0], y: spitze[1] - 28, 'text-anchor': 'middle', 'font-size': 10 });
      t2.textContent = hoeheText(g);
      gr.append(t, t2);
    }
    gruppen.set(g, gr);
    ebeneBerge.appendChild(gr);
  });
  document.getElementById('panorama').appendChild(pano);

  // Anordnungen zum Umschalten
  const ANORDNUNG = {
    // Panorama: der höchste zu Fuß in der Mitte, Lift- und Pajero-Gipfel ganz hinten am Rand
    panorama: () => {
      const r = [];
      mitHoehe.filter((g) => !gefahren(g)).forEach((g, i) => (i % 2 ? r.unshift(g) : r.push(g)));
      mitHoehe.filter(gefahren).forEach((g, i) => (i % 2 ? r.unshift(g) : r.push(g)));
      return r;
    },
    hoehe: () => mitHoehe.slice().reverse(),
    land: () => mitHoehe.slice().sort((a, b) => landName(a.land).localeCompare(landName(b.land), 'de') || b.hoehe - a.hoehe),
  };
  const lage = new Map();
  const ordne = (art) => {
    const r = ANORDNUNG[art]();
    r.forEach((g, i) => {
      const cx = schritt * (i + 1);
      lage.set(g, cx);
      gruppen.get(g).style.transform = `translateX(${cx}px)`;
    });
    ebeneLaender.innerHTML = '';
    if (art === 'land') {
      let i = 0;
      while (i < r.length) {
        let j = i;
        while (j + 1 < r.length && r[j + 1].land === r[i].land) j++;
        const x0 = schritt * (i + 1) - schritt * 0.45, x1 = schritt * (j + 1) + schritt * 0.45;
        ebeneLaender.appendChild(el('line', { class: 'land-klammer', x1: x0, y1: BODEN + 8, x2: x1, y2: BODEN + 8 }));
        const t = el('text', { class: 'land-name', x: (x0 + x1) / 2, y: BODEN + 26, 'text-anchor': 'middle', 'font-size': 13 });
        t.textContent = landName(r[i].land);
        ebeneLaender.appendChild(t);
        i = j + 1;
      }
    }
    wanderePfad();
  };

  // ---------- Aufstieg beim Scrollen ----------
  const wanderer = el('g', { class: 'wanderer-figur' });
  wanderer.innerHTML = '<circle cx="0" cy="-13" r="2.4"/><path d="M0 -10.5 V-4.5 M0 -4.5 L-2.8 0 M0 -4.5 L2.6 0 M0 -8.5 L3.2 -6 M3.6 -9 L4.6 0"/><rect x="-3.8" y="-10.6" width="2.6" height="4.4" rx="0.8"/>';
  const kreuz = el('g', { class: 'gipfelkreuz' });
  kreuz.innerHTML = '<path d="M0 0 V-16 M-4.5 -12 H4.5"/><path class="fahne" d="M0 -16 L8 -13.5 L0 -11 Z"/>';
  ebeneWanderer.append(kreuz, wanderer);
  const hoechster = mitHoehe.find((g) => !gefahren(g)) || mitHoehe[0];
  let pfad = [];
  // Skyline: an jeder Stelle der höchste Punkt aller Berge
  const hoeheBei = (x) => {
    let y = BODEN;
    // der Wanderer geht nur über Gipfel, die zu Fuß erreicht wurden
    mitHoehe.filter((g) => !gefahren(g)).forEach((g) => {
      const cx = lage.get(g);
      const pts = formen.get(g).pts.map(([px, py]) => [px + cx, py]).sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < pts.length - 1; k++) {
        const [xa, ya] = pts[k], [xb, yb] = pts[k + 1];
        if (x >= xa && x <= xb && xb > xa) { y = Math.min(y, ya + (yb - ya) * (x - xa) / (xb - xa)); break; }
      }
    });
    return y;
  };
  function wanderePfad() {
    const ziel = lage.get(hoechster) + formen.get(hoechster).spitze[0];
    // Start am Fuß des äußersten Gipfels auf der längeren Seite
    const xs = mitHoehe.filter((g) => !gefahren(g)).flatMap((g) => formen.get(g).pts.map(([px]) => px + lage.get(g)));
    const links = Math.min(...xs), rechts = Math.max(...xs);
    const start = ziel - links > rechts - ziel ? links + 4 : rechts - 4;
    pfad = [];
    for (let k = 0; k <= 160; k++) {
      const x = start + (ziel - start) * (k / 160);
      pfad.push([x, hoeheBei(x)]);
    }
    kreuz.setAttribute('transform', `translate(${ziel} ${formen.get(hoechster).spitze[1]})`);
    gehen();
  }
  const hm = document.getElementById('hoehenmesser');
  function gehen() {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    const [x, y] = pfad[Math.round(p * (pfad.length - 1))] || [0, BODEN];
    wanderer.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    kreuz.classList.toggle('erreicht', p > 0.985);
    if (hm) hm.querySelector('strong').textContent = `${zahl(Math.round(p * hoechster.hoehe))} m`;
  }
  let wartet = false;
  addEventListener('scroll', () => {
    if (wartet) return;
    wartet = true;
    requestAnimationFrame(() => { wartet = false; gehen(); });
  }, { passive: true });
  addEventListener('resize', gehen);

  document.querySelectorAll('.sortierung button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sortierung button').forEach((b) => b.setAttribute('aria-pressed', b === btn));
      ordne(btn.dataset.ordnung);
    });
  });
  ordne('panorama');

  // ---------- Höher oder tiefer? ----------
  const spiel = document.getElementById('spiel');
  if (spiel && mitHoehe.length > 2) {
    const [karteA, karteB] = spiel.querySelectorAll('.spiel-karte');
    const meldung = spiel.querySelector('.spiel-meldung');
    const serieEl = spiel.querySelector('[data-serie]');
    const bestEl = spiel.querySelector('[data-best]');
    const knopfHoeher = spiel.querySelector('[data-tipp="hoeher"]');
    const knopfTiefer = spiel.querySelector('[data-tipp="tiefer"]');
    const knopfWeiter = spiel.querySelector('.spiel-weiter');
    let best = 0;
    try { best = +localStorage.getItem('gipfel-best') || 0; } catch (e) { /* egal */ }
    let serie = 0, a, b;
    const zieh = (ohne) => {
      let x;
      do { x = mitHoehe[Math.floor(Math.random() * mitHoehe.length)]; } while (x === ohne || x.hoehe === ohne?.hoehe);
      return x;
    };
    const zeigeKarte = (k, g, offen) => {
      k.querySelector('.spiel-name').textContent = g.name;
      k.querySelector('.spiel-gebiet').textContent = `${g.gebiet}, ${landName(g.land)}`;
      k.querySelector('.spiel-hoehe').textContent = offen ? `${zahl(g.hoehe)} m` : '? m';
    };
    const runde = () => {
      zeigeKarte(karteA, a, true);
      zeigeKarte(karteB, b, false);
      knopfHoeher.disabled = knopfTiefer.disabled = false;
      knopfWeiter.hidden = true;
      meldung.textContent = `Ist ${b.name} höher oder tiefer als ${a.name}?`;
      serieEl.textContent = serie;
      bestEl.textContent = best;
    };
    const tipp = (richtung) => {
      knopfHoeher.disabled = knopfTiefer.disabled = true;
      zeigeKarte(karteB, b, true);
      const richtig = (richtung === 'hoeher') === (b.hoehe > a.hoehe);
      spiel.classList.remove('richtig', 'falsch');
      void spiel.offsetWidth;
      spiel.classList.add(richtig ? 'richtig' : 'falsch');
      if (richtig) {
        serie++;
        if (serie > best) { best = serie; try { localStorage.setItem('gipfel-best', best); } catch (e) { /* egal */ } }
        meldung.textContent = `Richtig! ${b.name} hat ${zahl(b.hoehe)} m.`;
        knopfWeiter.textContent = 'Weiter';
      } else {
        meldung.textContent = `Knapp daneben: ${b.name} hat ${zahl(b.hoehe)} m. Serie vorbei.`;
        serie = 0;
        knopfWeiter.textContent = 'Nochmal';
      }
      serieEl.textContent = serie;
      bestEl.textContent = best;
      knopfWeiter.hidden = false;
      knopfWeiter.focus();
    };
    knopfHoeher.addEventListener('click', () => tipp('hoeher'));
    knopfTiefer.addEventListener('click', () => tipp('tiefer'));
    knopfWeiter.addEventListener('click', () => {
      if (spiel.classList.contains('richtig')) { a = b; } else { a = zieh(); }
      b = zieh(a);
      spiel.classList.remove('richtig', 'falsch');
      runde();
    });
    a = zieh(); b = zieh(a);
    runde();
  }

  // ---------- Zahlen ----------
  const summe = mitHoehe.filter((g) => !gefahren(g)).reduce((s, g) => s + g.hoehe, 0);
  const laenderSet = new Set(gipfel.map((g) => g.land));
  const zuFuss = gipfel.filter((g) => !gefahren(g));
  const hoechsterGesamt = mitHoehe[0];
  const felder = [
    [zuFuss.length, `Gipfel zu Fuß${gipfel.length > zuFuss.length ? `, dazu ${gipfel.length - zuFuss.length} mit Lift oder Pajero` : ''}`],
    [`${zahl(hoechster.hoehe)} m`, `höchster zu Fuß: ${hoechster.name}`],
    ...(gefahren(hoechsterGesamt) ? [[`${zahl(hoechsterGesamt.hoehe)} m`, `ganz oben, ${HINAUF[hoechsterGesamt.hinauf]}: ${hoechsterGesamt.name}`]] : []),
    [gipfel.filter(ks).length, 'Klettersteige'],
    [laenderSet.size, laenderSet.size === 1 ? 'Land' : 'Länder'],
    [`${zahl(summe)} m`, 'alle Gipfel zu Fuß übereinander gestapelt'],
  ];
  document.getElementById('zahlen').innerHTML = felder
    .map(([w, t]) => `<div><dt>${esc(t)}</dt><dd>${esc(w)}</dd></div>`).join('');

  // ---------- Einträge ----------
  document.getElementById('eintraege').innerHTML = gipfel.map((g) => `
    <li class="eintrag">
      <span class="name">${esc(g.name)}${ks(g) ? '<span class="ks">Klettersteig</span>' : ''}${gefahren(g) ? `<span class="ks ks-${g.hinauf}">${HINAUF[g.hinauf]}</span>` : ''}</span>
      <span class="hoehe">${hoeheText(g)}</span>
      <span class="gebiet">${esc(g.gebiet)} <span class="flagge" aria-hidden="true">${flagge(g.land)}</span><span class="sr"> ${esc(landName(g.land))}</span></span>
      <span class="bemerkung">${g.notiz ? esc(g.notiz) : ''}</span>
    </li>`).join('');

  // ---------- Topo-Karte ----------
  const karte = document.getElementById('karte');
  karte.innerHTML = svgText;
  const svg = karte.querySelector('svg');
  const k = +svg.dataset.k, tx = +svg.dataset.tx, ty = +svg.dataset.ty;
  const voll = svg.viewBox.baseVal;
  const welt = [voll.x, voll.y, voll.width, voll.height];
  const projiziere = (lon, lat) => {
    const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
    const lam = lon * Math.PI / 180, phi = lat * Math.PI / 180;
    const l = Math.asin(M * Math.sin(phi)), l2 = l * l, l6 = l2 * l2 * l2;
    return [
      tx + k * lam * Math.cos(l) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))),
      ty - k * l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)),
    ];
  };

  // Höhenlinien als Muster für Länder mit Gipfeln
  const defs = el('defs');
  const muster = el('pattern', { id: 'hoehenlinien', width: 24, height: 12, patternUnits: 'userSpaceOnUse', patternTransform: 'scale(0.35)' });
  muster.append(
    el('rect', { width: 24, height: 12, fill: '#ece4c8' }),
    el('path', { d: 'M0 6 Q6 1 12 6 T24 6', fill: 'none', stroke: '#c8a77a', 'stroke-width': 0.9 }),
  );
  defs.appendChild(muster);
  svg.prepend(defs);
  svg.querySelectorAll('path[data-iso]').forEach((p) => {
    if (laenderSet.has(p.dataset.iso)) p.classList.add('mit-gipfel');
  });

  const ebeneGipfel = el('g');
  const ebeneKoten = el('g');
  svg.append(ebeneGipfel, ebeneKoten);
  const punkte = gipfel.map((g) => ({ g, xy: projiziere(g.lon, g.lat) }));

  const zeichne = (box) => {
    svg.setAttribute('viewBox', box.join(' '));
    const m = box[2] / welt[2]; // 1 = ganze Welt
    const gr = Math.max(0.35, 4.2 * m);
    muster.setAttribute('patternTransform', `scale(${(0.35 * m).toFixed(4)})`);
    ebeneGipfel.innerHTML = '';
    ebeneKoten.innerHTML = '';
    const belegt = [];
    const frei = (b) => belegt.every((o) => b.x1 < o.x0 || b.x0 > o.x1 || b.y1 < o.y0 || b.y0 > o.y1);
    punkte.forEach(({ g, xy: [x, y] }) => {
      const d = el('path', {
        class: `dreieck${klasse(g)}`,
        d: `M${x},${y - gr} L${x + gr * 0.9},${y + gr * 0.6} L${x - gr * 0.9},${y + gr * 0.6} Z`,
        tabindex: 0,
        role: 'img',
        'aria-label': `${g.name}, ${hoeheText(g)}`,
      });
      tipFuer(d, g);
      ebeneGipfel.appendChild(d);
      belegt.push({ x0: x - gr, y0: y - gr, x1: x + gr, y1: y + gr });
    });
    if (m > 0.2) return; // in der Weltansicht keine Beschriftung
    const fs = box[2] / 70;
    punkte.forEach(({ g, xy: [x, y] }) => {
      const breiteT = (g.name.length * 0.48 + 4) * fs;
      const opt = [
        { x: x + gr * 1.3, a: 'start', b: { x0: x + gr * 1.2, y0: y - fs, x1: x + gr * 1.3 + breiteT, y1: y + fs * 0.9 } },
        { x: x - gr * 1.3, a: 'end', b: { x0: x - gr * 1.3 - breiteT, y0: y - fs, x1: x - gr * 1.2, y1: y + fs * 0.9 } },
      ];
      const wahl = opt.find((o) => frei(o.b));
      if (!wahl) return; // lieber weglassen als überlappen; Tooltip bleibt
      belegt.push(wahl.b);
      const t = el('text', { class: 'kote', x: wahl.x, y: y + fs * 0.35, 'text-anchor': wahl.a, 'font-size': fs, 'stroke-width': fs * 0.25 });
      const n = el('tspan', { class: 'kote-name', 'font-size': fs * 1.35 });
      n.textContent = g.name;
      const h = el('tspan', { dx: fs * 0.4 });
      h.textContent = g.hoehe == null ? '' : zahl(g.hoehe);
      if (wahl.a === 'end') t.append(h, el('tspan'), n); else t.append(n, h);
      if (wahl.a === 'end') { h.removeAttribute('dx'); n.setAttribute('dx', fs * 0.4); }
      ebeneKoten.appendChild(t);
    });
  };
  const box = (view) => {
    if (view === 'welt') return welt;
    const [[lon0, lat0], [lon1, lat1]] = VIEWS[view];
    const [x0, y0] = projiziere(lon0, lat0), [x1, y1] = projiziere(lon1, lat1);
    let b = [x0, y0, x1 - x0, y1 - y0];
    // auf das Seitenverhältnis der Karte bringen
    const soll = welt[2] / welt[3];
    if (b[2] / b[3] < soll) { const nw = b[3] * soll; b = [b[0] - (nw - b[2]) / 2, b[1], nw, b[3]]; }
    else { const nh = b[2] / soll; b = [b[0], b[1] - (nh - b[3]) / 2, b[2], nh]; }
    return b;
  };
  svg.style.aspectRatio = `${welt[2]} / ${welt[3]}`;
  document.querySelectorAll('.karte-tools button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.karte-tools button').forEach((b) => b.setAttribute('aria-pressed', b === btn));
      zeichne(box(btn.dataset.view));
    });
  });
  zeichne(box('alpen'));

  // ---------- Wegweiser ----------
  document.getElementById('wegweiser').innerHTML = wunsch.length
    ? wunsch.map((w) => `<li class="schild"><span>${esc(w.name)}${ks(w) ? ' <span class="schild-ks">Klettersteig</span>' : ''}</span><span class="ziel-hoehe">${w.hoehe ? `${zahl(w.hoehe)} m` : ''}</span></li>`).join('')
    : '<li class="schild leer"><span>Wunschgipfel folgen …</span></li>';
})();
