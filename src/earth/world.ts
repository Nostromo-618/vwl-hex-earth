export interface GridTier {
  id: 'low' | 'mid' | 'high' | 'ultra';
  label: string;
  cols: number;
  rows: number;
  /** Cell size in degrees. */
  cell: number;
  /** Experimental tiers stay disabled until their benchmark gate passes. */
  experimental?: boolean;
}

/** Resolution tiers — the single source of truth for grid dimensions. */
export const TIERS: GridTier[] = [
  { id: 'low', label: '28.8k', cols: 240, rows: 120, cell: 1.5 },
  { id: 'mid', label: '64.8k', cols: 360, rows: 180, cell: 1.0 },
  { id: 'high', label: '115.2k', cols: 480, rows: 240, cell: 0.75 },
  { id: 'ultra', label: '259.2k', cols: 720, rows: 360, cell: 0.5, experimental: true },
];

export const DEFAULT_TIER: GridTier['id'] = 'low';

/** Hex radius in canvas world pixels (shared by the renderer, toolbar, stats). */
export const HEX_SIZE = 6;

export function tierById(id: string): GridTier {
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}

export function hexCountOf(tier: GridTier): number {
  return tier.cols * tier.rows;
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

export interface LonLat {
  lon: number;
  lat: number;
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
export function cellToLonLat(col: number, row: number, cols: number, rows: number): LonLat {
  return {
    lon: -180 + ((col + 0.5 + (row & 1) * 0.5) * 360) / cols,
    lat: 90 - ((row + 0.5) * 180) / rows,
  };
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
