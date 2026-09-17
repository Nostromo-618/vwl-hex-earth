<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { VdButton, VdSwitch, VdThemeSwitcher, useThemePreference } from '@vanduo-oss/vd3';
import HexEarth from './components/HexEarth.vue';
import StatsPanel from './components/StatsPanel.vue';
import { DEFAULT_TIER, HEX_SIZE, TIERS, type GridTier } from './earth/world';
import { statsStore, ultraGate } from './earth/stats';

const pref = useThemePreference();
if (!localStorage.getItem('vanduo-theme-preference')) {
  pref.setTheme('dark');
}

const map = ref<InstanceType<typeof HexEarth> | null>(null);
const tier = ref<GridTier['id']>(DEFAULT_TIER);
const pathMode = ref(false);
const statsOpen = ref(false);
const status = ref('loading world…');

const gate = computed(() => ultraGate());

/** On-screen hex radius in CSS px (canvas is drawn at engine scale). */
const hexPx = computed(() => Math.round(HEX_SIZE * statsStore.scale));

function setTier(next: GridTier['id']): void {
  if (tier.value === next) return;
  if (next === 'ultra' && !gate.value.passed) return;
  tier.value = next;
}

function tierTitle(experimental: boolean | undefined): string {
  if (!experimental) return '';
  if (gate.value.passed) return 'ultra benchmark passed';
  return `ultra disabled: ${gate.value.reasons.join('; ') || 'benchmark pending'}`;
}

function skipBackgroundBench(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('nobench') === '1';
}

onMounted(() => {
  if (skipBackgroundBench()) return;
  // Measure every tier offscreen in the background after the first paint.
  window.setTimeout(() => {
    void map.value?.runBenchmarks();
  }, 800);
});
</script>

<template>
  <div class="app-shell">
    <header class="toolbar">
      <span class="brand">HEX EARTH</span>

      <div class="segmented" role="group" aria-label="Resolution tier">
        <button
          v-for="t in TIERS"
          :key="t.id"
          class="seg-btn"
          :class="{ active: tier === t.id, disabled: t.experimental && !gate.passed }"
          type="button"
          :disabled="t.experimental && !gate.passed"
          :title="tierTitle(t.experimental)"
          :data-testid="`tier-${t.id}`"
          @click="setTier(t.id)"
        >
          {{ t.label }}<span v-if="t.experimental" class="exp"> exp</span>
        </button>
      </div>

      <div data-testid="path-mode">
        <VdSwitch v-model="pathMode" label="Path mode" size="sm" />
      </div>

      <span class="status" data-testid="status">{{ status }}</span>

      <div class="spacer"></div>

      <span class="zoom-readout" data-testid="zoom-readout" title="On-screen hex radius"
        >{{ hexPx }}px hex</span
      >

      <div class="zoom-group">
        <VdButton data-testid="zoom-out" variant="ghost" size="sm" @click="map?.zoomOut()"
          >−</VdButton
        >
        <VdButton data-testid="zoom-in" variant="ghost" size="sm" @click="map?.zoomIn()"
          >+</VdButton
        >
        <VdButton data-testid="zoom-fit" variant="ghost" size="sm" @click="map?.resetView()"
          >Fit</VdButton
        >
      </div>

      <VdButton data-testid="stats-toggle" variant="ghost" size="sm" @click="statsOpen = !statsOpen"
        >Stats</VdButton
      >

      <div data-testid="theme-switcher">
        <VdThemeSwitcher :menu="false" />
      </div>
    </header>

    <HexEarth ref="map" :tier="tier" :path-mode="pathMode" @status="status = $event" />

    <StatsPanel :open="statsOpen" @close="statsOpen = false" />

    <footer class="hint">
      drag to pan · wheel or buttons to zoom (deep enough for close inspection) · click A then B in
      path mode
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 14px;
  background: var(--vd-bg-secondary);
  border-bottom: 1px solid var(--vd-border-color);
  flex-wrap: wrap;
}

.brand {
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--vd-text-primary);
  font-size: 15px;
}

.segmented {
  display: inline-flex;
  border: 1px solid var(--vd-border-color);
  border-radius: 999px;
  overflow: hidden;
}

.seg-btn {
  border: none;
  background: transparent;
  color: var(--vd-text-muted);
  padding: 5px 12px;
  cursor: pointer;
  font-size: 13px;
}

.seg-btn.active {
  background: var(--vd-color-primary);
  color: #fff;
}

.seg-btn.disabled,
.seg-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.exp {
  font-size: 10px;
  opacity: 0.8;
}

.status {
  color: var(--vd-text-muted);
  font-size: 13px;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spacer {
  flex: 1;
}

.zoom-group {
  display: inline-flex;
  gap: 4px;
}

.zoom-readout {
  font-size: 12px;
  color: var(--vd-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.hint {
  text-align: center;
  font-size: 12px;
  color: var(--vd-text-muted);
  padding: 4px 0 6px;
  background: var(--vd-bg-primary);
}
</style>
