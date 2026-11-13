/**
 * @file
 * Shared whale-tracking helpers for the three whale tracker SDCs.
 *
 * Swap data sources by changing normalize() only: every component consumes
 * the normalized shape  [{id, name, commonName, species, sex, fixes:[{t:Date, lat, lon, lc}]}].
 */
(function () {
  const cache = {};

  /** Accepts our synthetic JSON, a bare array of individuals, or flat Movebank-style rows. */
  function normalize(raw) {
    let list = Array.isArray(raw) ? raw : (raw.individuals || raw.whales || []);
    // Flat rows (e.g. a Movebank CSV converted to JSON): group by individual.
    if (list.length && !list[0].fixes && (list[0].timestamp || list[0]['location-lat'])) {
      const byId = {};
      list.forEach((r) => {
        const id = r['individual-local-identifier'] || r.id || r['tag-local-identifier'];
        (byId[id] = byId[id] || { id, name: id, species: r['individual-taxon-canonical-name'] || '', fixes: [] }).fixes.push({
          t: r.timestamp, lat: +(r['location-lat'] ?? r.lat), lon: +(r['location-long'] ?? r.lon), lc: r['argos:lc'] || r.lc,
        });
      });
      list = Object.values(byId);
    }
    return list.map((w) => ({
      id: String(w.id),
      ptt: w.ptt,
      name: w.name || String(w.id),
      commonName: w.common_name || w.commonName || w.species || 'Whale',
      species: w.species || '',
      sex: w.sex || '',
      fixes: (w.fixes || [])
        .map((f) => ({ t: new Date(f.t), lat: +f.lat, lon: +f.lon, lc: f.lc ?? null }))
        .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon) && !isNaN(f.t))
        .sort((a, b) => a.t - b.t),
    })).filter((w) => w.fixes.length);
  }

  function load(url) {
    cache[url] = cache[url] || fetch(url, { credentials: 'same-origin' })
      .then((r) => { if (!r.ok) throw new Error(`Whale data ${r.status}`); return r.json(); })
      .then((raw) => ({ meta: raw.meta || {}, whales: normalize(raw) }));
    return cache[url];
  }

  /** Escape feed values before they are placed in HTML strings. */
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const toRad = (d) => (d * Math.PI) / 180;

  function haversineKm(a, b) {
    const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  function trackKm(fixes) {
    let d = 0;
    for (let i = 1; i < fixes.length; i++) d += haversineKm(fixes[i - 1], fixes[i]);
    return d;
  }

  /** Linear interpolation of position at time t (ms). Returns null outside the track. */
  function positionAt(fixes, t) {
    if (!fixes.length || t < fixes[0].t || t > fixes[fixes.length - 1].t) return null;
    let i = 1;
    while (i < fixes.length && fixes[i].t < t) i++;
    const a = fixes[i - 1], b = fixes[Math.min(i, fixes.length - 1)];
    const span = b.t - a.t || 1, f = (t - a.t) / span;
    return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f, heading: Math.atan2(b.lon - a.lon, b.lat - a.lat) };
  }

  /**
   * South polar stereographic (EPSG:3031-style), unit radius at the equator.
   * rotate (deg) spins the map so a region of interest points "up".
   */
  function polar(lat, lon, rotate = 0) {
    const r = Math.tan(Math.PI / 4 + toRad(lat) / 2);
    const l = toRad(lon + rotate);
    return [r * Math.sin(l), -r * Math.cos(l)];
  }

  /** Very simplified Antarctic coastline (ice-shelf fronts), [lon, lat]. Illustrative only. */
  const coast = [
    [0, -70], [15, -70], [30, -69.5], [45, -67.5], [55, -66.5], [65, -67.5], [70, -69.5], [75, -69], [80, -67], [90, -66.5],
    [100, -66], [110, -66.2], [120, -66.8], [135, -66.3], [145, -67.5], [155, -69], [163, -70.5], [170, -71.4], [168, -73.5],
    [165, -75], [166, -77.5], [175, -78.3], [-175, -78.5], [-163, -78.2], [-155, -77], [-148, -76.3], [-140, -75], [-130, -74],
    [-120, -73.6], [-110, -74], [-100, -73.2], [-90, -72.8], [-80, -73], [-75, -71], [-68, -68], [-66, -66], [-63, -65],
    [-58, -63.3], [-56.5, -63.6], [-59.5, -65.5], [-61.5, -67.5], [-61, -70], [-62, -73], [-61, -75.5], [-50, -77.8],
    [-40, -78], [-35, -76], [-28, -75], [-20, -73.2], [-12, -71.5], [-5, -70.5], [0, -70],
  ];

  /** Okabe–Ito, colour-blind safe. */
  const palette = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#000000'];

  window.IaatoWhales = { esc, load, normalize, haversineKm, trackKm, positionAt, polar, coast, palette };
})();
