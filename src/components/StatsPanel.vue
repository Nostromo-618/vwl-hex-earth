<script setup lang="ts">
import { computed } from 'vue';
import FloatingPanel from './FloatingPanel.vue';
import { HEX_SIZE, TIERS } from '../earth/world';
import {
  estimateModelBytes,
  kindName,
  statsStore,
  ultraGate,
  waterCells,
  type TierBenchmark,
} from '../earth/stats';

defineProps<{ open: boolean; resetKey?: number }>();
defineEmits<{ (e: 'close'): void }>();

const gate = computed(() => ultraGate());

function fmt(value: number | null, digits = 1): string {
  return value == null ? 'n/a' : value.toFixed(digits);
}

function countKinds(counts: number[] | undefined): Array<{ name: string; count: number }> {
  if (!counts) return [];
  return counts
    .map((count, i) => ({ name: kindName(i), count }))
    .filter((entry) => entry.count > 0);
}

function percentile(part: number, total: number): string {
  return total > 0 ? `${((part / total) * 100).toFixed(part / total >= 0.1 ? 1 : 2)}%` : '0%';
}

function benchOf(tier: string): TierBenchmark | undefined {
  return statsStore.benchmarks[tier];
}
</script>

<template>
  <FloatingPanel
    :open="open"
    name="stats"
    title="Stats"
    :initial-x="350"
    :initial-y="48"
    :reset-key="resetKey"
    @close="$emit('close')"
  >
    <div class="stats-body">
      <section>
        <h4>Performance</h4>
        <div class="row">
          <span>FPS</span><b>{{ statsStore.fps }}</b>
        </div>
        <div class="row">
          <span>Frame</span><b>{{ fmt(statsStore.frameMs) }} ms</b>
        </div>
        <div class="row">
          <span>Last sharp render</span><b>{{ fmt(statsStore.lastSharpMs) }} ms</b>
        </div>
        <div class="row">
          <span>Fast frames</span><b>{{ statsStore.fastFrames }}</b>
        </div>
      </section>

      <section>
        <h4>Grid</h4>
        <div class="row">
          <span>Region</span><b>{{ statsStore.world?.region ?? '—' }}</b>
        </div>
        <div class="row">
          <span>Tier</span><b>{{ statsStore.world?.tier ?? '—' }}</b>
        </div>
        <div class="row">
          <span>Cols × rows</span>
          <b>{{
            statsStore.world ? `${statsStore.world.cols} × ${statsStore.world.rows}` : '—'
          }}</b>
        </div>
        <div class="row">
          <span>Cell</span
          ><b>{{
            statsStore.world
              ? statsStore.world.cellUnit === 'km'
                ? `${statsStore.world.cell.toFixed(1)} km`
                : `${statsStore.world.cell}°`
              : '—'
          }}</b>
        </div>
        <div class="row">
          <span>Total hexes</span><b>{{ statsStore.world?.hexes.toLocaleString() ?? '—' }}</b>
        </div>
        <div class="row">
          <span>Visible / drawn</span><b>{{ statsStore.visible }} / {{ statsStore.drawn }}</b>
        </div>
        <div class="row">
          <span>Mode</span><b :class="`mode-${statsStore.mode}`">{{ statsStore.mode }}</b>
        </div>
      </section>

      <section>
        <h4>Terrain</h4>
        <template v-if="statsStore.world">
          <div class="row">
            <span>Land / water</span>
            <b>
              {{ percentile(statsStore.world.landCells, statsStore.world.hexes) }} /
              {{ percentile(waterCells(statsStore.world), statsStore.world.hexes) }}
            </b>
          </div>
          <div v-for="kind in countKinds(statsStore.world.kindCounts)" :key="kind.name" class="row">
            <span>{{ kind.name }}</span>
            <b>{{ kind.count.toLocaleString() }}</b>
          </div>
        </template>
        <div v-else class="row"><span>—</span><b>painting…</b></div>
      </section>

      <section>
        <h4>Memory</h4>
        <div class="row">
          <span>JS heap</span>
          <b>
            {{
              statsStore.heapUsedMB == null
                ? 'n/a'
                : `${fmt(statsStore.heapUsedMB, 0)} / ${fmt(statsStore.heapLimitMB, 0)} MB`
            }}
          </b>
        </div>
        <div class="row">
          <span>Model estimate</span>
          <b>{{ (estimateModelBytes(statsStore.world) / 1048576).toFixed(1) }} MB</b>
        </div>
        <div class="row">
          <span>Canvas buffer</span>
          <b>{{ (statsStore.canvasBytes / 1048576).toFixed(1) }} MB</b>
        </div>
      </section>

      <section>
        <h4>View</h4>
        <div class="row">
          <span>Scale</span><b>{{ fmt(statsStore.scale, 2) }}</b>
        </div>
        <div class="row">
          <span>Hex size</span><b>{{ Math.round(HEX_SIZE * statsStore.scale) }} px</b>
        </div>
        <div class="row">
          <span>Pan</span
          ><b>{{ Math.round(statsStore.panX) }}, {{ Math.round(statsStore.panY) }}</b>
        </div>
        <div class="row">
          <span>Pixel ratio</span><b>{{ fmt(statsStore.pixelRatio, 2) }}</b>
        </div>
      </section>

      <section>
        <h4>Benchmarks</h4>
        <div v-if="statsStore.benchmarkRunning" class="row"><span>measuring…</span><b></b></div>
        <div v-for="tier in TIERS" :key="tier.id" class="bench">
          <div class="bench-name">{{ tier.id }} ({{ tier.label }})</div>
          <div class="row">
            <span>first paint</span><b>{{ fmt(benchOf(tier.id)?.firstPaintMs ?? null, 0) }} ms</b>
          </div>
          <div class="row">
            <span>avg sharp</span><b>{{ fmt(benchOf(tier.id)?.avgSharpMs ?? null, 0) }} ms</b>
          </div>
          <div class="row">
            <span>heap</span><b>{{ fmt(benchOf(tier.id)?.heapMB ?? null, 0) }} MB</b>
          </div>
        </div>
        <div class="row gate-row">
          <span>ultra gate</span>
          <b :class="gate.passed ? 'gate-pass' : 'gate-fail'">
            {{ gate.passed ? 'passed' : (gate.reasons[0] ?? 'failed') }}
          </b>
        </div>
      </section>
    </div>
  </FloatingPanel>
</template>

<style scoped>
.stats-body {
  padding: 6px 10px 10px;
}

section {
  padding: 6px 0;
  border-bottom: 1px dashed var(--vd-border-color);
}

section:last-child {
  border-bottom: none;
}

h4 {
  margin: 2px 0 6px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vd-text-muted);
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 1px 0;
}

.row span {
  color: var(--vd-text-muted);
}

.row b {
  text-align: right;
  font-weight: 600;
}

.mode-fast {
  color: #f59e0b;
}

.mode-sharp {
  color: #22c55e;
}

.bench {
  padding: 4px 0 2px;
}

.bench-name {
  font-weight: 600;
  margin-bottom: 2px;
}

.gate-row {
  padding-top: 6px;
}

.gate-pass {
  color: #22c55e;
}

.gate-fail {
  color: #f87171;
  max-width: 170px;
}
</style>
