<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VdHexGridCore, type HexCell, type HexRenderStats } from '@vanduo-oss/vwl-cbun/hex-grid';
import {
  HEX_SIZE,
  TIERS,
  cellToLonLat,
  cellToQ,
  findPath,
  gridFor,
  qToCol,
  tierById,
  type Cell,
  type GridTier,
} from '../earth/world';
import { regionById, type MapRegion } from '../earth/regions';
import { createGeoLandTest } from '../earth/geoLand';
import { KIND_NAMES, buildWorld, fillFor, type WorldMap } from '../earth/terrain';
import {
  createStatsSampler,
  readHeapMB,
  recordPaint,
  recordSharp,
  statsStore,
  type HexWorldInfo,
  type StatsSampler,
} from '../earth/stats';

const props = defineProps<{
  tier: GridTier['id'];
  region: MapRegion['id'];
  pathMode: boolean;
}>();

const emit = defineEmits<{
  (e: 'status', text: string): void;
}>();

/**
 * Engine zoom options. Hex Earth fits the whole world into the viewport, so the
 * engine defaults (0.3–3) cap zoom-out above the fit on most tiers and stop far
 * short of close inspection; these allow ~20× (hex radius up to 120px).
 * Passed to every grid instance, including the offscreen benchmark probes.
 */
const ZOOM_OPTIONS = {
  minScale: 0.05,
  maxScale: 20,
  zoomFactor: 0.1,
  zoomStep: 1.5,
} as const;

const host = ref<HTMLDivElement | null>(null);
let grid: InstanceType<typeof VdHexGridCore> | null = null;
let world: WorldMap | null = null;
let worldCounts: number[] | null = null;
let pathCells: Cell[] = [];
let startCell: Cell | null = null;
let lastPaintMs = 0;
let paintToken = 0;
let benchmarking = false;
let disposed = false;
let benchmarkEpoch = 0;
let initialFrame = 0;
let sampler: StatsSampler | null = null;

const resizeObserver = new ResizeObserver(() => redraw());

const EMPTY_STATS: HexRenderStats = {
  total: 0,
  visible: 0,
  drawn: 0,
  mode: 'sharp',
  lastRenderMs: 0,
  pixelRatio: 1,
  scale: 1,
};

function countKinds(kinds: Uint8Array): number[] {
  const counts = new Array(KIND_NAMES.length).fill(0) as number[];
  for (let i = 0; i < kinds.length; i++) counts[kinds[i]] += 1;
  return counts;
}

/** Kind counts are cached at paint time so the stats sampler stays cheap. */
function rememberKindCounts(counts: number[]): void {
  worldCounts = counts;
}

async function paint(
  tierId: GridTier['id'] = props.tier,
  regionId: MapRegion['id'] = props.region,
  quiet = false,
): Promise<void> {
  if (!grid) return;
  const token = ++paintToken;
  const tier = tierById(tierId);
  const region = regionById(regionId);
  const spec = gridFor(region, tier);
  if (!quiet) emit('status', `painting ${region.label} ${spec.cols}×${spec.rows}…`);
  const started = performance.now();
  const landAt = await createGeoLandTest(region);
  if (token !== paintToken || !grid) {
    return;
  }

  world = buildWorld(landAt, spec.cols, spec.rows, region);
  if (grid.width !== spec.cols || grid.height !== spec.rows) {
    grid.setDimensions(spec.cols, spec.rows);
  }
  for (const hex of grid.hexes.values()) {
    const col = qToCol(hex.q, hex.r);
    const idx = hex.r * spec.cols + col;
    const { fill, stroke } = fillFor(world.kinds, idx, spec.cols);
    hex.fill = fill;
    hex.stroke = stroke;
  }
  rememberKindCounts(countKinds(world.kinds));
  fitView();
  lastPaintMs = performance.now() - started;
  if (!quiet) {
    emit(
      'status',
      `painted ${region.label} ${spec.cols}×${spec.rows} · ${spec.hexes.toLocaleString()} hexes in ${Math.round(lastPaintMs)} ms`,
    );
  }
}

function renderNow(target: InstanceType<typeof VdHexGridCore>): void {
  target.setCull(target.cull);
}

function fitView(): void {
  if (!grid || !host.value) return;
  fitViewFor(grid, host.value);
}

