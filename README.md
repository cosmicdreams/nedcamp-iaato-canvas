# IAATO Canvas demo

A NEDCamp experiment: a Drupal 11 site using [Drupal Canvas](https://www.drupal.org/project/canvas) and
single directory components (SDCs), themed after the International Association of Antarctica Tour
Operators (IAATO) website, plus three takes on a whale tracker.

## Set up

Requires [DDEV](https://ddev.com/).

```zsh
git clone https://github.com/cosmicdreams/nedcamp-iaato-canvas.git
cd nedcamp-iaato-canvas
scripts/setup.sh
```

The script installs Drupal, enables Canvas and the `iaato` theme, places the menu and blocks, and
builds the demo pages. It finishes by printing a one-time admin login link.

| Page | What it shows |
| --- | --- |
| `/` | Homepage built from the hero, section, button and article-card components |
| `/whales` | All whale tracker concepts on one page |
| `/whales/map` | Concept A: slippy map, styled after IAATO's Ambassadorship World Map |
| `/whales/kids` | Concept B: animated cartoon map for young children |
| `/whales/kids-polar` | Concept B with the whole-continent view |
| `/whales/research` | Concept C: polar stereographic plot, time scrubber, stats, CSV export |

## Components

All live in `web/themes/custom/iaato/components` and appear in the Canvas library under **IAATO**.

- `hero`, `section`, `button`, `article-card`: page building blocks.
- `whale-map`: Leaflet with OpenStreetMap tiles.
- `whale-kids`: SVG animation; the **Map view** setting switches between a Peninsula close-up and
  the whole continent.
- `whale-science`: SVG plot with Argos location-quality filter and per-whale statistics.

The whale components use no jQuery. Shared helpers are in `js/whale-common.js`.

## Tracking data

The whale data is **synthetic**. `scripts/generate-whale-data.py` writes
`web/themes/custom/iaato/data/whale-tracks.json`, shaped like satellite-tag exports.

Each whale component has a **Tracking data URL** setting. To use real data, point it at another feed
and, if the shape differs, change only `normalize()` in `js/whale-common.js`. It already accepts this
repository's format, a plain array of individuals, or flat Movebank-style rows.

## Notes

- Photography and the IAATO crest are IAATO's, copied for this private demo only. Replace them
  before showing this anywhere public.
- The coastline used by the SVG maps is a hand-simplified approximation.
- Leaflet loads from unpkg with Subresource Integrity hashes; fonts load from Google Fonts. Bundle
  both before using this on a real site.
- The `scripts/build-*.php` scripts update their Canvas pages in place, so page IDs stay stable.
