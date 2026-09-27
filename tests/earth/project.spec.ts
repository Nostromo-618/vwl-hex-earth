import { describe, expect, it } from 'vitest';
import { EUROPE, WORLD } from '../../src/earth/regions';
import {
  LAEA,
  forwardLaea,
  inverseLaea,
  laeaBounds,
  regionPlanarBounds,
  xyToLonLat,
} from '../../src/earth/project';
import {
  HEX_PIXEL_ASPECT,
  cellToLonLat,
  gridFor,
  hexCountOf,
  tierById,
} from '../../src/earth/world';

function boxArea(west: number, east: number, south: number, north: number): number {
  const a = forwardLaea(west, south);
  const b = forwardLaea(east, south);
  const c = forwardLaea(west, north);
  return Math.abs((b.x - a.x) * (c.y - a.y));
}

describe('LAEA', () => {
  it('round-trips Paris and Berlin and maps the origin to false easting/northing', () => {
    const origin = forwardLaea(LAEA.lon0, LAEA.lat0);
    expect(origin.x).toBeCloseTo(LAEA.x0, 3);
    expect(origin.y).toBeCloseTo(LAEA.y0, 3);
    expect(inverseLaea(LAEA.x0, LAEA.y0)).toEqual({ lon: LAEA.lon0, lat: LAEA.lat0 });

    for (const [lon, lat] of [
      [2.35, 48.86],
      [13.41, 52.52],
    ] as const) {
      const back = inverseLaea(forwardLaea(lon, lat).x, forwardLaea(lon, lat).y);
      expect(back.lon).toBeCloseTo(lon, 4);
      expect(back.lat).toBeCloseTo(lat, 4);
    }
  });

  it('shrinks a 1° box toward the pole the way equal-area should', () => {
    const spain = boxArea(-6, -5, 37, 38);
    const norway = boxArea(18, 19, 69, 70);
    expect(spain / norway).toBeGreaterThan(1.8);
    expect(spain / norway).toBeLessThan(3.2);
  });

  it('keeps a far-side sample finite and still invertible near the projection origin', () => {
    const far = forwardLaea(LAEA.lon0 + 170, -LAEA.lat0);
    expect(Number.isFinite(far.x)).toBe(true);
    expect(Number.isFinite(far.y)).toBe(true);
    const back = inverseLaea(far.x, far.y);
    expect(Number.isFinite(back.lon)).toBe(true);
    expect(Number.isFinite(back.lat)).toBe(true);
  });
});

describe('gridFor', () => {
  it('keeps World on the globe 2:1 lattice', () => {
    const spec = gridFor(WORLD, tierById('low'));
    expect(spec).toMatchObject({ cols: 240, rows: 120, cellUnit: 'deg', cell: 1.5 });
    expect(xyToLonLat(10, 20, WORLD)).toEqual({ lon: 10, lat: 20 });
  });

  it('sizes Europe so hex count and meter aspect stay honest', () => {
    const ultra = tierById('ultra');
    const spec = gridFor(EUROPE, ultra);
    const bounds = regionPlanarBounds(EUROPE);
    const meterAspect = (bounds.maxX - bounds.minX) / (bounds.maxY - bounds.minY);
    const pixelAspect = (spec.cols / spec.rows) * HEX_PIXEL_ASPECT;
    expect(spec.cellUnit).toBe('km');
    expect(spec.hexes / hexCountOf(ultra)).toBeCloseTo(1, 1);
    expect(spec.cols / spec.rows).toBeLessThan(1.5);
    expect(spec.cols / spec.rows).toBeGreaterThan(0.7);
    expect(Math.abs(pixelAspect - meterAspect) / meterAspect).toBeLessThan(0.08);
  });

  it('maps Europe cell centers through LAEA, not a lon/lat rectangle', () => {
    const spec = gridFor(EUROPE, tierById('low'));
    const mid = cellToLonLat(
      Math.floor(spec.cols / 2),
      Math.floor(spec.rows / 2),
      spec.cols,
      spec.rows,
      EUROPE,
    );
    expect(mid.lon).toBeGreaterThan(EUROPE.west);
    expect(mid.lon).toBeLessThan(EUROPE.east);
    expect(mid.lat).toBeGreaterThan(EUROPE.south);
    expect(mid.lat).toBeLessThan(EUROPE.north);
    const equirect = EUROPE.west + (0.5 * (EUROPE.east - EUROPE.west)) / spec.cols;
    const corner = cellToLonLat(0, 0, spec.cols, spec.rows, EUROPE);
    expect(corner.lon).not.toBeCloseTo(equirect, 1);
    const aabb = laeaBounds(EUROPE.west, EUROPE.east, EUROPE.south, EUROPE.north);
    expect(aabb.maxX - aabb.minX).toBeGreaterThan(1_000_000);
  });
});
