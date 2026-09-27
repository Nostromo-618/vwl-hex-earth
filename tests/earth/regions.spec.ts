import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REGION,
  EUROPE,
  REGIONS,
  WORLD,
  latSpan,
  lonSpan,
  regionById,
  regionContains,
} from '../../src/earth/regions';
import { cellToLonLat, defaultTierFor, gridFor, hexCountOf, tierById } from '../../src/earth/world';
import { KIND, buildWorld } from '../../src/earth/terrain';

describe('regions', () => {
  it('defaults to Europe and lists World as the globe', () => {
    expect(DEFAULT_REGION).toBe('europe');
    expect(REGIONS.map((r) => r.id)).toEqual(['europe', 'world']);
    expect(regionById('europe')).toBe(EUROPE);
    expect(regionById('world')).toBe(WORLD);
    expect(regionById('nope')).toBe(EUROPE);
    expect(EUROPE.wrapX).toBe(false);
    expect(EUROPE.projection).toBe('laea');
    expect(WORLD.wrapX).toBe(true);
    expect(WORLD.projection).toBe('lonlat');
    expect(defaultTierFor('europe')).toBe('ultra');
    expect(defaultTierFor('world')).toBe('low');
    expect(lonSpan(EUROPE)).toBeCloseTo(64.5, 5);
    expect(latSpan(EUROPE)).toBeCloseTo(37, 5);
    expect(lonSpan(WORLD)).toBe(360);
    expect(latSpan(WORLD)).toBe(180);
  });

  it('keeps Paris and London inside the Europe box and Kansas outside', () => {
    expect(regionContains(EUROPE, 2.35, 48.86)).toBe(true);
    expect(regionContains(EUROPE, -0.13, 51.51)).toBe(true);
    expect(regionContains(EUROPE, -98.3, 39.1)).toBe(false);
    expect(regionContains(EUROPE, -30, 50)).toBe(false);
    expect(regionContains(EUROPE, 50, 50)).toBe(false);
    expect(regionContains(EUROPE, 10, 20)).toBe(false);
    expect(regionContains(EUROPE, 10, 80)).toBe(false);
  });

  it('maps Europe through an equal-area grid instead of a 2:1 lon/lat stretch', () => {
    const spec = gridFor(EUROPE, tierById('low'));
    expect(spec.cols / spec.rows).toBeLessThan(1.5);
    expect(spec.hexes / hexCountOf(tierById('low'))).toBeCloseTo(1, 1);
    const mid = cellToLonLat(
      Math.floor(spec.cols / 2),
      Math.floor(spec.rows / 2),
      spec.cols,
      spec.rows,
      EUROPE,
    );
    expect(regionContains(EUROPE, mid.lon, mid.lat)).toBe(true);
  });
});

describe('buildWorld with a region', () => {
  it('classifies land and water when sampling a Europe bbox', () => {
    const landAt = (lon: number, lat: number): boolean => lon > 0 && lat > 50;
    const world = buildWorld(landAt, 12, 8, EUROPE);
    expect(world.landCells).toBeGreaterThan(0);
    expect(world.landCells).toBeLessThan(12 * 8);
    expect([...world.kinds].some((k) => k === KIND.DEEP || k === KIND.SHALLOW)).toBe(true);
  });
});
