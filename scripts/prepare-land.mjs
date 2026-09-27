/**
 * Clip Natural Earth 10m land (world-atlas TopoJSON) and 10m lakes (NE GeoJSON)
 * to the Europe map bbox, then tile large polygons so point-in-polygon stays local.
 * Dev-only; vendored JSON is committed for offline installs.
 *
 *   pnpm prepare-land
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAND_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-10m.json';
const LAKES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson';

const WEST = -24.5 - 3;
const EAST = 40 + 3;
const SOUTH = 34.5 - 3;
const NORTH = 71.5 + 3;
const TILE = 2;
const DECIMALS = 4;

function round(n) {
  const f = 10 ** DECIMALS;
  return Math.round(n * f) / f;
}

function bboxHits(minX, minY, maxX, maxY) {
  return maxX >= WEST && minX <= EAST && maxY >= SOUTH && minY <= NORTH;
}

function ringBbox(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const out = [];
  for (const pt of ring) {
    const x = round(pt[0]);
    const y = round(pt[1]);
    out.push([x, y]);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { ring: out, minX, minY, maxX, maxY };
}

function intersect(a, b, axis, value) {
  const t =
    axis === 0 ? (value - a[0]) / (b[0] - a[0] || 1e-12) : (value - a[1]) / (b[1] - a[1] || 1e-12);
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

function clipRing(ring, inside, axis, value) {
  if (ring.length < 4) return [];
  const out = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const s = ring[i];
    const e = ring[i + 1];
    const sIn = inside(s);
    const eIn = inside(e);
    if (eIn) {
      if (!sIn) out.push(intersect(s, e, axis, value));
      out.push(e);
    } else if (sIn) {
      out.push(intersect(s, e, axis, value));
    }
  }
  if (out.length > 0) {
    const first = out[0];
    const last = out[out.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) out.push(first);
  }
  return out;
}

function packRings(rings) {
  if (!rings.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const packed = [];
  for (const ring of rings) {
    if (ring.length < 4) continue;
    const b = ringBbox(ring);
    packed.push(b.ring);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  if (!packed.length) return null;
  return { rings: packed, minX, minY, maxX, maxY };
}

function clipToBox(rings, west, east, south, north) {
  const clip = (ring) => {
    let r = ring;
    r = clipRing(r, (p) => p[0] >= west, 0, west);
    r = clipRing(r, (p) => p[0] <= east, 0, east);
    r = clipRing(r, (p) => p[1] >= south, 1, south);
    r = clipRing(r, (p) => p[1] <= north, 1, north);
    return r;
  };
  return packRings(rings.map(clip));
}

function tilePolygon(poly) {
  const clipped = clipToBox(poly.rings, WEST, EAST, SOUTH, NORTH);
  if (!clipped) return [];
  const x0 = Math.floor(clipped.minX / TILE) * TILE;
  const x1 = Math.ceil(clipped.maxX / TILE) * TILE;
  const y0 = Math.floor(clipped.minY / TILE) * TILE;
  const y1 = Math.ceil(clipped.maxY / TILE) * TILE;
  if (x1 - x0 <= TILE + 1e-9 && y1 - y0 <= TILE + 1e-9) return [clipped];
  const tiles = [];
  for (let x = x0; x < x1 - 1e-9; x += TILE) {
    for (let y = y0; y < y1 - 1e-9; y += TILE) {
      const piece = clipToBox(clipped.rings, x, x + TILE, y, y + TILE);
      if (piece) tiles.push(piece);
    }
  }
  return tiles.length ? tiles : [clipped];
}

function decodeTopo(topo) {
  const { scale, translate } = topo.transform;
  const arcs = topo.arcs.map((arc) => {
    const pts = [];
    let x = 0;
    let y = 0;
    for (const d of arc) {
      x += d[0];
      y += d[1];
      pts.push([x * scale[0] + translate[0], y * scale[1] + translate[1]]);
    }
    return pts;
  });

  const ringFrom = (indexes) => {
    const pts = [];
    for (const i of indexes) {
      const arc = i >= 0 ? arcs[i] : [...arcs[~i]].reverse();
      if (pts.length > 0) pts.pop();
      for (const p of arc) pts.push(p);
    }
    return pts;
  };

  const out = [];
  const addPolygon = (arcLists) => {
    const packed = packRings(arcLists.map(ringFrom));
    if (packed && bboxHits(packed.minX, packed.minY, packed.maxX, packed.maxY)) {
      out.push(...tilePolygon(packed));
    }
  };

  const land = topo.objects.land;
  if (land.type === 'Polygon') addPolygon(land.arcs);
  else if (land.type === 'MultiPolygon') for (const poly of land.arcs) addPolygon(poly);
  else if (land.geometries) {
    for (const g of land.geometries) {
      if (g.type === 'Polygon') addPolygon(g.arcs);
      else if (g.type === 'MultiPolygon') for (const poly of g.arcs) addPolygon(poly);
    }
  }
  return out;
}

function decodeGeojson(fc) {
  const out = [];
  const add = (coords) => {
    const packed = packRings(coords);
    if (packed && bboxHits(packed.minX, packed.minY, packed.maxX, packed.maxY)) {
      out.push(...tilePolygon(packed));
    }
  };
  for (const f of fc.features ?? []) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') add(g.coordinates);
    else if (g.type === 'MultiPolygon') for (const poly of g.coordinates) add(poly);
  }
  return out;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

const landTopo = await fetchJson(LAND_URL);
const lakesGeo = await fetchJson(LAKES_URL);
const land = decodeTopo(landTopo);
const lakes = decodeGeojson(lakesGeo);

const landPath = join(ROOT, 'src/assets/land-10m-europe.json');
const lakesPath = join(ROOT, 'src/assets/lakes-10m-europe.json');
const landJson = JSON.stringify({ polygons: land });
const lakesJson = JSON.stringify({ polygons: lakes });
await writeFile(landPath, landJson);
await writeFile(lakesPath, lakesJson);

const kb = (p, n, count) => `${p} ${Math.round(n.length / 102.4) / 10} KB, ${count} polys`;
console.log(kb(landPath, landJson, land.length));
console.log(kb(lakesPath, lakesJson, lakes.length));
