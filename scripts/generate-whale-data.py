#!/usr/bin/env python3
"""Generate SYNTHETIC whale satellite-tag tracks around Antarctica.

Shape loosely follows Argos/Movebank tag exports: one individual per tag,
irregular fixes with an Argos location class (lc). Not real data.
"""
import json, math, random, sys
from datetime import datetime, timedelta, timezone

random.seed(1991)  # IAATO's founding year, for reproducible fakes.

WHALES = [
    dict(id="MN-235101", ptt=235101, name="Pip", common_name="Humpback whale", species="Megaptera novaeangliae", sex="F",
         waypoints=[(-64.6, -62.2), (-64.9, -63.6), (-66.2, -66.5), (-67.9, -68.3), (-66.0, -66.8), (-64.2, -62.4), (-63.1, -60.4), (-61.2, -61.9), (-58.5, -63.5)]),
    dict(id="BM-235102", ptt=235102, name="Blue Bell", common_name="Antarctic blue whale", species="Balaenoptera musculus intermedia", sex="M",
         waypoints=[(-53.8, -36.2), (-55.9, -38.8), (-58.4, -41.5), (-60.4, -45.2), (-61.8, -48.6), (-63.2, -50.9), (-62.0, -47.0)]),
    dict(id="BB-235103", ptt=235103, name="Minnie", common_name="Antarctic minke whale", species="Balaenoptera bonaerensis", sex="F",
         waypoints=[(-64.8, -55.6), (-66.9, -52.4), (-68.6, -47.8), (-70.4, -41.2), (-71.1, -34.6), (-69.5, -29.8), (-68.0, -33.0)]),
    dict(id="BP-235104", ptt=235104, name="Finn", common_name="Fin whale", species="Balaenoptera physalus", sex="M",
         waypoints=[(-60.9, -55.1), (-61.4, -57.9), (-62.4, -59.6), (-61.6, -56.4), (-60.5, -52.8), (-60.6, -48.4), (-60.9, -45.9)]),
    dict(id="EA-235105", ptt=235105, name="Rory", common_name="Southern right whale", species="Eubalaena australis", sex="F",
         waypoints=[(-54.4, -37.4), (-55.3, -33.5), (-56.4, -29.9), (-57.6, -26.8), (-56.2, -22.4), (-54.6, -19.8)]),
    dict(id="OO-235106", ptt=235106, name="Ross", common_name="Orca (Type C)", species="Orcinus orca", sex="M",
         waypoints=[(-77.3, 166.2), (-76.2, 168.4), (-74.6, 170.9), (-72.9, 172.6), (-71.6, 171.0), (-70.6, 174.8), (-71.9, 176.9), (-73.8, 176.2)]),
]

LC = ["3", "2", "1", "0", "A", "B"]
LC_W = [0.12, 0.2, 0.22, 0.12, 0.2, 0.14]
LC_ERR_KM = {"3": 0.25, "2": 0.5, "1": 1.5, "0": 4, "A": 3, "B": 6}

def hav(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    d = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(d))

def along(wps, frac):
    seg = [hav(wps[i], wps[i + 1]) for i in range(len(wps) - 1)]
    target, acc = frac * sum(seg), 0.0
    for i, s in enumerate(seg):
        if acc + s >= target:
            f = (target - acc) / s if s else 0
            return (wps[i][0] + f * (wps[i + 1][0] - wps[i][0]), wps[i][1] + f * (wps[i + 1][1] - wps[i][1]))
        acc += s
    return wps[-1]

out = []
for k, w in enumerate(WHALES):
    t = datetime(2026, 1, 4, tzinfo=timezone.utc) + timedelta(days=k * 3, hours=random.randint(0, 20))
    end = t + timedelta(days=random.randint(55, 80))
    fixes, n_lat, n_lon = [], 0.0, 0.0
    total = (end - t).total_seconds()
    start = t
    while t <= end:
        frac = (t - start).total_seconds() / total
        lat, lon = along(w["waypoints"], frac)
        n_lat = 0.85 * n_lat + random.gauss(0, 0.05)  # correlated wander
        n_lon = 0.85 * n_lon + random.gauss(0, 0.12)
        lc = random.choices(LC, LC_W)[0]
        err = LC_ERR_KM[lc] / 111.0
        fixes.append(dict(t=t.strftime("%Y-%m-%dT%H:%M:%SZ"),
                          lat=round(lat + n_lat + random.gauss(0, err), 4),
                          lon=round(lon + n_lon + random.gauss(0, err * 2.2), 4), lc=lc))
        t += timedelta(hours=random.uniform(3, 22))
    w = {key: v for key, v in w.items() if key != "waypoints"}
    w["fixes"] = fixes
    out.append(w)

json.dump({
    "meta": {"source": "SYNTHETIC - generated for NEDCamp prototyping, not real animal data",
             "generator": "scripts/generate-whale-data.py", "crs": "EPSG:4326",
             "fields": {"t": "ISO 8601 UTC", "lat": "decimal degrees", "lon": "decimal degrees",
                        "lc": "Argos location class (3 best ... B worst)"}},
    "individuals": out,
}, open(sys.argv[1], "w"), indent=1)
print(sum(len(w["fixes"]) for w in out), "fixes for", len(out), "whales")