function fitViewFor(target: InstanceType<typeof VdHexGridCore>, element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const hex of target.hexes.values()) {
    if (hex.x < minX) minX = hex.x;
    if (hex.y < minY) minY = hex.y;
    if (hex.x > maxX) maxX = hex.x;
    if (hex.y > maxY) maxY = hex.y;
  }
  const worldW = maxX - minX + HEX_SIZE * 2;
  const worldH = maxY - minY + HEX_SIZE * 2;
  const scale = Math.min((rect.width - 16) / worldW, (rect.height - 16) / worldH);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  target.transform = {
    scale,
    x: rect.width / 2 - cx * scale,
    y: rect.height / 2 - cy * scale,
  };
  renderNow(target);
}

function redraw(): void {
  if (grid) renderNow(grid);
}

function clearPathVisuals(): void {
  if (!grid) return;
  for (const cell of pathCells) {
    const hex = grid.getHex(cellToQ(cell.col, cell.row), cell.row);
    if (hex) {
      delete hex.data.p;
      delete hex.data.a;
    }
  }
  pathCells = [];
}

function drawOverlay(ctx: CanvasRenderingContext2D, hex: HexCell, size: number): void {
  const d = hex.data as { p?: number; a?: number };
  if (d.p === undefined) return;
  ctx.save();
  if (d.a !== undefined) {
    ctx.beginPath();
    ctx.arc(hex.x, hex.y, size * 0.68, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hex.x, hex.y, size * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = d.a === 0 ? '#4ade80' : '#f87171';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, size * 0.18);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(hex.x, hex.y, size * 0.48, 0, Math.PI * 2);
    ctx.shadowColor = 'rgba(45,212,255,0.9)';
    ctx.shadowBlur = size * 0.65;
    ctx.fillStyle = '#2dd4ff';
    ctx.fill();
    ctx.lineWidth = Math.max(1, size * 0.16);
    ctx.strokeStyle = '#06243d';
    ctx.stroke();
  }
  ctx.restore();
}

function onSelect(hex: HexCell): void {
  if (!grid) return;
  const cell: Cell = { col: qToCol(hex.q, hex.r), row: hex.r };
  const ll = cellToLonLat(cell.col, cell.row, grid.width, grid.height, regionById(props.region));
  if (!props.pathMode) {
    startCell = null;
    clearPathVisuals();
    redraw();
    emit('status', `${ll.lat.toFixed(1)}°, ${ll.lon.toFixed(1)}°`);
    return;
  }
  if (!startCell) {
    startCell = cell;
    emit('status', `A set at ${ll.lat.toFixed(1)}°, ${ll.lon.toFixed(1)}° — now click B`);
    return;
  }
  clearPathVisuals();
  const goal = cell;
  const from = startCell;
  startCell = null;
  const path = findPath(from, goal, grid.width, grid.height);
  pathCells = path;
  path.forEach((c, i) => {
    const h = grid!.getHex(cellToQ(c.col, c.row), c.row);
    if (!h) return;
    h.data.p = i;
    if (i === 0) h.data.a = 0;
    if (i === path.length - 1) h.data.a = 1;
  });
  redraw();
  emit(
    'status',
    path.length > 0 ? `path drawn: ${path.length - 1} steps from A to B` : 'no path found',
  );
}

function getWorldInfo(): HexWorldInfo | null {
  if (!world || !worldCounts) return null;
  const tier = tierById(props.tier);
  const spec = gridFor(regionById(props.region), tier);
  return {
    region: regionById(props.region).label,
    tier: tier.id,
    cols: world.cols,
    rows: world.rows,
    hexes: world.cols * world.rows,
    cell: spec.cell,
    cellUnit: spec.cellUnit,
    landCells: world.landCells,
    kindCounts: worldCounts,
    paintMs: lastPaintMs,
  };
}

function getRenderStats(): HexRenderStats {
  return grid?.getRenderStats() ?? EMPTY_STATS;
}

function getCanvasSize(): { width: number; height: number } {
  return { width: grid?.canvas.width ?? 0, height: grid?.canvas.height ?? 0 };
}

/**
 * Benchmark one tier on an offscreen core so the visible grid never flickers.
 * Measures first paint (world build + fill + fit render) and the average of a
 * few sharp re-renders, then records the results for the stats panel.
 */
