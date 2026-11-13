/**
 * @file
 * Concept C: research-grade whale telemetry viewer (polar stereographic SVG).
 */
(function (Drupal, once) {
  const NS = 'http://www.w3.org/2000/svg';
  const GOOD_LC = new Set(['3', '2', '1']);
  const iso = (d) => d.toISOString().slice(0, 16).replace('T', ' ') + 'Z';
  const el = (name, attrs = {}, parent) => {
    const n = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (parent) parent.append(n);
    return n;
  };

  function init(root) {
    const W = window.IaatoWhales;
    const { esc } = W;
    const svg = root.querySelector('svg');
    const find = (s) => root.querySelector(s);
    const P = (lat, lon) => W.polar(lat, lon, 0);
    const state = { t: Infinity, circumpolar: false, goodOnly: false, hidden: new Set() };

    W.load(root.dataset.src).then(({ meta, whales }) => {
      const all = whales.flatMap((w) => w.fixes);
      const t0 = Math.min(...all.map((f) => f.t)), t1 = Math.max(...all.map((f) => f.t));
      state.t = t1;
      find('.whale-sci__meta').innerHTML = `<mark>${meta.source ? 'SYNTHETIC' : 'DATA'}</mark> ${whales.length} individuals · ${all.length} fixes · ${iso(new Date(t0))} → ${iso(new Date(t1))} · CRS ${esc(meta.crs || 'EPSG:4326')} · Argos LC filter ${'{3,2,1,0,A,B}'}`;

      // Extent: either circumpolar to 45°S or fitted to the data.
      const fitted = (() => {
        const pts = all.map((f) => P(f.lat, f.lon));
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 * 1.12;
        return [cx - half, cy - half, half * 2];
      })();
      const R45 = Math.tan(Math.PI / 4 - Math.PI / 8);
      const circ = [-R45 * 1.08, -R45 * 1.08, R45 * 2.16];

      const drawStatic = (ext) => {
        const s = ext[2];
        const grat = find('.whale-sci__graticule'); grat.replaceChildren();
        for (let lat = -80; lat >= -45; lat += 5) {
          const r = Math.tan(Math.PI / 4 + (lat * Math.PI) / 360);
          el('circle', { r, 'stroke-dasharray': lat % 10 ? '2 3' : '' }, grat);
          if (lat % 10 === 0) { const t = el('text', { x: 0.004 * s, y: -r - 0.006 * s, 'font-size': 0.022 * s }, grat); t.textContent = `${-lat}°S`; }
        }
        for (let lon = -180; lon < 180; lon += 30) {
          const [x1, y1] = P(-85, lon), [x2, y2] = P(-40, lon);
          el('line', { x1, y1, x2, y2 }, grat);
          const [lx, ly] = P(lat2label(ext), lon);
          const t = el('text', { x: lx, y: ly, 'font-size': 0.022 * s, 'text-anchor': 'middle' }, grat);
          t.textContent = lon === 0 ? '0°' : lon === -180 ? '180°' : `${Math.abs(lon)}°${lon < 0 ? 'W' : 'E'}`;
        }
        const coast = find('.whale-sci__coast'); coast.replaceChildren();
        el('path', { d: W.coast.map(([lon, lat], i) => (i ? 'L' : 'M') + P(lat, lon).join(' ')).join('') + 'Z' }, coast);
        svg.setAttribute('viewBox', [ext[0], ext[1], ext[2], ext[2]].join(' '));
        state.scale = s;
      };
      // Put meridian labels just inside the visible frame.
      const lat2label = (ext) => (ext === circ ? -46.5 : -52);

      const colour = (i) => W.palette[i % W.palette.length];
      const visibleFixes = (w) => w.fixes.filter((f) => f.t <= state.t && (!state.goodOnly || GOOD_LC.has(String(f.lc))));

      const drawTracks = () => {
        const tracks = find('.whale-sci__tracks'), heads = find('.whale-sci__heads');
        tracks.replaceChildren(); heads.replaceChildren();
        const r = state.scale * 0.0035;
        whales.forEach((w, i) => {
          if (state.hidden.has(w.id)) return;
          const f = visibleFixes(w);
          if (!f.length) return;
          const c = colour(i);
          el('path', { d: f.map((p, j) => (j ? 'L' : 'M') + P(p.lat, p.lon).join(' ')).join(''), stroke: c }, tracks);
          f.forEach((p) => {
            const [x, y] = P(p.lat, p.lon);
            const dot = el('circle', { cx: x, cy: y, r: GOOD_LC.has(String(p.lc)) ? r : r * 0.7, fill: c, 'fill-opacity': GOOD_LC.has(String(p.lc)) ? 0.9 : 0.35 }, tracks);
            el('title', {}, dot).textContent = `${w.id} ${iso(p.t)}\n${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}  LC ${p.lc}`;
          });
          const pos = W.positionAt(f, state.t) || f[f.length - 1];
          const [hx, hy] = P(pos.lat, pos.lon);
          el('title', {}, el('circle', { cx: hx, cy: hy, r: r * 2.6, fill: c }, heads)).textContent = `${w.id} (${w.name}) @ t`;
        });
        find('.whale-sci__t').textContent = iso(new Date(state.t));
      };

      const tbody = find('.whale-sci__table tbody');
      const drawTable = () => {
        tbody.replaceChildren();
        whales.forEach((w, i) => {
          const f = visibleFixes(w);
          const km = W.trackKm(f);
          const hrs = f.length > 1 ? (f[f.length - 1].t - f[0].t) / 36e5 : 0;
          const tr = document.createElement('tr');
          tr.classList.toggle('is-off', state.hidden.has(w.id));
          tr.innerHTML = `<td><input type="checkbox" ${state.hidden.has(w.id) ? '' : 'checked'} style="--c:${colour(i)}" aria-label="Show ${esc(w.id)}"></td><td>${esc(w.id)}<br><small>PTT ${esc(w.ptt ?? '–')} · ${esc(w.sex || '?')}</small></td><td><em>${esc(w.species)}</em><small>${esc(w.commonName)}</small></td><td class="n">${f.length}</td><td class="n">${(hrs / 24).toFixed(1)}</td><td class="n">${km.toFixed(0)}</td><td class="n">${hrs ? (km / hrs).toFixed(2) : '–'}</td>`;
          tr.querySelector('input').addEventListener('change', (e) => { e.target.checked ? state.hidden.delete(w.id) : state.hidden.add(w.id); render(); });
          tbody.append(tr);
        });
      };
      const render = () => { drawTracks(); drawTable(); };

      drawStatic(fitted);
      render();

      const slider = find('.whale-sci__slider');
      slider.addEventListener('input', () => { state.t = t0 + (slider.value / 1000) * (t1 - t0); render(); });
      find('.whale-sci__lcfilter').addEventListener('change', (e) => { state.goodOnly = e.target.checked; render(); });
      find('.whale-sci__extent').addEventListener('click', (e) => {
        state.circumpolar = !state.circumpolar;
        e.currentTarget.setAttribute('aria-pressed', String(state.circumpolar));
        drawStatic(state.circumpolar ? circ : fitted); render();
      });
      let timer = null;
      find('.whale-sci__playbtn').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        if (timer) { clearInterval(timer); timer = null; btn.textContent = '▶ ' + Drupal.t('Play'); return; }
        if (+slider.value >= 1000) slider.value = 0;
        btn.textContent = '❚❚ ' + Drupal.t('Pause');
        timer = setInterval(() => {
          slider.value = Math.min(1000, +slider.value + 4);
          slider.dispatchEvent(new Event('input'));
          if (+slider.value >= 1000) btn.click();
        }, 40);
      });
      find('.whale-sci__csv').addEventListener('click', () => {
        const rows = [['individual_id', 'ptt', 'species', 'timestamp_utc', 'lat', 'lon', 'argos_lc']];
        whales.forEach((w) => visibleFixes(w).forEach((f) => rows.push([w.id, w.ptt ?? '', w.species, f.t.toISOString(), f.lat, f.lon, f.lc ?? ''])));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
        a.download = 'whale-tracks.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }).catch((e) => { find('.whale-sci__meta').textContent = `Data error: ${e.message}`; });
  }

  Drupal.behaviors.iaatoWhaleScience = {
    attach(context) { once('iaato-whale-science', '.whale-sci', context).forEach(init); },
  };
})(Drupal, once);
