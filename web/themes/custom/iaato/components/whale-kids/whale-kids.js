/**
 * @file
 * Concept B: kindergarten whale tracker.
 *
 * Views: "peninsula" (zoomed close-up) or "circumpolar" (whole continent).
 * Whales swim along their tracks, trails draw in behind them, and the trip loops.
 */
(function (Drupal, once) {
  const NS = 'http://www.w3.org/2000/svg';
  const COLORS = ['#ff6f61', '#6c5ce7', '#00b894', '#fd79a8', '#f39c12', '#0984e3'];
  const FACTS = [
    [/megaptera|humpback/i, 'I sing songs that can last for 20 minutes! 🎵'],
    [/musculus|blue/i, 'I am the BIGGEST animal ever, even bigger than a dinosaur! 🦕'],
    [/bonaerensis|minke/i, 'I like to play hide and seek in the sea ice! 🧊'],
    [/physalus|fin/i, 'I am super fast, like a race car of the ocean! 🏎️'],
    [/eubalaena|right/i, 'I have funny bumpy patches on my head! 🙂'],
    [/orca/i, 'Shh, a secret: I am really a giant dolphin! 🐬'],
  ];
  // Map framing per view. ROT spins the map so the Antarctic Peninsula points up.
  const VIEWS = {
    peninsula: { w: 1000, h: 640, K: 1400, CX: 465, CY: 500, ROT: 60, scale: 0.85 },
    circumpolar: { w: 1000, h: 1000, K: 1120, CX: 500, CY: 500, ROT: 60, scale: 0.75 },
  };
  const LOOP_MS = 40000;
  const HOLD_MS = 2500; // Pause on the last day before looping.

  const fact = (w) => (FACTS.find(([re]) => re.test(w.species + ' ' + w.commonName)) || [, 'I love swimming in cold water! 💙'])[1];
  const el = (name, attrs = {}, parent) => {
    const n = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (parent) parent.append(n);
    return n;
  };
  const text = (parent, x, y, str, attrs = {}) => { const t = el('text', { x, y, ...attrs }, parent); t.textContent = str; return t; };

  function init(root) {
    const W = window.IaatoWhales;
    const { esc } = W;
    const V = VIEWS[root.dataset.view] || VIEWS.peninsula;
    const svg = root.querySelector('svg');
    svg.setAttribute('viewBox', `0 0 ${V.w} ${V.h}`);
    root.querySelectorAll('.wk-sea').forEach((r) => { r.setAttribute('width', V.w); r.setAttribute('height', V.h); r.setAttribute('rx', V.h > 700 ? V.w / 2 : 40); });

    const xy = (lat, lon) => { const [x, y] = W.polar(lat, lon, V.ROT); return [V.CX + x * V.K, V.CY + y * V.K]; };
    const pathOf = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
    const radius = (lat) => Math.tan(Math.PI / 4 + (lat * Math.PI) / 360) * V.K;

    // Circumpolar extras: playful latitude rings and ocean label.
    if (root.dataset.view === 'circumpolar') {
      const rings = root.querySelector('.whale-kids__rings');
      [[-60, 'chilly'], [-50, 'cool']].forEach(([lat, word]) => {
        el('circle', { cx: V.CX, cy: V.CY, r: radius(lat) }, rings);
        text(rings, V.CX + radius(lat) * 0.72, V.CY + radius(lat) * 0.72, word, { 'text-anchor': 'middle' });
      });
      text(rings, V.CX, V.CY + radius(-48), 'SOUTHERN OCEAN', { 'text-anchor': 'middle', class: 'wk-ocean' });
      const [ax, ay] = xy(-47, -65);
      text(rings, ax, ay, '⬆ to South America', { 'text-anchor': 'middle' });
    }

    // Land, South Pole and decorations.
    const land = root.querySelector('.whale-kids__land');
    el('path', { d: pathOf(W.coast.map(([lon, lat]) => xy(lat, lon))) + 'Z', filter: 'url(#wk-soft)' }, land);
    const [px, py] = xy(-90, 0);
    text(land, px - 18, py + 10, '🚩');
    text(land, px, py + 40, 'SOUTH POLE', { 'text-anchor': 'middle', class: 'whale-kids__label' });
    [[-72, 10], [-75, 100], [-80, -120], [-70, -70], [-74, 150]].forEach(([lat, lon]) => { const [x, y] = xy(lat, lon); text(land, x, y, '🐧'); });
    [[-58, -10, '🧊'], [-62, 120, '🧊'], [-57, 60, '🧊'], [-55, -100, '⛵'], [-60, -150, '🧊']].forEach(([lat, lon, e]) => { const [x, y] = xy(lat, lon); text(land, x, y, e); });

    const playBtn = root.querySelector('.whale-kids__play');
    const scrub = root.querySelector('.whale-kids__scrub');
    const dayLabel = root.querySelector('.whale-kids__day-label');
    const bubble = root.querySelector('.whale-kids__bubble');
    const friends = root.querySelector('.whale-kids__friends');
    let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;

    W.load(root.dataset.src).then(({ whales }) => {
      const t0 = Math.min(...whales.map((w) => w.fixes[0].t));
      const t1 = Math.max(...whales.map((w) => w.fixes[w.fixes.length - 1].t));
      const totalDays = Math.ceil((t1 - t0) / 864e5) + 1;
      let clock = 0, last = performance.now();

      const sprites = whales.map((w, i) => {
        const c = COLORS[i % COLORS.length];
        const pts = w.fixes.map((f) => ({ t: +f.t, p: xy(f.lat, f.lon) }));
        const trail = el('path', { stroke: c }, root.querySelector('.whale-kids__trails'));
        const g = el('g', { class: 'whale-kids__whale', tabindex: '0', role: 'button', 'aria-label': `${w.name} the ${w.commonName}` }, root.querySelector('.whale-kids__whales'));
        const flip = el('g', {}, g);
        el('path', { class: 'wk-body', fill: c, d: 'M-30 4c0-14 14-22 30-22 14 0 24 8 27 16l12-10c4 0 4 4 2 8l-6 10 6 10c2 4-2 6-4 4l-10-8c-4 10-14 16-27 16-16 0-30-8-30-24z' }, flip);
        el('path', { fill: '#fff', opacity: '.85', d: 'M-26 10c8 8 26 10 40 4-6 10-34 10-40-4z' }, flip);
        el('circle', { cx: -14, cy: -2, r: 4, fill: '#263159' }, flip);
        el('circle', { cx: -12.5, cy: -3.5, r: 1.4, fill: '#fff' }, flip);
        el('path', { d: 'M-22 8q6 6 12 0', stroke: '#263159', 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round' }, flip);
        el('circle', { cx: -6, cy: 6, r: 4, fill: '#ff9aa2', opacity: '.7' }, flip);
        const sp = el('g', { class: 'wk-spout' }, g);
        el('path', { d: 'M0-20c-6-10-14-12-18-8M0-20c6-10 14-12 18-8M0-20v-16', stroke: '#9be7ff', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }, sp);
        text(g, 0, 46, w.name, { class: 'wk-name', 'text-anchor': 'middle' });

        const say = () => {
          const km = Math.round(W.trackKm(w.fixes));
          const buses = Math.round((km * 1000) / 12 / 1000) * 1000;
          bubble.style.setProperty('--c', c);
          bubble.innerHTML = `<button type="button" aria-label="${Drupal.t('Close')}">✖️</button><strong>Hi! I'm ${esc(w.name)}!</strong><br>I'm a ${esc(w.commonName.toLowerCase())}. ${fact(w)}<br>I swam <b>${km.toLocaleString()} km</b>. That's as long as <b>${buses.toLocaleString()}</b> school buses in a row! 🚌`;
          bubble.hidden = false;
          bubble.querySelector('button').onclick = () => { bubble.hidden = true; friends.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false')); };
          g.classList.remove('is-happy'); void g.getBBox(); g.classList.add('is-happy');
          friends.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === w.id)));
        };
        g.addEventListener('click', say);
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); say(); } });

        const li = document.createElement('li');
        li.innerHTML = `<button type="button" aria-pressed="false" data-id="${esc(w.id)}" style="--c:${c}"><span class="wk-face" aria-hidden="true">🐳</span>${esc(w.name)}</button>`;
        li.querySelector('button').addEventListener('click', say);
        friends.append(li);
        return { w, pts, trail, g, flip, lastX: null };
      });

      const draw = () => {
        const t = t0 + Math.min(1, clock / LOOP_MS) * (t1 - t0);
        const day = Math.min(totalDays, Math.floor((t - t0) / 864e5) + 1);
        dayLabel.textContent = Drupal.t('Day @n of @total', { '@n': day, '@total': totalDays });
        scrub.value = Math.round(Math.min(1, clock / LOOP_MS) * 1000);
        scrub.setAttribute('aria-valuetext', dayLabel.textContent);
        sprites.forEach((s) => {
          const f = s.w.fixes;
          const p = W.positionAt(f, t) || (t < f[0].t ? f[0] : f[f.length - 1]);
          const [x, y] = xy(p.lat, p.lon);
          // Trail grows from the tag site to where the whale is now.
          const seen = s.pts.filter((q) => q.t <= t).map((q) => q.p);
          s.trail.setAttribute('d', seen.length ? pathOf([...seen, [x, y]]) : '');
          s.g.style.opacity = t < f[0].t ? 0.35 : 1; // Not tagged yet: faded.
          const bob = Math.sin((performance.now() / 400) + x) * 3;
          if (s.lastX !== null && Math.abs(x - s.lastX) > 0.05) s.flip.setAttribute('transform', x > s.lastX ? 'scale(-1,1)' : '');
          s.lastX = x;
          s.g.setAttribute('transform', `translate(${x.toFixed(1)} ${(y + bob).toFixed(1)}) scale(${V.scale})`);
        });
      };
      const tick = (now) => {
        if (playing) {
          clock += now - last;
          if (clock > LOOP_MS + HOLD_MS) clock = 0; // Loop back to day 1.
        }
        last = now;
        draw();
        requestAnimationFrame(tick);
      };
      const setPlaying = (on) => {
        playing = on;
        playBtn.setAttribute('aria-pressed', String(on));
        playBtn.firstElementChild.textContent = on ? '⏸️' : '▶️';
        playBtn.querySelector('.whale-kids__play-label').textContent = on ? Drupal.t('Pause') : Drupal.t('Swim!');
      };
      playBtn.addEventListener('click', () => setPlaying(!playing));
      scrub.addEventListener('input', () => { setPlaying(false); clock = (scrub.value / 1000) * LOOP_MS; });
      setPlaying(playing);
      requestAnimationFrame(tick);
    });
  }

  Drupal.behaviors.iaatoWhaleKids = {
    attach(context) { once('iaato-whale-kids', '.whale-kids', context).forEach(init); },
  };
})(Drupal, once);