async function measureTier(tier: GridTier, epoch: number): Promise<void> {
  const region = regionById(props.region);
  const spec = gridFor(region, tier);
  const landAt = await createGeoLandTest(region);
  if (disposed || epoch !== benchmarkEpoch) return;
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:960px;height:600px;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  holder.appendChild(canvas);
  document.body.appendChild(holder);

  const probe = new VdHexGridCore({
    element: holder,
    canvas,
    size: HEX_SIZE,
    width: spec.cols,
    height: spec.rows,
    rotation: -Math.PI / 6,
    pixelRatio: 'auto',
    cull: true,
    ...ZOOM_OPTIONS,
  });

  try {
    const started = performance.now();
    const probeWorld = buildWorld(landAt, spec.cols, spec.rows, region);
    for (const hex of probe.hexes.values()) {
      const col = qToCol(hex.q, hex.r);
      const idx = hex.r * spec.cols + col;
      const { fill, stroke } = fillFor(probeWorld.kinds, idx, spec.cols);
      hex.fill = fill;
      hex.stroke = stroke;
    }
    fitViewFor(probe, holder);
    const firstPaintMs = performance.now() - started;

    recordPaint(tier.id, firstPaintMs, readHeapMB()?.usedMB ?? null);
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      renderNow(probe);
      recordSharp(tier.id, performance.now() - t0);
    }
  } finally {
    probe.destroy();
    holder.remove();
  }
}

/** Background first-paint/render benchmarks for every tier (incl. ultra gate). */
async function runBenchmarks(): Promise<void> {
  if (benchmarking || disposed) return;
  const epoch = ++benchmarkEpoch;
  benchmarking = true;
  statsStore.benchmarkRunning = true;
  try {
    for (const tier of TIERS) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (disposed || epoch !== benchmarkEpoch) break;
      await measureTier(tier, epoch);
    }
  } finally {
    benchmarking = false;
    statsStore.benchmarkRunning = false;
  }
}

watch(
  () => props.tier,
  (tier) => {
    clearPathVisuals();
    startCell = null;
    void paint(tier, props.region);
  },
);

watch(
  () => props.region,
  (region) => {
    benchmarkEpoch++;
    statsStore.benchmarks = {};
    clearPathVisuals();
    startCell = null;
    void paint(props.tier, region);
  },
);

watch(
  () => props.pathMode,
  (on) => {
    if (!on) {
      startCell = null;
      clearPathVisuals();
      redraw();
    }
    emit('status', on ? 'path mode on — click hex A' : 'path mode off');
  },
);

onMounted(() => {
  if (!host.value) return;
  const spec = gridFor(regionById(props.region), tierById(props.tier));
  grid = new VdHexGridCore({
    element: host.value,
    size: HEX_SIZE,
    width: spec.cols,
    height: spec.rows,
    rotation: -Math.PI / 6,
    pixelRatio: 'auto',
    cull: true,
    ...ZOOM_OPTIONS,
  });
  grid.on('select', onSelect);
  grid.setCustomRender(drawOverlay);
  resizeObserver.observe(host.value);

  sampler = createStatsSampler({
    getRenderStats,
    getWorldInfo,
    getCanvasSize,
    getTransform: () => grid?.getTransform() ?? { x: 0, y: 0, scale: 1 },
  });
  sampler.start();

  initialFrame = requestAnimationFrame(() => {
    if (!disposed) void paint(props.tier);
  });
});

onBeforeUnmount(() => {
  disposed = true;
  benchmarkEpoch++;
  cancelAnimationFrame(initialFrame);
  paintToken++;
  resizeObserver.disconnect();
  sampler?.stop();
  sampler = null;
  grid?.destroy();
  grid = null;
});

defineExpose({
  zoomIn: () => grid?.zoomIn(),
  zoomOut: () => grid?.zoomOut(),
  resetView: () => fitView(),
  getStats: () => ({ render: getRenderStats(), world: getWorldInfo() }),
  getVisibleCount: () => grid?.getVisibleHexes().length ?? 0,
  runBenchmarks,
});
</script>

<template>
  <div ref="host" class="hex-host" data-testid="hex-host"></div>
</template>

<style scoped>
.hex-host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}
.hex-host :deep(canvas:active) {
  cursor: grabbing;
}
.hex-host {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
