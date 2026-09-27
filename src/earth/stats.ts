import { reactive } from 'vue';
import type { HexRenderStats } from '@vanduo-oss/vdl-cbun/hex-grid';
import { KIND_NAMES } from './terrain';

/** World-side counters the canvas core does not know about. */
export interface HexWorldInfo {
  region: string;
  tier: string;
  cols: number;
  rows: number;
  hexes: number;
  cell: number;
  cellUnit: 'deg' | 'km';
  landCells: number;
  kindCounts: number[];
  paintMs: number;
}

/** The bridge HexEarth exposes to the stats samplers. */
export interface StatsSource {
  getRenderStats(): HexRenderStats;
  getWorldInfo(): HexWorldInfo | null;
  getCanvasSize(): { width: number; height: number };
  getTransform(): { x: number; y: number; scale: number };
}

export interface TierBenchmark {
  tier: string;
  firstPaintMs: number | null;
  avgSharpMs: number | null;
  heapMB: number | null;
}

interface MutableBenchmark extends TierBenchmark {
  sharpSum: number;
  sharpSamples: number;
}

export interface UltraGate {
  passed: boolean;
  reasons: string[];
}

export const statsStore = reactive({
  fps: 0,
  frameMs: 0,
  lastSharpMs: 0,
  fastFrames: 0,
  total: 0,
  visible: 0,
  drawn: 0,
  mode: 'sharp' as 'sharp' | 'fast',
  scale: 1,
  panX: 0,
  panY: 0,
  pixelRatio: 1,
  world: null as HexWorldInfo | null,
  heapUsedMB: null as number | null,
  heapLimitMB: null as number | null,
  canvasBytes: 0,
  benchmarkRunning: false,
  benchmarks: {} as Record<string, MutableBenchmark>,
});

export function readHeapMB(): { usedMB: number; limitMB: number } | null {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  };
  if (!perf.memory) return null;
  return {
    usedMB: perf.memory.usedJSHeapSize / 1048576,
    limitMB: perf.memory.jsHeapSizeLimit / 1048576,
  };
}

/** Rough per-cell model cost (Map entry + hex object + adjacency objects). */
export const BYTES_PER_HEX = 600;

export function estimateModelBytes(world: HexWorldInfo | null): number {
  if (!world) return 0;
  const typed = world.hexes * 6; // kinds + landPct + lats + scratch arrays
  return world.hexes * BYTES_PER_HEX + typed;
}

export function waterCells(world: HexWorldInfo | null): number {
  return world ? world.hexes - world.landCells : 0;
}

export function kindName(index: number): string {
  return KIND_NAMES[index] ?? `Kind ${index}`;
}

/** Accumulate first-paint/heap for a tier; resets that tier's sharp average. */
export function recordPaint(tier: string, firstPaintMs: number, heapMB: number | null): void {
  statsStore.benchmarks[tier] = {
    tier,
    firstPaintMs,
    avgSharpMs: null,
    heapMB,
    sharpSum: 0,
    sharpSamples: 0,
  };
}

/** Accumulate one sharp-render duration for a tier (first 20 samples). */
export function recordSharp(tier: string, ms: number): void {
  const b = statsStore.benchmarks[tier];
  if (!b || b.sharpSamples >= 20) return;
  b.sharpSum += ms;
  b.sharpSamples += 1;
  b.avgSharpMs = b.sharpSum / b.sharpSamples;
}

/** The 259.2k tier ships disabled unless its measured benchmark passes. */
export function ultraGate(): UltraGate {
  const b = statsStore.benchmarks.ultra;
  const reasons: string[] = [];
  if (!b || b.firstPaintMs == null) {
    return { passed: false, reasons: ['not measured yet'] };
  }
  if (b.firstPaintMs > 2000) reasons.push(`first paint ${Math.round(b.firstPaintMs)}ms > 2000ms`);
  if (b.avgSharpMs == null || b.avgSharpMs > 250) {
    reasons.push(
      `avg sharp render ${b.avgSharpMs == null ? 'n/a' : Math.round(b.avgSharpMs)}ms > 250ms`,
    );
  }
  if (b.heapMB != null && b.heapMB > 350) reasons.push(`heap ${Math.round(b.heapMB)}MB > 350MB`);
  return { passed: reasons.length === 0, reasons };
}

export interface StatsSampler {
  start(): void;
  stop(): void;
}

/**
 * Rolling FPS + render/heap sampler. Runs one rAF loop and reads the core's
 * last-frame stats; the loop is cancelled by stop().
 */
export function createStatsSampler(source: StatsSource): StatsSampler {
  let raf = 0;
  let running = false;
  let frames = 0;
  let windowStart = 0;

  const tick = (): void => {
    if (!running) return;
    const t = performance.now();
    frames += 1;
    const elapsed = t - windowStart;
    if (elapsed >= 500) {
      statsStore.fps = Math.round((frames * 1000) / elapsed);
      statsStore.frameMs = elapsed / frames;
      frames = 0;
      windowStart = t;
    }

    const render = source.getRenderStats();
    statsStore.lastSharpMs = render.lastRenderMs;
    statsStore.total = render.total;
    statsStore.visible = render.visible;
    statsStore.drawn = render.drawn;
    statsStore.mode = render.mode;
    statsStore.scale = render.scale;
    statsStore.pixelRatio = render.pixelRatio;
    const transform = source.getTransform();
    statsStore.panX = transform.x;
    statsStore.panY = transform.y;
    if (render.mode === 'fast') statsStore.fastFrames += 1;

    const world = source.getWorldInfo();
    statsStore.world = world;
    if (world && render.mode === 'sharp') recordSharp(world.tier, render.lastRenderMs);

    const canvas = source.getCanvasSize();
    statsStore.canvasBytes = canvas.width * canvas.height * 4;

    const heap = readHeapMB();
    statsStore.heapUsedMB = heap?.usedMB ?? null;
    statsStore.heapLimitMB = heap?.limitMB ?? null;

    raf = requestAnimationFrame(tick);
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      frames = 0;
      windowStart = performance.now();
      raf = requestAnimationFrame(tick);
    },
    stop(): void {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
