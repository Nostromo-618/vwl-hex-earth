import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIER,
  HEX_SIZE,
  TIERS,
  cellToLonLat,
  cellToQ,
  findPath,
  hexCountOf,
  neighborIndexes,
  qToCol,
  tierById,
} from '../../src/earth/world';

describe('world', () => {
  it('exposes four resolution tiers and a default', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['low', 'mid', 'high', 'ultra']);
    expect(DEFAULT_TIER).toBe('low');
    expect(HEX_SIZE).toBe(6);
    expect(TIERS[3].id).toBe('ultra');
  });

  it('counts hexes as cols × rows', () => {
    expect(hexCountOf(TIERS[0])).toBe(28800);
    expect(hexCountOf(TIERS[3])).toBe(259200);
  });

  it('resolves known ids and falls back to the first tier', () => {
    expect(tierById('high')).toBe(TIERS[2]);
    expect(tierById('nope')).toBe(TIERS[0]);
  });

  it('round-trips axial q and column with odd-row offset', () => {
    for (const row of [0, 1, 2, 17]) {
      for (const col of [0, 1, 9]) {
        expect(qToCol(cellToQ(col, row), row)).toBe(col);
      }
    }
  });

  it('samples geographic centers with odd-row half-column offset', () => {
    const even = cellToLonLat(0, 0, 360, 180);
    const odd = cellToLonLat(0, 1, 360, 180);
    expect(even.lon).toBeCloseTo(-179.5, 5);
    expect(even.lat).toBeCloseTo(89.5, 5);
    expect(odd.lon).toBeGreaterThan(even.lon);
    expect(odd.lon - even.lon).toBeCloseTo(0.5, 5);
  });

  it('uses parity-correct neighbors and drops out-of-bounds', () => {
    expect(neighborIndexes(0, 0, 4, 3).sort((a, b) => a - b)).toEqual([1, 4]);
    const odd = neighborIndexes(1, 1, 4, 3);
    expect(odd).toContain(1 * 4 + 2);
    expect(odd).toContain(0 * 4 + 1);
    expect(neighborIndexes(3, 2, 4, 3)).not.toContain(3 * 4);
  });

  it('finds the trivial path, a short path, and a corner path', () => {
    expect(findPath({ col: 2, row: 2 }, { col: 2, row: 2 }, 8, 6)).toEqual([{ col: 2, row: 2 }]);
    const short = findPath({ col: 0, row: 0 }, { col: 2, row: 0 }, 8, 6);
    expect(short[0]).toEqual({ col: 0, row: 0 });
    expect(short.at(-1)).toEqual({ col: 2, row: 0 });
    expect(short.length).toBe(3);
    const corner = findPath({ col: 0, row: 0 }, { col: 7, row: 5 }, 8, 6);
    expect(corner.at(-1)).toEqual({ col: 7, row: 5 });
    expect(corner.length).toBeGreaterThan(8);
    expect(findPath({ col: -1, row: 0 }, { col: 0, row: 0 }, 8, 6)).toEqual([]);
    expect(findPath({ col: 0, row: 0 }, { col: 99, row: 0 }, 8, 6)).toEqual([]);
  });
});
