import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import StatsPanel from '../../src/components/StatsPanel.vue';
import { KIND_NAMES } from '../../src/earth/terrain';
import { recordPaint, statsStore } from '../../src/earth/stats';

function resetStats(): void {
  statsStore.world = null;
  statsStore.fps = 12;
  statsStore.frameMs = 8;
  statsStore.lastSharpMs = 3;
  statsStore.fastFrames = 1;
  statsStore.visible = 10;
  statsStore.drawn = 9;
  statsStore.mode = 'sharp';
  statsStore.scale = 2;
  statsStore.panX = 4;
  statsStore.panY = 5;
  statsStore.pixelRatio = 1;
  statsStore.heapUsedMB = 20;
  statsStore.heapLimitMB = 100;
  statsStore.canvasBytes = 1048576;
  statsStore.benchmarkRunning = false;
  statsStore.benchmarks = {};
}

beforeEach(() => {
  localStorage.clear();
  resetStats();
});

afterEach(() => {
  localStorage.clear();
});

describe('StatsPanel', () => {
  it('renders nothing when closed', () => {
    const wrapper = mount(StatsPanel, { props: { open: false } });
    expect(wrapper.find('[data-testid="stats-panel"]').exists()).toBe(false);
  });

  it('shows world terrain, memory, and n/a heap fallbacks', async () => {
    statsStore.world = {
      region: 'Europe',
      tier: 'low',
      cols: 10,
      rows: 5,
      hexes: 50,
      cell: 1.5,
      cellUnit: 'deg',
      landCells: 20,
      kindCounts: KIND_NAMES.map((_, i) => (i === 3 ? 20 : 0)),
      paintMs: 9,
    };
    statsStore.heapUsedMB = null;
    const wrapper = mount(StatsPanel, { props: { open: true } });
    expect(wrapper.find('[data-testid="stats-panel"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Grass');
    expect(wrapper.text()).toContain('n/a');
    expect(wrapper.text()).toContain('low');
    expect(wrapper.text()).toContain('Europe');
    expect(wrapper.text()).toContain('1.5°');
  });

  it('shows kilometre cell size for equal-area regions', () => {
    statsStore.world = {
      region: 'Europe',
      tier: 'ultra',
      cols: 10,
      rows: 5,
      hexes: 50,
      cell: 8.2,
      cellUnit: 'km',
      landCells: 20,
      kindCounts: [],
      paintMs: 9,
    };
    const wrapper = mount(StatsPanel, { props: { open: true } });
    expect(wrapper.text()).toContain('8.2 km');
  });

  it('shows measuring state and ultra gate failure', () => {
    statsStore.benchmarkRunning = true;
    recordPaint('low', 10, 1);
    const wrapper = mount(StatsPanel, { props: { open: true } });
    expect(wrapper.text()).toContain('measuring');
    expect(wrapper.text()).toContain('not measured yet');
  });

  it('emits close from the close button', async () => {
    const wrapper = mount(StatsPanel, { props: { open: true } });
    await wrapper.get('[data-testid="stats-close"]').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('drags the panel and persists position, ignoring close-button pointerdown', async () => {
    const wrapper = mount(StatsPanel, { props: { open: true }, attachTo: document.body });
    const panel = wrapper.get('[data-testid="stats-panel"]');
    Object.defineProperty(panel.element, 'offsetWidth', { value: 310 });
    Object.defineProperty(panel.element, 'offsetHeight', { value: 360 });
    const head = wrapper.get('[data-testid="stats-head"]');
    head.element.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 40, clientY: 120, bubbles: true }),
    );
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, clientY: 160 }));
    window.dispatchEvent(new PointerEvent('pointerup'));
    await flushPromises();
    const stored = JSON.parse(localStorage.getItem('vwl-hex-earth:stats:position') ?? '{}') as {
      x: number;
      y: number;
    };
    expect(Number.isFinite(stored.x)).toBe(true);
    wrapper
      .get('[data-testid="stats-close"]')
      .element.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 1, clientY: 1, bubbles: true }),
      );
    wrapper.unmount();
  });

  it('loads a saved position and ignores malformed storage', () => {
    localStorage.setItem('vwl-hex-earth:stats:position', '{not json');
    const broken = mount(StatsPanel, { props: { open: true } });
    expect((broken.get('[data-testid="stats-panel"]').element as HTMLElement).style.left).toBe(
      '350px',
    );
    broken.unmount();
    localStorage.setItem('vwl-hex-earth:stats:position', JSON.stringify({ x: 40, y: 50 }));
    const ok = mount(StatsPanel, { props: { open: true } });
    expect((ok.get('[data-testid="stats-panel"]').element as HTMLElement).style.left).toBe('40px');
    ok.unmount();
  });

  it('shows 0% land when hexes is zero', () => {
    statsStore.world = {
      region: 'World',
      tier: 'low',
      cols: 0,
      rows: 0,
      hexes: 0,
      cell: 1,
      cellUnit: 'deg',
      landCells: 0,
      kindCounts: [],
      paintMs: 0,
    };
    const wrapper = mount(StatsPanel, { props: { open: true } });
    expect(wrapper.text()).toContain('0%');
  });
});
