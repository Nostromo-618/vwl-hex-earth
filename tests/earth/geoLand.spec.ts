import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { landTestFromTopology, type LandTopology } from '../../src/earth/geoLand';

function squareArc(x0: number, y0: number, size: number): number[][] {
  return [
    [x0, y0],
    [size, 0],
    [0, size],
    [-size, 0],
    [0, -size],
  ];
}

const tinyLand: LandTopology = {
  transform: { scale: [1, 1], translate: [0, 0] },
  arcs: [
    squareArc(-20, -20, 40),
    squareArc(-4, -4, 8),
    squareArc(8, -4, 8),
    [
      [170, 0],
      [-340, 0],
      [0, 10],
      [340, 0],
      [0, -10],
    ],
    [
      [0, 0],
      [1, 1],
    ],
    squareArc(370, -5, 10),
  ],
  objects: {
    land: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', arcs: [[0], [1]] },
        { type: 'Polygon', arcs: [[2]] },
        { type: 'MultiPolygon', arcs: [[[3]]] },
        { type: 'Polygon', arcs: [[4]] },
        { type: 'Polygon', arcs: [[0], [5]] },
        { type: 'Point', arcs: [] },
      ],
    },
  },
};

describe('landTestFromTopology', () => {
  it('returns false outside ±90 latitude', () => {
    const at = landTestFromTopology({
      transform: { scale: [1, 1], translate: [0, 0] },
      arcs: [squareArc(-10, -10, 20)],
      objects: {
        land: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0]] }] },
      },
    });
    expect(at(0, 91)).toBe(false);
    expect(at(0, -91)).toBe(false);
  });

  it('uses even-odd fill so holes are water', () => {
    const at = landTestFromTopology({
      transform: { scale: [1, 1], translate: [0, 0] },
      arcs: [squareArc(-20, -20, 40), squareArc(-4, -4, 8)],
      objects: {
        land: {
          type: 'GeometryCollection',
          geometries: [{ type: 'Polygon', arcs: [[0], [1]] }],
        },
      },
    });
    expect(at(0, 0)).toBe(false);
    expect(at(12, 0)).toBe(true);
  });

  it('rejects points in a band that miss the polygon bbox', () => {
    const at = landTestFromTopology({
      transform: { scale: [1, 1], translate: [0, 0] },
      arcs: [squareArc(-10, -10, 20)],
      objects: {
        land: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0]] }] },
      },
    });
    expect(at(0, 80)).toBe(false);
  });

  it('normalizes longitudes past ±180 and shifts holes into the outer frame', () => {
    const at = landTestFromTopology({
      transform: { scale: [1, 1], translate: [0, 0] },
      arcs: [squareArc(-20, -20, 40), squareArc(370, -4, 8), squareArc(8, -4, 8)],
      objects: {
        land: {
          type: 'GeometryCollection',
          geometries: [
            { type: 'Polygon', arcs: [[-1], [1]] },
            { type: 'MultiPolygon', arcs: [[[2]]] },
            { type: 'Point', arcs: [] },
          ],
        },
      },
    });
    expect(at(360 + 12, 0)).toBe(true);
    expect(at(-360 + 12, 0)).toBe(true);
  });

  it('unwraps antimeridian rings and short arcs', () => {
    const at = landTestFromTopology({
      transform: { scale: [1, 1], translate: [0, 0] },
      arcs: [
        [
          [170, 0],
          [-340, 0],
          [0, 10],
          [340, 0],
          [0, -10],
        ],
        [
          [0, 0],
          [1, 1],
        ],
      ],
      objects: {
        land: {
          type: 'GeometryCollection',
          geometries: [
            { type: 'Polygon', arcs: [[0]] },
            { type: 'Polygon', arcs: [[1]] },
          ],
        },
      },
    });
    expect(at(175, 5)).toBe(true);
    expect(at(-175, 5)).toBe(true);
  });
});

describe('Natural Earth 110m', () => {
  const raw = readFileSync(join(process.cwd(), 'src/assets/land-110m.json'), 'utf8');
  const at = landTestFromTopology(JSON.parse(raw) as LandTopology);

  it('classifies known land and water samples', () => {
    expect(at(-98, 39)).toBe(true);
    expect(at(-150, 0)).toBe(false);
    expect(at(0, 51.5)).toBe(true);
    expect(at(0, 90)).toBe(false);
    expect(at(0, -80)).toBe(true);
    expect(at(180, 0)).toBe(at(-180, 0));
    expect(at(0, 100)).toBe(false);
  });
});

describe('createGeoLandTest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('fetches the vendored topology once and reuses the tester', async () => {
    vi.resetModules();
    const fetchMock = vi.fn(async () => ({
      json: async () => tinyLand,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { createGeoLandTest: fresh } = await import('../../src/earth/geoLand');
    const first = await fresh();
    const second = await fresh();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(first).toBe(second);
    expect(first(12, 0)).toBe(true);
  });
});
