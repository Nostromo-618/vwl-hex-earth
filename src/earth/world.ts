import { WORLD, type MapRegion } from './regions';
import { planarSpan, regionPlanarBounds, xyToLonLat, type LonLat } from './project';

export type { LonLat };

export interface GridTier {
  id: 'low' | 'mid' | 'high' | 'ultra';
  label: string;
  cols: number;
  rows: number;
  /** Cell size in degrees on the globe (World). */
  cell: number;
}

/** Resolution tiers — hex-count labels; World keeps these cols×rows. */
export const TIERS: GridTier[] = [
  { id: 'low', label: '28.8k', cols: 240, rows: 120, cell: 1.5 },
  { id: 'mid', label: '64.8k', cols: 360, rows: 180, cell: 1.0 },
  { id: 'high', label: '115.2k', cols: 480, rows: 240, cell: 0.75 },
  { id: 'ultra', label: '259.2k', cols: 720, rows: 360, cell: 0.5 },
];

export const DEFAULT_TIER: GridTier['id'] = 'low';
const DEFAULT_TIER_EUROPE: GridTier['id'] = 'ultra';

export function defaultTierFor(regionId: string): GridTier['id'] {
  return regionId === 'europe' ? DEFAULT_TIER_EUROPE : DEFAULT_TIER;
}

/** Hex radius in canvas world pixels (shared by the renderer, toolbar, stats). */
export const HEX_SIZE = 6;

export function tierById(id: string): GridTier {
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}

export function hexCountOf(tier: GridTier): number {
  return tier.cols * tier.rows;
}

export interface GridSpec {
  cols: number;
  rows: number;
  hexes: number;
  cell: number;
  cellUnit: 'deg' | 'km';
}

/**
 * After HexEarth's -30° rotation the lattice is pointy-top: column spacing is
 * √3·size and row spacing is 1.5·size, so pixel aspect ≈ (cols/rows)·√3/1.5.
 */
export const HEX_PIXEL_ASPECT = Math.sqrt(3) / 1.5;

function dimensionsFor(hexes: number, colsOverRows: number): { cols: number; rows: number } {
  const rows = Math.max(1, Math.round(Math.sqrt(hexes / colsOverRows)));
  const cols = Math.max(1, Math.round(hexes / rows));
  return { cols, rows };
}

/** World uses the tier's 2:1 globe grid; LAEA regions match meter aspect. */
export function gridFor(region: MapRegion, tier: GridTier): GridSpec {
  if (region.projection !== 'laea') {
    return {
      cols: tier.cols,
      rows: tier.rows,
      hexes: tier.cols * tier.rows,
      cell: tier.cell,
      cellUnit: 'deg',
    };
  }
  const bounds = regionPlanarBounds(region);
  const { spanX, spanY } = planarSpan(bounds);
  const meterAspect = spanX / spanY;
  const colsOverRows = meterAspect / HEX_PIXEL_ASPECT;
  const { cols, rows } = dimensionsFor(hexCountOf(tier), colsOverRows);
  const cellM = Math.sqrt((spanX / cols) * (spanY / rows));
  return {
    cols,
    rows,
    hexes: cols * rows,
    cell: cellM / 1000,
    cellUnit: 'km',
  };
}

export interface Cell {
  col: number;
  row: number;
}

export function cellToQ(col: number, row: number): number {
  return col - Math.floor(row / 2);
}

export function qToCol(q: number, row: number): number {
  return q + Math.floor(row / 2);
}

export function cellCenterXY(
  col: number,
  row: number,
  cols: number,
  rows: number,
  region: MapRegion,
): { x: number; y: number } {
  const bounds = regionPlanarBounds(region);
  const { spanX, spanY } = planarSpan(bounds);
  return {
    x: bounds.minX + ((col + 0.5 + (row & 1) * 0.5) * spanX) / cols,
    y: bounds.maxY - ((row + 0.5) * spanY) / rows,
  };
}

export function cellStep(
  cols: number,
  rows: number,
  region: MapRegion,
): { dx: number; dy: number } {
  const { spanX, spanY } = planarSpan(regionPlanarBounds(region));
  return { dx: spanX / cols, dy: spanY / rows };
}

/**
 * Geographic center of a cell.
 *
 * The engine lays odd rows out half a column east of even rows
 * (hexToPixel: baseX = size*1.5*q, with qOffset = floor(r/2)); with the app's
 * -30° rotation that shows up as `x = col + (row & 1) * 0.5` column units.
 * Sampling every row at `col + 0.5` sheared N–S coastlines, so the parity
 * offset is applied here to sample the hex's visual center.
 */
export function cellToLonLat(
  col: number,
  row: number,
  cols: number,
  rows: number,
  region: MapRegion = WORLD,
): LonLat {
  const { x, y } = cellCenterXY(col, row, cols, rows, region);
  return xyToLonLat(x, y, region);
}

/**
 * Parity-aware 6-neighborhood, as flat row-major indexes.
 *
 * Matches `getAdjacentHexes` after converting axial q to column: even rows use
 * `upL=(c-1,r-1)/upR=(c,r-1)`, odd rows use `upL=(c,r-1)/upR=(c+1,r-1)`
 * (same for the row below), plus E/W.
 */
export function neighborIndexes(col: number, row: number, cols: number, rows: number): number[] {
  const parity = row & 1;
  const out: number[] = [];
  const add = (c: number, r: number): void => {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    out.push(r * cols + c);
  };
  add(col - 1, row);
  add(col + 1, row);
  add(col - 1 + parity, row - 1);
  add(col + parity, row - 1);
  add(col - 1 + parity, row + 1);
  add(col + parity, row + 1);
  return out;
}

/** Breadth-first path over the parity-correct hex neighborhood. */
export function findPath(start: Cell, goal: Cell, cols: number, rows: number): Cell[] {
  if (
    start.col < 0 ||
    start.col >= cols ||
    start.row < 0 ||
    start.row >= rows ||
    goal.col < 0 ||
    goal.col >= cols ||
    goal.row < 0 ||
    goal.row >= rows
  ) {
    return [];
  }
  const total = cols * rows;
  const idx = (c: number, r: number): number => r * cols + c;
  const startIdx = idx(start.col, start.row);
  const goalIdx = idx(goal.col, goal.row);
  if (startIdx === goalIdx) return [start];
  const prev = new Int32Array(total).fill(-1);
  const seen = new Uint8Array(total);
  seen[startIdx] = 1;
  let frontier: number[] = [startIdx];
  while (frontier.length > 0 && !seen[goalIdx]) {
    const next: number[] = [];
    for (const cur of frontier) {
      const cr = Math.floor(cur / cols);
      const cc = cur % cols;
      for (const ni of neighborIndexes(cc, cr, cols, rows)) {
        if (seen[ni]) continue;
        seen[ni] = 1;
        prev[ni] = cur;
        next.push(ni);
      }
    }
    frontier = next;
  }
  /* v8 ignore start */
  if (!seen[goalIdx]) return [];
  /* v8 ignore stop */
  const path: Cell[] = [];
  let step = goalIdx;
  while (step !== -1) {
    path.push({ col: step % cols, row: Math.floor(step / cols) });
    step = prev[step];
  }
  path.reverse();
  return path;
}
