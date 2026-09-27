import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { statsStore } from '../../src/earth/stats';

const zoomIn = vi.fn();
const zoomOut = vi.fn();
const resetView = vi.fn();
const runBenchmarks = vi.fn();
const setTheme = vi.fn();

vi.mock('../../src/components/HexEarth.vue', () => ({
  default: defineComponent({
    name: 'HexEarth',
    props: { tier: String, pathMode: Boolean, region: String },
    emits: ['status'],
    setup(_props, { expose }) {
      expose({ zoomIn, zoomOut, resetView, runBenchmarks });
      return () => h('div', { 'data-testid': 'hex-earth-stub' });
    },
  }),
}));

vi.mock('@vanduo-oss/vd3', () => ({
  VdButton: defineComponent({
    name: 'VdButton',
    setup(_props, { slots, attrs }) {
      return () => h('button', attrs, slots.default?.());
    },
  }),
  VdSwitch: defineComponent({
    name: 'VdSwitch',
    props: { modelValue: Boolean, label: String },
    emits: ['update:modelValue'],
    setup(props, { emit, attrs }) {
      return () =>
        h(
          'button',
          {
            ...attrs,
            type: 'button',
            onClick: () => emit('update:modelValue', !props.modelValue),
          },
          props.label,
        );
    },
  }),
  VdThemeSwitcher: defineComponent({
    name: 'VdThemeSwitcher',
    setup() {
      return () => h('div', { 'data-testid': 'theme-stub' });
    },
  }),
  useThemePreference: () => ({ setTheme }),
}));

import App from '../../src/App.vue';

beforeEach(() => {
  localStorage.clear();
  zoomIn.mockClear();
  zoomOut.mockClear();
  resetView.mockClear();
  runBenchmarks.mockClear();
  setTheme.mockClear();
  statsStore.benchmarks = {};
  vi.useFakeTimers();
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('App', () => {
  it('defaults to dark theme when no preference is stored', () => {
    mount(App);
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('does not override an existing theme preference', () => {
    localStorage.setItem('vanduo-theme-preference', 'light');
    mount(App);
    expect(setTheme).not.toHaveBeenCalled();
  });

  it('defaults to Europe ultra with the 259.2k tier enabled', async () => {
    const wrapper = mount(App);
    expect(wrapper.get('[data-testid="region-europe"]').classes()).toContain('active');
    const ultra = wrapper.get('[data-testid="tier-ultra"]');
    expect((ultra.element as HTMLButtonElement).disabled).toBe(false);
    expect(ultra.classes()).toContain('active');
    await wrapper.get('[data-testid="tier-low"]').trigger('click');
    expect(wrapper.get('[data-testid="tier-low"]').classes()).toContain('active');
    await wrapper.get('[data-testid="tier-ultra"]').trigger('click');
    expect(wrapper.get('[data-testid="tier-ultra"]').classes()).toContain('active');
    await wrapper.get('[data-testid="tier-ultra"]').trigger('click');
  });

  it('wires zoom, path mode, stats, and mid-tier selection', async () => {
    const wrapper = mount(App);
    await wrapper.get('[data-testid="zoom-in"]').trigger('click');
    await wrapper.get('[data-testid="zoom-out"]').trigger('click');
    await wrapper.get('[data-testid="zoom-fit"]').trigger('click');
    expect(zoomIn).toHaveBeenCalled();
    expect(zoomOut).toHaveBeenCalled();
    expect(resetView).toHaveBeenCalled();
    await wrapper.get('[data-testid="stats-toggle"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-panel"]').exists()).toBe(true);
    await wrapper.get('[data-testid="path-mode"] button').trigger('click');
    await wrapper.get('[data-testid="tier-mid"]').trigger('click');
    expect(wrapper.get('[data-testid="tier-mid"]').classes()).toContain('active');
    expect(wrapper.get('[data-testid="region-europe"]').classes()).toContain('active');
    await wrapper.get('[data-testid="region-world"]').trigger('click');
    expect(wrapper.get('[data-testid="region-world"]').classes()).toContain('active');
    await wrapper.get('[data-testid="region-world"]').trigger('click');
  });

  it('skips background benchmarks when nobench=1', async () => {
    window.history.pushState({}, '', '/?nobench=1');
    mount(App);
    await vi.advanceTimersByTimeAsync(1000);
    expect(runBenchmarks).not.toHaveBeenCalled();
  });

  it('runs comparative benchmarks only on request', async () => {
    const wrapper = mount(App);
    await vi.advanceTimersByTimeAsync(800);
    expect(runBenchmarks).not.toHaveBeenCalled();
    await wrapper.get('[data-testid="run-benchmarks"]').trigger('click');
    await flushPromises();
    expect(runBenchmarks).toHaveBeenCalled();
  });
});
