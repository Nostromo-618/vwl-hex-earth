import landUrl from '../assets/land-110m.json?url';

type Ring = number[][];

interface Poly {
  rings: Ring[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface LandTopology {
  transform: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  objects: {
    land: {
      type: string;
      geometries: Array<{ type: string; arcs: unknown }>;
    };
  };
}

let cachedTester: ((lon: number, lat: number) => boolean) | null = null;

const LAT_BANDS = 180;

function normalizeLon(lon: number): number {
  let l = lon;
  while (l < -180) l += 360;
  while (l >= 180) l -= 360;
  return l;
}

/**
 * Latitude-band index: each polygon is registered in every 1° band its bbox
 * spans, so a sample only tests the handful of polygons near its latitude
 * instead of all ~130.
 */
function buildBands(list: Poly[]): Poly[][] {
  const out: Poly[][] = Array.from({ length: LAT_BANDS }, () => []);
  for (const poly of list) {
    const b0 = Math.max(0, Math.min(LAT_BANDS - 1, Math.floor(poly.minY) + 90));
    const b1 = Math.max(0, Math.min(LAT_BANDS - 1, Math.ceil(poly.maxY) + 90));
    for (let b = b0; b <= b1; b++) out[b].push(poly);
  }
  return out;
}

function unwrapRing(ring: Ring): Ring {
  if (ring.length < 3) return ring;
  const out: Ring = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    const [lx] = out[i - 1];
    let nx = ring[i][0];
    const ny = ring[i][1];
    while (nx - lx > 180) nx -= 360;
    while (nx - lx < -180) nx += 360;
    out.push([nx, ny]);
  }
  return out;
}

function centerLon(ring: Ring): number {
  let sum = 0;
  for (const p of ring) sum += p[0];
  return sum / ring.length;
}

function decode(topo: LandTopology): Poly[] {
  const { scale, translate } = topo.transform;
  const arcs: number[][][] = topo.arcs.map((arc) => {
    const pts: number[][] = [];
    let x = 0;
    let y = 0;
    for (const d of arc) {
      x += d[0];
      y += d[1];
      pts.push([x * scale[0] + translate[0], y * scale[1] + translate[1]]);
    }
    return pts;
  });

  const ringFromArcIndexes = (indexes: number[]): Ring => {
    const pts: Ring = [];
    for (const i of indexes) {
      const arc = i >= 0 ? arcs[i] : [...arcs[~i]].reverse();
      if (pts.length > 0) pts.pop();
      for (const p of arc) pts.push(p);
    }
    return unwrapRing(pts);
  };

  const out: Poly[] = [];
  const addPolygon = (arcLists: number[][]) => {
    const outer = ringFromArcIndexes(arcLists[0]);
    const outerCenter = centerLon(outer);
    const holes = arcLists.slice(1).map((ringArcs) => {
      const h = ringFromArcIndexes(ringArcs);
      const shift = 360 * Math.round((outerCenter - centerLon(h)) / 360);
      return shift === 0 ? h : (h.map(([x, y]) => [x + shift, y]) as Ring);
    });
    const allRings = [outer, ...holes];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const ring of allRings) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    out.push({ rings: allRings, minX, minY, maxX, maxY });
  };

  for (const g of topo.objects.land.geometries) {
    if (g.type === 'Polygon') addPolygon(g.arcs as number[][]);
    else if (g.type === 'MultiPolygon') for (const poly of g.arcs as number[][][]) addPolygon(poly);
  }
  return out;
}

/** Planar even-odd ray cast; rings are unwrapped into one continuous frame. */
function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function testerFor(index: Poly[][]): (lon: number, lat: number) => boolean {
  return (lon, lat) => {
    if (lat < -90 || lat > 90) return false;
    const l = normalizeLon(lon);
    const band = Math.max(0, Math.min(LAT_BANDS - 1, Math.floor(lat) + 90));
    const candidates = index[band];
    for (const poly of candidates) {
      if (lat < poly.minY || lat > poly.maxY) continue;
      for (const shift of [-360, 0, 360]) {
        const x = l + shift;
        if (x < poly.minX || x > poly.maxX) continue;
        let inside = false;
        for (const ring of poly.rings) {
          if (inRing(x, lat, ring)) inside = !inside;
        }
        if (inside) return true;
      }
    }
    return false;
  };
}

/** Build a land-mask from an in-memory TopoJSON topology (no fetch). */
export function landTestFromTopology(topo: LandTopology): (lon: number, lat: number) => boolean {
  return testerFor(buildBands(decode(topo)));
}

export async function createGeoLandTest(): Promise<(lon: number, lat: number) => boolean> {
  if (!cachedTester) {
    const topo: LandTopology = await (await fetch(landUrl)).json();
    cachedTester = landTestFromTopology(topo);
  }
  return cachedTester;
}
