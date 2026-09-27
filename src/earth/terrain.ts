import { neighborIndexes, cellCenterXY, cellStep, cellToLonLat } from './world';
import { WORLD, type MapRegion } from './regions';
import { xyToLonLat } from './project';

export const KIND = {
  DEEP: 0,
  SHALLOW: 1,
  SAND: 2,
  GRASS: 3,
  PLAINS: 4,
  DESERT: 5,
  TUNDRA: 6,
  SNOW: 7,
  ICE: 8,
  MOUNTAIN: 9,
} as const;

export const KIND_NAMES = [
  'Deep',
  'Shallow',
  'Sand',
  'Grass',
  'Plains',
  'Desert',
  'Tundra',
  'Snow',
  'Ice',
  'Mountain',
] as const;

const FILLS: string[][] = [
  ['#142e49', '#122b45', '#15314d'],
  ['#1d4468', '#1b4063', '#20496f'],
  ['#c9ae6e', '#c2a767', '#cfb477'],
  ['#3f6d33', '#447438', '#3a652f'],
  ['#6d7c3f', '#67763b', '#738344'],
  ['#bd9a60', '#b79359', '#c3a168'],
  ['#75807a', '#6e7973', '#7c8781'],
  ['#d5e2ea', '#ccdce6', '#dee9f0'],
  ['#dbe7ee', '#d3e1ea', '#e3edf3'],
  ['#585650', '#524f49', '#5f5c56'],
];

const STROKES: string[] = [
  '#0e2236',
  '#163854',
  '#a08a52',
  '#2e5226',
  '#525f2e',
  '#93794a',
  '#5a635e',
  '#aabcc9',
  '#b4c6d2',
  '#403e39',
];

/** Lattice cell size (in grid cells) for the coherent climate noise. */
const LATTICE = 8;

function hash01(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Value noise on an integer lattice. When `periodX` is set, x wraps so the
 * globe is seamless across the dateline; regional maps pass null.
 */
function valueNoise(x: number, y: number, periodX: number | null, salt: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smoothstep(x - x0);
  const fy = smoothstep(y - y0);
  const wrap = (ix: number): number =>
    periodX == null ? ix : ((ix % periodX) + periodX) % periodX;
  const v00 = hash01(wrap(x0), y0, salt);
  const v10 = hash01(wrap(x0 + 1), y0, salt);
  const v01 = hash01(wrap(x0), y0 + 1, salt);
  const v11 = hash01(wrap(x0 + 1), y0 + 1, salt);
  const a = v00 + (v10 - v00) * fx;
  const b = v01 + (v11 - v01) * fx;
  return a + (b - a) * fy;
}

/** Fractal (2–3 octave) value noise; x wraps every `cols` cells when wrapX. */
function fbm(
  col: number,
  row: number,
  cols: number,
  salt: number,
  octaves: number,
  wrapX: boolean,
): number {
  const periodX = wrapX ? Math.max(1, Math.round(cols / LATTICE)) : null;
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const p = periodX == null ? null : Math.max(1, Math.round(periodX * freq));
    sum += amp * valueNoise((col / LATTICE) * freq, (row / LATTICE) * freq, p, salt + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export interface WorldMap {
  kinds: Uint8Array;
  /** Fraction of land within each cell's footprint (boundary cells supersampled). */
  landPct: Float32Array;
  cols: number;
  rows: number;
  landCells: number;
}

function touchesLand(i: number, land: Uint8Array, cols: number, rows: number): boolean {
  const row = Math.floor(i / cols);
  const col = i % cols;
  for (const j of neighborIndexes(col, row, cols, rows)) {
    if (land[j]) return true;
  }
  return false;
}

function touchesWater(i: number, land: Uint8Array, cols: number, rows: number): boolean {
  const row = Math.floor(i / cols);
  const col = i % cols;
  for (const j of neighborIndexes(col, row, cols, rows)) {
    if (!land[j]) return true;
  }
  return false;
}

/** Classify one land cell, polar-first so Arctic coasts never render as sand. */
export function landKind(
  absLat: number,
  climate: number,
  detail: number,
  aridity: number,
  coastal: boolean,
): number {
  if (absLat >= 72) return KIND.ICE;
  if (absLat >= 62) return climate < 0.55 ? KIND.ICE : KIND.SNOW;
  if (absLat >= 55) return climate < 0.5 ? KIND.SNOW : KIND.TUNDRA;
  if (coastal) return KIND.SAND;
  if (absLat >= 15 && absLat <= 33 && aridity > 0.56) return KIND.DESERT;
  if (detail < 0.2) return KIND.MOUNTAIN;
  if (climate < 0.28) return KIND.PLAINS;
  return KIND.GRASS;
}

export function buildWorld(
  landAt: (lon: number, lat: number) => boolean,
  cols: number,
  rows: number,
  region: MapRegion = WORLD,
): WorldMap {
  const n = cols * rows;
  const land = new Uint8Array(n);
  const landPct = new Float32Array(n);
  const lats = new Float32Array(n);
  const kinds = new Uint8Array(n);

  const { dx, dy } = cellStep(cols, rows, region);

  // Pass 1: single center sample per cell (visual hex center, including odd-row offset).
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const ll = cellToLonLat(col, row, cols, rows, region);
      lats[i] = ll.lat;
      land[i] = landAt(ll.lon, ll.lat) ? 1 : 0;
    }
  }

  // Pass 2: supersample only boundary cells (any parity-correct neighbor has a
  // different land class) with a 4x4 grid over the cell footprint in planar space.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      let boundary = false;
      for (const j of neighborIndexes(col, row, cols, rows)) {
        if (land[j] !== land[i]) {
          boundary = true;
          break;
        }
      }
      if (!boundary) {
        landPct[i] = land[i];
        continue;
      }
      const center = cellCenterXY(col, row, cols, rows, region);
      let hits = 0;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const x = center.x + ((sx + 0.5) / 4 - 0.5) * dx;
          const y = center.y + ((sy + 0.5) / 4 - 0.5) * dy;
          const ll = xyToLonLat(x, y, region);
          if (landAt(ll.lon, ll.lat)) hits++;
        }
      }
      landPct[i] = hits / 16;
      land[i] = landPct[i] >= 0.5 ? 1 : 0;
    }
  }

  let landCells = 0;
  for (let i = 0; i < n; i++) landCells += land[i];

  // Pass 3: classify, using coherent climate noise so regions stay contiguous.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      if (!land[i]) {
        kinds[i] = touchesLand(i, land, cols, rows) ? KIND.SHALLOW : KIND.DEEP;
        continue;
      }
      const climate = fbm(col, row, cols, 7, 3, region.wrapX);
      const detail = fbm(col, row, cols, 31, 2, region.wrapX);
      const aridity = fbm(col, row, cols, 53, 2, region.wrapX);
      const absLat = Math.abs(lats[i]);
      kinds[i] = landKind(absLat, climate, detail, aridity, touchesWater(i, land, cols, rows));
    }
  }

  return { kinds, landPct, cols, rows, landCells };
}

export function fillFor(
  kinds: Uint8Array,
  index: number,
  cols: number,
): { fill: string; stroke: string } {
  const kind = kinds[index];
  const shades = FILLS[kind] ?? FILLS[KIND.DEEP];
  const col = index % cols;
  const row = Math.floor(index / cols);
  const v = hash01(col, row, 101);
  return { fill: shades[Math.floor(v * shades.length) % shades.length], stroke: STROKES[kind] };
}
