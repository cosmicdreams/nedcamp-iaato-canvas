/**
 * @file
 * Concept A: Google-Maps-style whale tracker using Leaflet.
 */
(function (Drupal, once) {
  const glyph = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 13c0-3.3 3.6-6 8-6 3.2 0 6 1.4 7.3 3.5L21.5 8v8l-3.7-2.5C16.5 16 13.7 17.5 10.5 17.5c-4.4 0-8-2-8-4.5z"/></svg>';
  const fmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  function init(root) {
    const W = window.IaatoWhales;
    const { esc } = W;
    const frame = root.querySelector('.whale-map__frame');
    const sheet = root.querySelector('.whale-map__sheet');
    const handle = root.querySelector('.whale-map__handle');
    const listEl = root.querySelector('.whale-map__list');

    const map = L.map(root.querySelector('.whale-map__canvas'), { zoomControl: true, worldCopyJump: true }).setView([-63, -50], 3);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 12,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.zoomControl.setPosition('topright');

    handle.addEventListener('click', () => {
      const collapsed = sheet.classList.toggle('is-collapsed');
      handle.setAttribute('aria-expanded', String(!collapsed));
      handle.setAttribute('aria-label', collapsed ? Drupal.t('Expand whale list') : Drupal.t('Collapse whale list'));
    });
    root.querySelector('.whale-map__fullscreen').addEventListener('click', () => {
      document.fullscreenElement ? document.exitFullscreen() : frame.requestFullscreen?.();
      setTimeout(() => map.invalidateSize(), 300);
    });

    W.load(root.dataset.src).then(({ meta, whales }) => {
      root.querySelector('.whale-map__note').textContent = meta.source || '';
      const layers = Object.create(null);
      const all = L.featureGroup().addTo(map);

      const select = (id) => {
        Object.entries(layers).forEach(([k, l]) => {
          const on = k === id;
          l.line.setStyle({ weight: on ? 5 : 2.5, opacity: on ? 1 : 0.45, dashArray: on ? null : '4 6' });
          l.pin.getElement()?.querySelector('.whale-pin')?.classList.toggle('is-active', on);
          l.item.classList.toggle('is-active', on);
          if (on) { l.line.bringToFront(); l.dots.addTo(map); } else { l.dots.remove(); }
        });
        const l = layers[id];
        map.flyToBounds(l.line.getBounds(), { padding: [40, 40], paddingBottomRight: [0, sheet.classList.contains('is-collapsed') ? 40 : sheet.offsetHeight], duration: 0.8 });
        l.pin.openPopup();
      };

      whales.forEach((w, i) => {
        const color = W.palette[i % W.palette.length];
        const ll = w.fixes.map((f) => [f.lat, f.lon]);
        const last = w.fixes[w.fixes.length - 1];
        const km = Math.round(W.trackKm(w.fixes));
        const line = L.polyline(ll, { color, weight: 2.5, opacity: 0.45, dashArray: '4 6' }).addTo(all);
        const dots = L.layerGroup(w.fixes.map((f) => L.circleMarker([f.lat, f.lon], { radius: 2.5, color, weight: 1, fillOpacity: 0.8 })));
        const pin = L.marker([last.lat, last.lon], {
          title: `${w.name}, ${w.commonName}`,
          icon: L.divIcon({ className: '', html: `<div class="whale-pin" style="--c:${color}">${glyph}</div>`, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -16] }),
        }).addTo(all).bindPopup(`<strong>${esc(w.name)}</strong><br>${esc(w.commonName)} <em>(${esc(w.species)})</em><br>Last seen ${fmt.format(last.t)}<br>${km.toLocaleString()} km travelled since ${fmt.format(w.fixes[0].t)}`);
        pin.on('click', () => select(w.id));
        line.on('click', () => select(w.id));

        const item = document.createElement('li');
        item.className = 'whale-map__item';
        item.innerHTML = `<button type="button"><span class="whale-map__swatch" style="background:${color}"></span><span class="whale-map__who">${esc(w.name)}<small>${esc(w.commonName)}</small></span><span class="whale-map__seen">${Drupal.t('Last seen')}<br>${fmt.format(last.t)}</span></button>`;
        item.querySelector('button').addEventListener('click', () => select(w.id));
        listEl.append(item);
        layers[w.id] = { line, pin, dots, item };
      });
      map.fitBounds(all.getBounds(), { padding: [30, 30] });
    }).catch((e) => { listEl.innerHTML = `<li>${Drupal.t('Whale data unavailable.')} ${esc(e.message)}</li>`; });
  }

  Drupal.behaviors.iaatoWhaleMap = {
    attach(context) { once('iaato-whale-map', '.whale-map', context).forEach(init); },
  };
})(Drupal, once);
