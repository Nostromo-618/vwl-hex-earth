import type { MapRegion } from './regions';

export interface LonLat {
  lon: number;
  lat: number;
}

/** EPSG:3035 origin and false offsets; sphere radius matches GRS80 semi-major. */
export const LAEA = {
  lat0: 52,
  lon0: 10,
  x0: 4_321_000,
  y0: 3_210_000,
  R: 6_378_137,
} as const;

const LAT0 = (LAEA.lat0 * Math.PI) / 180;
const LON0 = (LAEA.lon0 * Math.PI) / 180;
const SIN_LAT0 = Math.sin(LAT0);
const COS_LAT0 = Math.cos(LAT0);

export interface PlanarPoint {
  x: number;
  y: number;
}

export interface PlanarBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Spherical Lambert azimuthal equal-area (Snyder), EPSG:3035 origin.
 * Europe stays far from the antipode, so k′ stays finite.
 */
export function forwardLaea(lon: number, lat: number): PlanarPoint {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  const dλ = λ - LON0;
  const sinφ = Math.sin(φ);
  const cosφ = Math.cos(φ);
  const cosΔ = Math.cos(dλ);
  const denom = 1 + SIN_LAT0 * sinφ + COS_LAT0 * cosφ * cosΔ;
  const k = Math.sqrt(2 / Math.max(denom, 1e-12));
  return {
    x: LAEA.x0 + LAEA.R * k * cosφ * Math.sin(dλ),
    y: LAEA.y0 + LAEA.R * k * (COS_LAT0 * sinφ - SIN_LAT0 * cosφ * cosΔ),
  };
}

export function inverseLaea(x: number, y: number): LonLat {
  const xP = x - LAEA.x0;
  const yP = y - LAEA.y0;
  const ρ = Math.hypot(xP, yP);
  if (ρ < 1e-9) {
    return { lon: LAEA.lon0, lat: LAEA.lat0 };
  }
  const c = 2 * Math.asin(Math.min(1, ρ / (2 * LAEA.R)));
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const φ = Math.asin(cosC * SIN_LAT0 + (yP * sinC * COS_LAT0) / ρ);
  const λ = LON0 + Math.atan2(xP * sinC, ρ * COS_LAT0 * cosC - yP * SIN_LAT0 * sinC);
  return { lon: (λ * 180) / Math.PI, lat: (φ * 180) / Math.PI };
}

const EDGE_SAMPLES = 16;

/** Meter AABB of a lon/lat box in LAEA, sampling edges (corners alone miss the bulge). */
export function laeaBounds(west: number, east: number, south: number, north: number): PlanarBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const take = (lon: number, lat: number): void => {
    const p = forwardLaea(lon, lat);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  };
  for (let i = 0; i <= EDGE_SAMPLES; i++) {
    const t = i / EDGE_SAMPLES;
    const lon = west + (east - west) * t;
    const lat = south + (north - south) * t;
    take(lon, south);
    take(lon, north);
    take(west, lat);
    take(east, lat);
  }
  return { minX, maxX, minY, maxY };
}

const planarCache = new Map<string, PlanarBounds>();

/** Lon/lat treated as a plane for the globe; LAEA meters for equal-area regions. */
export function regionPlanarBounds(region: MapRegion): PlanarBounds {
  if (region.projection !== 'laea') {
    return { minX: region.west, maxX: region.east, minY: region.south, maxY: region.north };
  }
  const hit = planarCache.get(region.id);
  if (hit) return hit;
  const next = laeaBounds(region.west, region.east, region.south, region.north);
  planarCache.set(region.id, next);
  return next;
}

export function planarSpan(bounds: PlanarBounds): { spanX: number; spanY: number } {
  return { spanX: bounds.maxX - bounds.minX, spanY: bounds.maxY - bounds.minY };
}

export function xyToLonLat(x: number, y: number, region: MapRegion): LonLat {
  if (region.projection !== 'laea') return { lon: x, lat: y };
  return inverseLaea(x, y);
}
