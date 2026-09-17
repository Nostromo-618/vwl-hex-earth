# Hex Earth

A hex-grid rendering of the whole Earth built with Vue 3, [`@vanduo-oss/vd3`](https://github.com/vanduo-oss/vd3) (UI + dark mode), and [`@vanduo-oss/vdl-cbun`](https://github.com/vanduo-oss/vdl-cbun) (canvas hex grid, installed from a pinned GitHub commit).

- Resolution tiers: 240×120 (28.8k hexes), 360×180 (64.8k), 480×240 (115.2k),
  and 720×360 (259.2k, experimental — enabled only when its benchmark gate
  passes in the Stats panel)
- One Earth source: vendored Natural Earth 110m coastline (TopoJSON) rasterized
  per hex through a latitude-band polygon index, with boundary-cell
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
| `pnpm build`         | Typecheck + production bundle                             |
| `pnpm preview`       | Serve `dist/`                                             |
| `pnpm typecheck`     | `vue-tsc` on app and node configs                         |
| `pnpm lint`          | ESLint                                                    |
| `pnpm format:check`  | Prettier                                                  |
| `pnpm knip`          | Unused files / exports / deps                             |
| `pnpm test`          | Vitest                                                    |
| `pnpm test:coverage` | Vitest + v8 coverage thresholds                           |
| `pnpm test:e2e`      | Playwright (Chromium; expects a build, or builds locally) |
| `pnpm ci`            | Full gate used by GitHub Actions                          |

Pass `?nobench=1` to skip background ultra-tier benchmarks (CI e2e does this).

## Credits

- Coastline data: [Natural Earth](https://www.naturalearthdata.com/) 1:110m land
  (public domain). Packaged as TopoJSON in the style of
  [topojson/world-atlas](https://github.com/topojson/world-atlas) (`land-110m.json`, ISC).
- UI: `@vanduo-oss/vd3` (MIT) — see its `THIRD-PARTY-LICENSES` for Open Color,
  Phosphor Icons, and related notices.
- Hex canvas: `@vanduo-oss/vdl-cbun` (MIT).

## License

[MIT](LICENSE) © Nostromo-618
