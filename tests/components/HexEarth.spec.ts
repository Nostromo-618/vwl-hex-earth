import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lastGrid } from '../helpers/mock-hex-grid';

const land = vi.hoisted(() => {
  const queue: Array<(value: (lon: number, lat: number) => boolean) => void> = [];
  return {
    delay: false,
    landAt: () => true,
    flush(): void {
      const resolve = queue.shift();
      resolve?.(land.landAt);
    },
    create(): Promise<(lon: number, lat: number) => boolean> {
      if (!land.delay) return Promise.resolve(land.landAt);
      return new Promise((resolve) => {
        queue.push(resolve);
      });
    },
  };
});

vi.mock('@vanduo-oss/vdl-cbun/hex-grid', async () => import('../helpers/mock-hex-grid'));

vi.mock('../../src/earth/geoLand', () => ({
  createGeoLandTest: () => land.create(),
}));

vi.mock('../../src/earth/terrain', async () => {
  const actual =
    await vi.importActual<typeof import('../../src/earth/terrain')>('../../src/earth/terrain');
  return {
    ...actual,
    buildWorld: (landAt: (lon: number, lat: number) => boolean, cols: number, rows: number) => ({
      kinds: new Uint8Array(cols * rows),
      landPct: new Float32Array(cols * rows),
      cols,
      rows,
      landCells: landAt(0, 0) ? cols * rows : 0,
    }),
  };
});

import HexEarth from '../../src/components/HexEarth.vue';

async function paintFlush(): Promise<void> {
  await flushPromises();
  await new Promise((resolve) => {
    requestAnimationFrame(() => resolve(undefined));
  });
  await flushPromises();
}

describe('HexEarth', () => {
  beforeEach(() => {
    land.delay = false;
    lastGrid.current = null;
  });

  afterEach(() => {
    lastGrid.current = null;
  });

  it('paints the default tier and reports status', async () => {
    const wrapper = mount(HexEarth, {
      props: { tier: 'low', pathMode: false },
      attachTo: document.body,
    });
    await paintFlush();
    const status = wrapper.emitted('status')?.flat() ?? [];
    expect(status.some((s) => String(s).includes('painted 240×120'))).toBe(true);
    expect(wrapper.get('[data-testid="hex-host"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('selects a hex for coordinates, then draws a path in path mode', async () => {
    const wrapper = mount(HexEarth, {
      props: { tier: 'low', pathMode: false },
      attachTo: document.body,
    });
    await paintFlush();
    lastGrid.current?.emitSelect(2, 2);
    expect(
      wrapper
        .emitted('status')
        ?.flat()
        .some((s) => String(s).includes('°')),
    ).toBe(true);
    await wrapper.setProps({ pathMode: true });
    lastGrid.current?.emitSelect(1, 1);
    expect(
      wrapper
        .emitted('status')
        ?.flat()
        .some((s) => String(s).includes('A set')),
    ).toBe(true);
    lastGrid.current?.emitSelect(5, 4);
    expect(
      wrapper
        .emitted('status')
        ?.flat()
        .some((s) => String(s).includes('path drawn')),
    ).toBe(true);
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      shadowColor: '',
      shadowBlur: 0,
    };
    const overlay = lastGrid.current?.customRender;
    expect(overlay).toBeTypeOf('function');
    for (const hex of lastGrid.current?.hexes.values() ?? []) {
      overlay?.(ctx, hex, 6);
    }
    const marked = [...(lastGrid.current?.hexes.values() ?? [])].filter(
      (h) => h.data.p !== undefined,
    );
    expect(marked.length).toBeGreaterThan(1);
    expect(marked.some((h) => h.data.a === 0)).toBe(true);
    expect(marked.some((h) => h.data.a === 1)).toBe(true);
    await wrapper.setProps({ pathMode: false });
    expect(wrapper.emitted('status')?.flat().at(-1)).toBe('path mode off');
    wrapper.unmount();
  });

  it('cancels an in-flight paint when the tier changes', async () => {
    land.delay = true;
    const wrapper = mount(HexEarth, {
      props: { tier: 'low', pathMode: false },
      attachTo: document.body,
    });
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve(undefined));
    });
    await wrapper.setProps({ tier: 'mid' });
    land.flush();
    await flushPromises();
    land.flush();
    await flushPromises();
    const status = wrapper.emitted('status')?.flat().map(String) ?? [];
    expect(status.filter((s) => s.startsWith('painted')).at(-1)).toContain('360×180');
    wrapper.unmount();
  });

  it('runs offscreen benchmarks and exposes zoom helpers', async () => {
    const wrapper = mount(HexEarth, {
      props: { tier: 'low', pathMode: false },
      attachTo: document.body,
    });
    await paintFlush();
    const vm = wrapper.vm as {
      zoomIn: () => void;
      zoomOut: () => void;
      resetView: () => void;
      runBenchmarks: () => Promise<void>;
      getStats: () => { world: { tier: string } | null };
      getVisibleCount: () => number;
    };
    const scale0 = lastGrid.current?.transform.scale ?? 1;
    vm.zoomIn();
    expect(lastGrid.current?.transform.scale).toBeCloseTo(scale0 * 1.5);
    vm.zoomOut();
    vm.resetView();
    await vm.runBenchmarks();
    expect(vm.getVisibleCount()).toBeGreaterThan(0);
    expect(vm.getStats().world?.tier).toBe('low');
    wrapper.unmount();
  });
});
