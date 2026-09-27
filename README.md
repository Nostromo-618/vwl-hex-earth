# Vanduo Hex Earth

A hex-grid rendering of the whole Earth built with Vue 3, [`@vanduo-oss/vd3`](https://github.com/vanduo-oss/vd3) (UI + dark mode), and [`@vanduo-oss/vdl-cbun`](https://github.com/vanduo-oss/vdl-cbun) (canvas hex grid, installed from a pinned GitHub commit).

- Resolution tiers: 28.8k / 64.8k / 115.2k / 259.2k hexes. World keeps the classic
  2:1 globe grids (240×120 … 720×360). Europe uses an equal-area (EPSG:3035-style
  LAEA) lattice sized to the same hex counts so the continent is not stretched.
  Desktop Europe opens at 259.2k; phones start at the lowest tier. Every tier remains selectable.
- Land: vendored Natural Earth 110m (world) and clipped 10m land + lakes (Europe),
  rasterized per hex through a latitude-band polygon index, with boundary-cell
  supersampling to keep coastlines readable at high tiers
- Terrain: coherent climate noise — deep/shallow ocean blues, sand coasts,
  grass/plains, latitude deserts, tundra/snow/ice (polar-first, so Arctic
  coasts are never sand), and contiguous mountain ranges
- Drag to pan, wheel/buttons to zoom, reset view — DPR-aware and culled by the
  core, so large tiers stay interactive
- Path mode: click hex A, then hex B — the route is drawn along the
  parity-correct hex neighborhood
- Stats panel: FPS, render mode/timing, hex counts, terrain breakdown, memory,
  view, and per-tier benchmark results

[Open the live Hex Earth demo](https://labs.vanduo.dev/#demos/hex-earth) · [Vanduo Labs](https://labs.vanduo.dev/)

## Requirements

- Node.js **20.19+** (22 or 24 recommended)
- **pnpm** 10+ (`packageManager` is `pnpm@10.28.2`)

This project uses a [vd3-style](https://github.com/vanduo-oss/vd3) supply-chain
policy (`.npmrc`): 24h minimum release age, no lifecycle scripts except
allowlisted builds, and `@vanduo-oss/*` excluded from the age gate.

`@vanduo-oss/vdl-cbun` is not on npm yet. Install needs **git** and will run
that package's `prepack` build (allowlisted in `pnpm-workspace.yaml`).

## Run

```sh
pnpm install
pnpm exec playwright install chromium   # once, for e2e
pnpm dev
```

| Script               | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `pnpm dev`           | Vite dev server                                           |
| `pnpm build`         | Typecheck + standalone and library bundles                |
| `pnpm preview`       | Serve `dist/`                                             |
| `pnpm typecheck`     | `vue-tsc` on app and node configs                         |
| `pnpm lint`          | ESLint                                                    |
| `pnpm format:check`  | Prettier                                                  |
| `pnpm knip`          | Unused files / exports / deps                             |
| `pnpm test`          | Vitest                                                    |
| `pnpm test:coverage` | Vitest + v8 coverage thresholds                           |
| `pnpm test:e2e`      | Playwright (Chromium; expects a build, or builds locally) |
| `pnpm ci`            | Full gate used by GitHub Actions                          |

Comparative benchmarks run only when requested from the Stats panel.

## Credits

- Coastline data: [Natural Earth](https://www.naturalearthdata.com/) 1:110m land
  for the globe and 1:10m land + lakes for Europe (public domain). 110m packaged
  as TopoJSON in the style of
  [topojson/world-atlas](https://github.com/topojson/world-atlas) (`land-110m.json`,
  ISC). Refresh the Europe clips with `pnpm prepare-land`.
- UI: `@vanduo-oss/vd3` (MIT) — see its `THIRD-PARTY-LICENSES` for Open Color,
  Phosphor Icons, and related notices.
- Hex canvas: `@vanduo-oss/vdl-cbun` (MIT).

## License

[MIT](LICENSE) © Nostromo-618

## Labs integration

The repository is public; the package remains unpublished on npm (`private: true`). Build the standalone application and reusable library with `pnpm build`. Labs consumes `VdlHexEarthDemo` from `@vanduo-oss/vdl-hex-earth` through a sibling link, plus `@vanduo-oss/vdl-hex-earth/style.css`. Pass `embedded` to fill the host stage. The host and demo share Vue 3.5.42 and vd3 1.7.4; Vite dedupes those dependencies. The library emits its geography as separate lazy assets with module-relative URLs.

Controls and Stats use scoped `vdl-hex-earth:<panel>:position` preferences, pointer handles, arrow-key positioning (Shift for larger moves), collapse/close and Reset layout. Positions clamp to the stage after viewport/dock changes. Phone sheets keep map gestures available and begin at the low tier; desktop keeps the existing Europe/ultra default. World/Europe, all tiers, terrain and path mode remain available. Comparative benchmarks are on demand and canceled on exit/region changes. Canvases, samplers, observers, listeners and animation frames are disposed on unmount.

Run `pnpm run ci` for type checking, lint, formatting, unused-code analysis, coverage, both builds and standalone browser tests. Labs adds cross-browser integration and dock/layout checks.
