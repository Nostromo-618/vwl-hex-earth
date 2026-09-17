import { describe, expect, it } from 'vitest';
import { KIND, KIND_NAMES, buildWorld, fillFor, landKind } from '../../src/earth/terrain';

describe('landKind', () => {
  it('is polar-first so high latitudes are never sand', () => {
    expect(landKind(80, 1, 1, 1, true)).toBe(KIND.ICE);
    expect(landKind(65, 0.4, 1, 1, true)).toBe(KIND.ICE);
    expect(landKind(65, 0.7, 1, 1, true)).toBe(KIND.SNOW);
    expect(landKind(58, 0.4, 1, 1, true)).toBe(KIND.SNOW);
    expect(landKind(58, 0.7, 1, 1, true)).toBe(KIND.TUNDRA);
  });

  it('classifies coasts, deserts, mountains, plains, and grass', () => {
    expect(landKind(10, 1, 1, 1, true)).toBe(KIND.SAND);
    expect(landKind(20, 1, 1, 0.7, false)).toBe(KIND.DESERT);
    expect(landKind(20, 1, 1, 0.5, false)).not.toBe(KIND.DESERT);
    expect(landKind(10, 1, 0.1, 0, false)).toBe(KIND.MOUNTAIN);
    expect(landKind(10, 0.1, 0.5, 0, false)).toBe(KIND.PLAINS);
    expect(landKind(10, 0.5, 0.5, 0, false)).toBe(KIND.GRASS);
  });
});

describe('buildWorld', () => {
  it('marks a single-cell island as land with shallow neighbors', () => {
    const cols = 8;
    const rows = 6;
    const world = buildWorld((lon, lat) => Math.abs(lat) < 40, 8, 6);
    expect(world.landCells).toBeGreaterThan(0);
    expect(world.kinds.length).toBe(cols * rows);
    const water = [...world.kinds].filter((k) => k === KIND.DEEP || k === KIND.SHALLOW);
    expect(water.length).toBeGreaterThan(0);
    expect([...world.kinds].some((k) => k === KIND.SHALLOW)).toBe(true);
  });

  it('classifies all-water as deep (and maybe shallow only at edges of land, of which there is none)', () => {
    const world = buildWorld(() => false, 6, 4);
    expect(world.landCells).toBe(0);
    expect([...world.kinds].every((k) => k === KIND.DEEP)).toBe(true);
    expect([...world.landPct].every((p) => p === 0)).toBe(true);
  });

  it('classifies all-land without water kinds and is deterministic', () => {
    const a = buildWorld(() => true, 12, 8);
    const b = buildWorld(() => true, 12, 8);
    expect(a.landCells).toBe(12 * 8);
    expect([...a.kinds].some((k) => k === KIND.DEEP || k === KIND.SHALLOW)).toBe(false);
    expect(Buffer.from(a.kinds).equals(Buffer.from(b.kinds))).toBe(true);
  });

  it('supersamples the land/water boundary so landPct is fractional', () => {
    const world = buildWorld((lon) => lon >= 0, 8, 6);
    const fractions = [...world.landPct].filter((p) => p > 0 && p < 1);
    expect(fractions.length).toBeGreaterThan(0);
  });

  it('picks fill and stroke from the kind palettes, with a deep fallback', () => {
    const world = buildWorld(() => true, 4, 3);
    const paint = fillFor(world.kinds, 0, 4);
    expect(paint.fill).toMatch(/^#/);
    expect(paint.stroke).toMatch(/^#/);
    const unknown = new Uint8Array([99]);
    const fallback = fillFor(unknown, 0, 4);
    expect(fallback.fill).toMatch(/^#/);
  });

  it('exposes one name per kind', () => {
    expect(KIND_NAMES).toHaveLength(10);
    expect(KIND_NAMES[KIND.MOUNTAIN]).toBe('Mountain');
  });
});
