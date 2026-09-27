import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BYTES_PER_HEX,
  createStatsSampler,
  estimateModelBytes,
  kindName,
  readHeapMB,
  recordPaint,
  recordSharp,
  statsStore,
  ultraGate,
  waterCells,
  type HexWorldInfo,
  type StatsSource,
} from '../../src/earth/stats';

const world: HexWorldInfo = {
  region: 'Europe',
  tier: 'low',
  cols: 10,
  rows: 5,
  hexes: 50,
  cell: 1.5,
  cellUnit: 'deg',
  landCells: 20,
  kindCounts: [1, 2, 3],
  paintMs: 12,
};

function resetStats(): void {
  statsStore.fps = 0;
  statsStore.frameMs = 0;
  statsStore.lastSharpMs = 0;
  statsStore.fastFrames = 0;
  statsStore.total = 0;
  statsStore.visible = 0;
  statsStore.drawn = 0;
  statsStore.mode = 'sharp';
  statsStore.scale = 1;
  statsStore.panX = 0;
  statsStore.panY = 0;
  statsStore.pixelRatio = 1;
  statsStore.world = null;
  statsStore.heapUsedMB = null;
  statsStore.heapLimitMB = null;
  statsStore.canvasBytes = 0;
  statsStore.benchmarkRunning = false;
  statsStore.benchmarks = {};
}

afterEach(() => {
  resetStats();
  vi.unstubAllGlobals();
});

describe('stats helpers', () => {
  it('estimates model bytes and water cells', () => {
    expect(estimateModelBytes(null)).toBe(0);
    expect(estimateModelBytes(world)).toBe(world.hexes * BYTES_PER_HEX + world.hexes * 6);
    expect(waterCells(null)).toBe(0);
    expect(waterCells(world)).toBe(30);
    expect(kindName(0)).toBe('Deep');
    expect(kindName(99)).toBe('Kind 99');
  });

  it('reads heap when performance.memory exists', () => {
    expect(readHeapMB()).toBeNull();
    vi.stubGlobal('performance', {
      ...performance,
      memory: { usedJSHeapSize: 2 * 1048576, jsHeapSizeLimit: 10 * 1048576 },
    });
    expect(readHeapMB()).toEqual({ usedMB: 2, limitMB: 10 });
  });
});

describe('ultraGate', () => {
  it('fails until the ultra tier is measured', () => {
    expect(ultraGate()).toEqual({ passed: false, reasons: ['not measured yet'] });
  });

  it('passes a healthy ultra benchmark', () => {
    recordPaint('ultra', 100, 50);
    for (let i = 0; i < 3; i++) recordSharp('ultra', 10);
    expect(ultraGate().passed).toBe(true);
    expect(ultraGate().reasons).toEqual([]);
  });

  it('fails on paint, sharp, missing sharp, and heap', () => {
    recordPaint('ultra', 2500, 400);
    expect(ultraGate().passed).toBe(false);
    expect(ultraGate().reasons.some((r) => r.includes('first paint'))).toBe(true);
    expect(ultraGate().reasons.some((r) => r.includes('avg sharp'))).toBe(true);
    expect(ultraGate().reasons.some((r) => r.includes('heap'))).toBe(true);
    recordPaint('ultra', 100, null);
    recordSharp('ultra', 400);
    expect(ultraGate().reasons.some((r) => r.includes('avg sharp'))).toBe(true);
  });

  it('caps sharp samples at 20', () => {
    recordPaint('low', 10, 1);
    for (let i = 0; i < 25; i++) recordSharp('low', 10);
    expect(statsStore.benchmarks.low.sharpSamples).toBe(20);
    recordSharp('missing', 1);
    expect(statsStore.benchmarks.missing).toBeUndefined();
  });
});

describe('createStatsSampler', () => {
  it('samples fps, render stats, and heap on rAF ticks', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      callbacks.length = 0;
    });
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('performance', {
      now: () => now,
      memory: { usedJSHeapSize: 1048576, jsHeapSizeLimit: 8 * 1048576 },
    });

    const source: StatsSource = {
      getRenderStats: () => ({
        total: 10,
        visible: 8,
        drawn: 7,
        mode: 'fast',
        lastRenderMs: 4,
        pixelRatio: 2,
        scale: 1.5,
      }),
      getWorldInfo: () => world,
      getCanvasSize: () => ({ width: 10, height: 20 }),
      getTransform: () => ({ x: 3, y: 4, scale: 1.5 }),
    };

    const sampler = createStatsSampler(source);
    sampler.start();
    sampler.start();
    expect(callbacks).toHaveLength(1);
    const first = callbacks[0];
    sampler.stop();
    first(0);
    sampler.start();
    callbacks.at(-1)?.(0);
    expect(statsStore.fastFrames).toBe(1);
    expect(statsStore.canvasBytes).toBe(800);
    expect(statsStore.panX).toBe(3);
    now = 500;
    source.getRenderStats = () => ({
      total: 10,
      visible: 8,
      drawn: 7,
      mode: 'sharp',
      lastRenderMs: 4,
      pixelRatio: 2,
      scale: 1.5,
    });
    callbacks[1](500);
    expect(statsStore.fps).toBeGreaterThan(0);
    expect(statsStore.world).toEqual(world);
    sampler.stop();
    sampler.stop();
  });
});
