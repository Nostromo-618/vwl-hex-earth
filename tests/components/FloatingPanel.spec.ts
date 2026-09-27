import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, afterEach } from 'vitest';
import FloatingPanel from '../../src/components/FloatingPanel.vue';
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe('FloatingPanel accessibility and constraints', () => {
  it('moves with arrow keys, collapses, resets and clamps after resize', async () => {
    const wrapper = mount(FloatingPanel, {
      props: { open: true, name: 'controls', title: 'Controls' },
      attachTo: document.body,
    });
    const head = wrapper.get('[data-testid="controls-head"]');
    const panel = wrapper.get('[data-testid="controls-panel"]');
    await head.trigger('keydown', { key: 'ArrowRight', shiftKey: true });
    expect((panel.element as HTMLElement).style.left).toBe('48px');
    await head.trigger('keydown', { key: 'ArrowDown' });
    expect((panel.element as HTMLElement).style.top).toBe('56px');
    await head.trigger('keydown', { key: 'Tab' });
    await wrapper.get('button[aria-label="Collapse Controls"]').trigger('click');
    expect(wrapper.get('button[aria-label="Expand Controls"]').attributes('aria-expanded')).toBe(
      'false',
    );
    await wrapper.setProps({ resetKey: 1 });
    await flushPromises();
    expect((panel.element as HTMLElement).style.left).toBe('16px');
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    window.dispatchEvent(new Event('resize'));
    await flushPromises();
    expect(
      parseFloat((wrapper.get('aside').element as HTMLElement).style.left),
    ).toBeGreaterThanOrEqual(4);
    wrapper.unmount();
  });
  it('remains usable when persistence is denied and ignores non-primary drags', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const wrapper = mount(FloatingPanel, {
      props: { open: true, name: 'controls', title: 'Controls' },
    });
    const head = wrapper.get('header');
    head.element.dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 900 }));
    await head.trigger('keydown', { key: 'ArrowLeft' });
    expect((wrapper.get('aside').element as HTMLElement).style.left).toBe('8px');
    wrapper.unmount();
  });
});
