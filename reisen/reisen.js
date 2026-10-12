// Reisepass: liest reisen.json und zeichnet Datenseite, Karte, Stempel und Wunschliste.
(async function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MONATE = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
    'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MON = ['JÄN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];
  const ANZAHL_LAENDER = 195;
  const TINTEN = ['#2b4a9b', '#b2302d', '#2c7650', '#5d3c8f', '#1d6e7e', '#7a2f2f'];
  const FORMEN = ['kreis', 'rechteck', 'oval', 'achteck'];
  // Farbe je Reisejahr: ein Farbton, alt = hell, neu = dunkel (geprüft auf Kontrast zur Karte)
  const JAHR_RAMPE = ['#d9684f', '#c0473a', '#a33134', '#80222f', '#561525'];
  // Ausschnitte als [lon, lat] links oben / rechts unten
  const VIEWS = { europa: [[-27, 71], [45, 33]] };

  const karte = document.getElementById('karte');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let daten, laender, svgText;
  try {
    [daten, laender, svgText] = await Promise.all([
      fetch('reisen.json', { cache: 'no-cache' }).then((r) => r.json()),
      fetch('laender.json').then((r) => r.json()),
      fetch('welt.svg').then((r) => r.text()),
    ]);
  } catch (e) {
    karte.innerHTML = '<p class="karte-hinweis">Die Reisedaten konnten nicht geladen werden. ' +
      'Lokal die Seite über einen Webserver öffnen, z. B. <code>python3 -m http.server</code>.</p>';
    return;
  }

  const reisen = (daten.reisen || []).slice().sort((a, b) => (b.wann || '').localeCompare(a.wann || ''));
  const wunschliste = daten.wunschliste || [];

  // Hilfsfunktionen
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const name = (iso) => (laender[iso] && laender[iso].name) || iso;
  const flagge = (iso) => iso.length === 2
    ? String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))
    : '';
  const datum = (wann, bis) => {
    if (!wann) return '';
    const [j, m] = wann.split('-');
    const von = m ? `${MONATE[+m - 1]} ${j}` : j;
    if (!bis) return von;
    const [j2, m2] = bis.split('-');
    const nach = m2 ? `${MONATE[+m2 - 1]} ${j2}` : j2;
    return j === j2 && m ? `${MONATE[+m - 1]} bis ${nach}` : `${von} bis ${nach}`;
  };
  const kurzDatum = (wann, bis) => {
    if (!wann) return '';
    const [j, m] = wann.split('-');
    const von = m ? `${MON[+m - 1]} ${j}` : j;
    if (!bis) return von;
    const [j2, m2] = bis.split('-');
    return j === j2 && m && m2 ? `${MON[+m - 1]}–${MON[+m2 - 1]} ${j}` : `${von}–${m2 ? MON[+m2 - 1] + ' ' : ''}${j2}`;
  };
  const hash = (t) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const istCamper = (r) => (r.tags || []).includes('camper');
  // Rundreisen mit dem Auto (Pajero immer) starten und enden am Startort, z. B. Linz.
  // Reisen mit nur einem Ziel bleiben ein einzelner Pin ohne Linie.
  const istAuto = (r) => istCamper(r) || (r.tags || []).some((t) => t === 'auto' || t === 'rundreise');
  const istRundreise = (r) => istAuto(r) && (r.orte || []).filter((o) => o.lat != null).length > 1;
  const start = daten.start;

  // Datenseite
  const besucht = new Set(reisen.flatMap((r) => r.laender || []));
  const orte = new Set(reisen.flatMap((r) => (r.orte || []).map((o) => o.ort)));
  const kontinente = new Set([...besucht].map((l) => laender[l] && laender[l].kontinent).filter(Boolean));
  const camperReisen = reisen.filter(istCamper).length;
  const ersteReise = reisen.length ? reisen[reisen.length - 1].wann : '';
  const felder = [
    ['Länder', 'Countries', `${besucht.size} <small>/ ${ANZAHL_LAENDER}</small>`],
    ['Reisen', 'Trips', reisen.length],
    ['Orte', 'Places', orte.size],
    ['Kontinente', 'Continents', kontinente.size],
    ...(camperReisen ? [['<a href="../camper/">Mit dem Pajero</a>', 'By Pajero', `<a href="../camper/">${camperReisen}</a>`]] : []),
    ['Noch offen', 'Still to go', wunschliste.length],
    ['Erste Reise', 'Date of issue', kurzDatum(ersteReise)],
    ['Gültig bis', 'Date of expiry', 'Immer'],
  ];
  document.getElementById('stats').insertAdjacentHTML('beforeend', felder
    .map(([de, en, wert]) => `<div><dt>${de} <span>${en}</span></dt><dd>${wert}</dd></div>`).join(''));

  // Maschinenlesbare Zone im Fuß
  const mrz = (t) => t.toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE')
    .replace(/[^A-Z0-9]/g, '<').padEnd(44, '<').slice(0, 44);
  document.getElementById('mrz').textContent = [
    mrz('P<AUTHOERBST<<JULIAN'),
    mrz(`${besucht.size}LAENDER<${reisen.length}REISEN<${orte.size}ORTE<${kontinente.size}KONTINENTE`),
  ].join('\n');

  // Jahresfarben
  const jahre = reisen.map((r) => +(r.wann || '').slice(0, 4)).filter(Boolean);
  const jahrMin = Math.min(...jahre), jahrMax = Math.max(...jahre);
  const mische = (a, b, t) => '#' + [1, 3, 5].map((i) => {
    const x = parseInt(a.slice(i, i + 2), 16), y = parseInt(b.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  }).join('');
  const jahrFarbe = (wann) => {
    const t = jahrMax > jahrMin ? (+(wann || '').slice(0, 4) - jahrMin) / (jahrMax - jahrMin) : 1;
    const pos = Math.min(0.9999, Math.max(0, t)) * (JAHR_RAMPE.length - 1), i = Math.floor(pos);
    return mische(JAHR_RAMPE[i], JAHR_RAMPE[i + 1] || JAHR_RAMPE[i], pos - i);
  };
  const legende = document.getElementById('legende-jahre');
  if (legende) {
    legende.querySelector('.verlauf').style.background = `linear-gradient(90deg, ${JAHR_RAMPE.join(', ')})`;
    legende.querySelector('.von').textContent = jahrMin;
    legende.querySelector('.bis').textContent = jahrMax;
  }

  // Karte
  karte.innerHTML = svgText;
  const svg = karte.querySelector('svg');
  const k = +svg.dataset.k, tx = +svg.dataset.tx, ty = +svg.dataset.ty;
  const voll = svg.viewBox.baseVal;
  const welt = [voll.x, voll.y, voll.width, voll.height];
  svg.style.aspectRatio = `${voll.width} / ${voll.height}`;

  // Equal Earth, identisch mit dem Generator der welt.svg
  function projiziere(lon, lat) {
    const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
    const lam = lon * Math.PI / 180, phi = lat * Math.PI / 180;
    const l = Math.asin(M * Math.sin(phi)), l2 = l * l, l6 = l2 * l2 * l2;
    const x = lam * Math.cos(l) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)));
    const y = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2));
    return [tx + k * x, ty - k * y];
  }
  const el = (n, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, n);
    for (const [a, v] of Object.entries(attrs)) node.setAttribute(a, v);
    return node;
  };

  const wunschLaender = new Set(wunschliste.map((w) => w.land).filter((l) => l && !besucht.has(l)));
  svg.querySelectorAll('path[data-iso]').forEach((p) => {
    if (besucht.has(p.dataset.iso)) p.classList.add('besucht');
    else if (wunschLaender.has(p.dataset.iso)) p.classList.add('wunsch');
  });

  const ebene = el('g', { class: 'orte' });
  svg.appendChild(ebene);
  const pins = [];
  let heimat = null;
  reisen.forEach((r, i) => {
    const g = el('g', { class: 'reise', 'data-reise': i, style: `--jahr: ${jahrFarbe(r.wann)}` });
    const punkte = (r.orte || []).filter((o) => o.lat != null && o.lon != null)
      .map((o) => ({ ...o, xy: projiziere(o.lon, o.lat) }));
    const linie = istRundreise(r) && start
      ? [projiziere(start.lon, start.lat), ...punkte.map((p) => p.xy), projiziere(start.lon, start.lat)]
      : punkte.map((p) => p.xy);
    if (linie.length > 1) {
      g.appendChild(el('polyline', { class: 'route', points: linie.map((xy) => xy.join(',')).join(' ') }));
    }
    punkte.forEach((p) => {
      const c = el('circle', { class: 'pin', cx: p.xy[0], cy: p.xy[1], r: 3 });
      const t = el('title');
      t.textContent = `${p.ort}, ${r.titel} (${datum(r.wann, r.bis)})`;
      c.appendChild(t);
      g.appendChild(c);
      pins.push(c);
    });
    ebene.appendChild(g);
  });
  // Startort als kleines Haus, über allen Routen
  if (start && reisen.some(istRundreise)) {
    const [hx, hy] = projiziere(start.lon, start.lat);
    const haus = el('g', { class: 'heimat', transform: `translate(${hx} ${hy})` });
    haus.appendChild(el('path', { d: 'M-4,4 L-4,-1 L0,-4.5 L4,-1 L4,4 Z' }));
    const t = el('title');
    t.textContent = `${start.ort}: Start der Rundreisen`;
    haus.appendChild(t);
    ebene.appendChild(haus);
    heimat = haus;
  }

  const wunschPins = [];
  wunschliste.forEach((w, wi) => {
    if (w.lat == null || w.lon == null) return;
    const [x, y] = projiziere(w.lon, w.lat);
    const c = el('circle', { class: 'pin pin-wunsch', cx: x, cy: y, r: 3 });
    wunschPins[wi] = c;
    const t = el('title');
    t.textContent = `${w.ziel}: will ich hin`;
    c.appendChild(t);
    ebene.appendChild(c);
    pins.push(c);
  });

  const markiere = (i) => {
    svg.classList.toggle('fokus', i != null);
    svg.classList.toggle('rund', i != null && istRundreise(reisen[i]));
    svg.querySelectorAll('.reise').forEach((g) => g.classList.toggle('aktiv', g.dataset.reise === String(i)));
    const iso = i != null ? new Set(reisen[i].laender || []) : new Set();
    svg.querySelectorAll('path[data-iso]').forEach((p) => p.classList.toggle('aktiv', iso.has(p.dataset.iso)));
  };

  // Stempel
  const camperIcon = (x, y) => `<g transform="translate(${x} ${y})">
      <rect x="9" y="-3" width="12" height="3" rx="1"/>
      <path d="M2,11 L2,5 L7,5 L10,1 L22,1 L22,5 L28,6 L28,11 Z"/>
      <circle cx="8" cy="12" r="3"/><circle cx="22" cy="12" r="3"/></g>`;
  const stern = (x, y) => `<path transform="translate(${x} ${y})" d="M0,-7 L2,-2 L7,-2 L3,1 L5,7 L0,3 L-5,7 L-3,1 L-7,-2 L-2,-2 Z"/>`;
  // Titel: passt er nicht in eine Zeile, auf zwei Zeilen umbrechen und notfalls verkleinern
  const titelText = (t, x, y, fs, max) => {
    const zeile = (txt, yy, f) => {
      const breit = txt.length * f * 0.52 > max;
      return `<text x="${x}" y="${yy}" text-anchor="middle" font-size="${f}" font-weight="800" style="font-stretch:75%"${breit ? ` textLength="${max}" lengthAdjust="spacingAndGlyphs"` : ''}>${esc(txt)}</text>`;
    };
    if (t.length * fs * 0.52 <= max || !t.includes(' ')) return zeile(t, y, fs);
    const w = t.split(' ');
    let best = 1, diff = Infinity;
    for (let n = 1; n < w.length; n++) {
      const d = Math.abs(w.slice(0, n).join(' ').length - w.slice(n).join(' ').length);
      if (d < diff) { diff = d; best = n; }
    }
    const a = w.slice(0, best).join(' '), b = w.slice(best).join(' ');
    const f = Math.min(fs * 0.72, max / (Math.max(a.length, b.length) * 0.52));
    return zeile(a, y - f * 0.55, f) + zeile(b, y + f * 0.6, f);
  };

  function stempelSvg(r, i) {
    const h = hash(r.titel + r.wann);
    const form = FORMEN[h % FORMEN.length];
    const ls = r.laender || [];
    // Heißt die Reise wie das Land, steht statt des Landes "Einreise" auf dem Stempel
    const land = ls.length === 1 ? (name(ls[0]) === r.titel ? 'Einreise · Entry' : name(ls[0])) : ls.join(' · ');
    const d = kurzDatum(r.wann, r.bis);
    const titel = r.titel;
    const icon = istCamper(r);
    let inhalt = '';
    if (form === 'kreis') {
      inhalt = `
        <circle class="linie" cx="100" cy="100" r="92" stroke-width="5"/>
        <circle class="linie" cx="100" cy="100" r="74" stroke-width="1.6"/>
        <path id="o${i}" d="M23,100 A77,77 0 0 1 177,100" fill="none"/>
        <path id="u${i}" d="M11,100 A89,89 0 0 0 189,100" fill="none"/>
        <text font-size="13" font-weight="700" letter-spacing="2"><textPath href="#o${i}" startOffset="50%" text-anchor="middle">${esc(land)}</textPath></text>
        <text font-size="13" font-weight="600" letter-spacing="2"><textPath href="#u${i}" startOffset="50%" text-anchor="middle">${esc(d)}</textPath></text>
        ${titelText(titel, 100, 108, 26, 118)}
        ${icon ? camperIcon(85, 120) : stern(100, 132)}`;
    } else if (form === 'rechteck') {
      inhalt = `
        <rect class="linie" x="8" y="34" width="184" height="132" rx="10" stroke-width="5"/>
        <rect class="linie" x="19" y="45" width="162" height="110" rx="4" stroke-width="1.6"/>
        <text x="32" y="68" font-size="11" font-weight="600" letter-spacing="2">Einreise</text>
        ${icon ? camperIcon(140, 56) : stern(162, 64)}
        ${titelText(titel, 100, 104, 26, 140)}
        <line class="linie" x1="32" y1="119" x2="168" y2="119" stroke-width="1.6"/>
        <text x="100" y="136" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="1.5"${land.length > 18 ? ' textLength="132" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(land)}</text>
        <text x="100" y="150" text-anchor="middle" font-size="11" font-weight="600" letter-spacing="2">${esc(d)}</text>`;
    } else if (form === 'oval') {
      inhalt = `
        <ellipse class="linie" cx="100" cy="100" rx="94" ry="66" stroke-width="5"/>
        <ellipse class="linie" cx="100" cy="100" rx="81" ry="53" stroke-width="1.6"/>
        <text x="100" y="76" text-anchor="middle" font-size="12" font-weight="700" letter-spacing="2"${land.length > 16 ? ' textLength="120" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(land)}</text>
        ${titelText(titel, 100, 107, 24, 128)}
        <text x="100" y="128" text-anchor="middle" font-size="12" font-weight="600" letter-spacing="2">${esc(d)}</text>
        ${icon ? camperIcon(85, 134) : ''}`;
    } else {
      const ecke = (rad) => Array.from({ length: 8 }, (_, n) => {
        const a = Math.PI / 8 + n * Math.PI / 4;
        return `${(100 + rad * Math.cos(a)).toFixed(1)},${(100 + rad * Math.sin(a)).toFixed(1)}`;
      }).join(' ');
      const codes = ls.join(' ');
      inhalt = `
        <polygon class="linie" points="${ecke(94)}" stroke-width="5"/>
        <polygon class="linie" points="${ecke(80)}" stroke-width="1.6"/>
        ${icon ? camperIcon(85, 40) : stern(100, 50)}
        <text x="100" y="${ls.length > 2 ? 100 : 106}" text-anchor="middle" font-size="${ls.length > 2 ? 26 : 44}" font-weight="800" style="font-stretch:80%">${esc(codes)}</text>
        ${titelText(titel, 100, 132, 15, 110)}
        <text x="100" y="152" text-anchor="middle" font-size="12" font-weight="600" letter-spacing="2">${esc(d)}</text>`;
    }
    return `<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false"><g class="tinte">${inhalt}</g></svg>`;
  }

  const stempelListe = document.getElementById('stempel');
  reisen.forEach((r, i) => {
    const h = hash(r.titel + r.wann);
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stempel';
    btn.dataset.reise = i;
    btn.setAttribute('aria-label', `${r.titel}, ${datum(r.wann, r.bis)}`);
    btn.style.setProperty('--farbe', TINTEN[(h >> 3) % TINTEN.length]);
    btn.style.setProperty('--dreh', `${((h >> 5) % 21) - 10}deg`);
    btn.style.setProperty('--dx', `${((h >> 9) % 13) - 6}px`);
    btn.style.setProperty('--dy', `${((h >> 13) % 13) - 6}px`);
    btn.style.setProperty('--gross', (0.92 + ((h >> 17) % 13) / 100).toFixed(2));
    btn.style.setProperty('--i', reisen.length - 1 - i);
    btn.innerHTML = stempelSvg(r, i);
    btn.addEventListener('mouseenter', () => markiere(i));
    btn.addEventListener('focus', () => markiere(i));
    btn.addEventListener('mouseleave', () => markiere(null));
    btn.addEventListener('blur', () => markiere(null));
    btn.addEventListener('click', () => zeige(r));
    li.appendChild(btn);
    stempelListe.appendChild(li);
  });
  // Aufstempeln erst, wenn die Stempelseite ins Bild kommt
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) { stempelListe.classList.add('los'); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(stempelListe);
  }

  // Detailansicht
  const dialog = document.getElementById('reise-dialog');
  const fotos = (r) => (r.fotos || []).map((f) => (typeof f === 'string' ? { datei: f } : f));
  function zeige(r) {
    const ortNamen = (r.orte || []).map((o) => o.ort);
    const zeigeOrte = ortNamen.length && !(ortNamen.length === 1 && ortNamen[0] === r.titel);
    dialog.querySelector('.dialog-inhalt').innerHTML = `
      <h3 id="dialog-titel">${esc(r.titel)}</h3>
      <time datetime="${esc(r.wann || '')}">${datum(r.wann, r.bis)}</time>
      <p class="zeile laender">${(r.laender || []).map((l) => `<span><span aria-hidden="true">${flagge(l)}</span> ${esc(name(l))}</span>`).join('')}</p>
      ${zeigeOrte ? `<p class="zeile route-text">${ortNamen.map(esc).join(ortNamen.length > 1 ? ' → ' : ', ')}</p>` : ''}
      ${r.notiz ? `<p class="zeile">${esc(r.notiz)}</p>` : ''}
      ${istCamper(r) ? '<a class="camper-link" href="../camper/">Mit dem Pajero</a>' : ''}
      ${fotos(r).length ? `<div class="dialog-fotos">${fotos(r).map((f) => `<img src="${esc(f.datei)}" alt="${esc(f.text || r.titel)}" loading="lazy">`).join('')}</div>` : ''}`;
    dialog.showModal();
  }
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('.schliessen')) dialog.close();
  });

  // Wunschliste
  const wunsch = document.getElementById('wunsch');
  wunsch.innerHTML = wunschliste.length
    ? wunschliste.map((w, wi) => `<li data-wunsch="${wi}">${esc(w.ziel)}${w.land ? `<br>${flagge(w.land)}` : ''}</li>`).join('')
    : '<li class="leer">Noch kein Visum beantragt. Vorschläge gern per Mail.</li>';

  // Ausschnitt Welt/Europa
  const box = (view) => {
    if (view === 'welt') return welt;
    const [[lon0, lat0], [lon1, lat1]] = VIEWS[view];
    const [x0] = projiziere(lon0, (lat0 + lat1) / 2), [, y0] = projiziere((lon0 + lon1) / 2, lat0);
    const [x1] = projiziere(lon1, (lat0 + lat1) / 2), [, y1] = projiziere((lon0 + lon1) / 2, lat1);
    return [x0, y0, x1 - x0, y1 - y0];
  };
  const setzeBox = (b) => {
    svg.setAttribute('viewBox', b.join(' '));
    const r = 3.2 * b[2] / welt[2] + 0.4 * (1 - b[2] / welt[2]);
    pins.forEach((c) => c.setAttribute('r', r.toFixed(2)));
    if (heimat) {
      const [hx, hy] = projiziere(start.lon, start.lat);
      heimat.setAttribute('transform', `translate(${hx} ${hy}) scale(${(r / 3.2).toFixed(3)})`);
    }
  };
  let aktuell = welt;
  const gehe = (ziel) => {
    if (reduceMotion) { setzeBox(ziel); aktuell = ziel; return; }
    const start = aktuell, dauer = 450;
    let t0 = null;
    const schritt = (t) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, Math.max(0, (t - t0) / dauer)), e = 1 - Math.pow(1 - p, 3);
      setzeBox(start.map((v, i) => v + (ziel[i] - v) * e));
      if (p < 1) requestAnimationFrame(schritt);
    };
    aktuell = ziel;
    requestAnimationFrame(schritt);
  };
  document.querySelectorAll('.karte-tools button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.karte-tools button').forEach((b) => b.setAttribute('aria-pressed', b === btn));
      gehe(box(btn.dataset.view));
    });
  });
  setzeBox(welt);

  // Nächstes Ziel würfeln: Namen rattern durch, dann knallt der Visum-Stempel drauf
  const wuerfelKnopf = document.getElementById('wuerfeln');
  const ergebnis = document.getElementById('ziel-ergebnis');
  if (wuerfelKnopf && wunschliste.length) {
    wuerfelKnopf.hidden = false;
    let zuletzt = -1;
    wuerfelKnopf.addEventListener('click', () => {
      wuerfelKnopf.disabled = true;
      wunsch.querySelectorAll('li').forEach((li) => li.classList.remove('erteilt', 'flackert'));
      wunschPins.forEach((c) => c && c.classList.remove('ziel'));
      let wahl;
      do { wahl = Math.floor(Math.random() * wunschliste.length); } while (wunschliste.length > 1 && wahl === zuletzt);
      zuletzt = wahl;
      const runden = reduceMotion ? 0 : 14;
      let n = 0;
      const tick = () => {
        const i = n < runden ? Math.floor(Math.random() * wunschliste.length) : wahl;
        wunsch.querySelectorAll('li').forEach((li) => li.classList.toggle('flackert', +li.dataset.wunsch === i && n < runden));
        ergebnis.textContent = wunschliste[i].ziel;
        if (n++ < runden) { setTimeout(tick, 50 + n * 9); return; }
        const li = wunsch.querySelector(`[data-wunsch="${wahl}"]`);
        li.classList.add('erteilt');
        ergebnis.innerHTML = `Nächstes Ziel: <strong>${esc(wunschliste[wahl].ziel)}</strong> <button type="button" class="zur-karte">Auf der Karte zeigen</button>`;
        ergebnis.querySelector('.zur-karte').addEventListener('click', () => {
          const w = wunschliste[wahl];
          const [x, y] = projiziere(w.lon, w.lat);
          const bw = 140, bh = bw * welt[3] / welt[2];
          document.querySelectorAll('.karte-tools button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
          karte.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
          gehe([x - bw / 2, y - bh / 2, bw, bh]);
          wunschPins[wahl]?.classList.add('ziel');
        });
        wuerfelKnopf.disabled = false;
        wuerfelKnopf.textContent = 'Nochmal würfeln';
      };
      tick();
    });
  }
})();
