<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
const props = withDefaults(
  defineProps<{
    open: boolean;
    name: string;
    title: string;
    initialX?: number;
    initialY?: number;
    resetKey?: number;
  }>(),
  { initialX: 16, initialY: 48, resetKey: 0 },
);
const emit = defineEmits<{ close: [] }>();
const panel = ref<HTMLElement | null>(null);
const collapsed = ref(false);
const key = `vdl-hex-earth:${props.name}:position`;
function initial() {
  return { x: props.initialX, y: props.initialY };
}
function load() {
  try {
    const p = JSON.parse(localStorage.getItem(key) || 'null') as { x: number; y: number } | null;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
  } catch {
    /* storage denied or malformed */
  }
  return initial();
}
const pos = ref(load());
let drag: { dx: number; dy: number } | null = null;
let observer: ResizeObserver | null = null;
function save() {
  try {
    localStorage.setItem(key, JSON.stringify(pos.value));
  } catch {
    /* optional persistence */
  }
}
function constrain() {
  const el = panel.value;
  if (!el) return;
  const parent = el.parentElement;
  const w = parent?.clientWidth || window.innerWidth;
  const h = parent?.clientHeight || window.innerHeight;
  pos.value = {
    x: Math.max(4, Math.min(pos.value.x, w - (el.offsetWidth || 310) - 4)),
    y: Math.max(4, Math.min(pos.value.y, h - (el.offsetHeight || 360) - 4)),
  };
}
function observePanel() {
  observer?.disconnect();
  if (panel.value?.parentElement) observer?.observe(panel.value.parentElement);
  constrain();
}
function endDrag() {
  drag = null;
  window.removeEventListener('pointermove', onDrag);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
  save();
}
function onDrag(event: PointerEvent) {
  if (!drag) return;
  pos.value = { x: event.clientX - drag.dx, y: event.clientY - drag.dy };
  constrain();
}
function startDrag(event: PointerEvent) {
  if (
    event.button > 0 ||
    (event.target as HTMLElement).closest('button') ||
    window.innerWidth <= 640
  )
    return;
  event.preventDefault();
  drag = { dx: event.clientX - pos.value.x, dy: event.clientY - pos.value.y };
  window.addEventListener('pointermove', onDrag);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}
function onKey(event: KeyboardEvent) {
  const move: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const d = move[event.key];
  if (!d) return;
  event.preventDefault();
  const step = event.shiftKey ? 32 : 8;
  pos.value = { x: pos.value.x + d[0] * step, y: pos.value.y + d[1] * step };
  constrain();
  save();
}
watch(
  () => props.open,
  async () => {
    await nextTick();
    observePanel();
  },
);
watch(
  () => props.resetKey,
  async () => {
    pos.value = initial();
    collapsed.value = false;
    await nextTick();
    constrain();
    save();
  },
);
watch(collapsed, async () => {
  await nextTick();
  constrain();
});
onMounted(() => {
  constrain();
  window.addEventListener('resize', constrain);
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(constrain);
    observePanel();
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', constrain);
  observer?.disconnect();
  endDrag();
});
</script>
<template>
  <aside
    v-if="open"
    ref="panel"
    class="vdl-earth-panel"
    :class="`${name}-panel`"
    :data-testid="`${name}-panel`"
    :aria-label="title"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
  >
    <header
      class="vdl-earth-panel-head"
      :data-testid="`${name}-head`"
      tabindex="0"
      :aria-label="`Move ${title}. Use arrow keys; Shift for larger steps.`"
      @pointerdown="startDrag"
      @keydown="onKey"
    >
      <strong>{{ title }}</strong>
      <button
        type="button"
        :aria-label="`${collapsed ? 'Expand' : 'Collapse'} ${title}`"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        {{ collapsed ? '+' : '−' }}
      </button>
      <button
        type="button"
        :aria-label="`Close ${title.toLowerCase()}`"
        :data-testid="`${name}-close`"
        @click="emit('close')"
      >
        ×
      </button>
    </header>
    <div v-show="!collapsed" class="vdl-earth-panel-body"><slot /></div>
  </aside>
</template>
<style scoped>
.vdl-earth-panel {
  position: absolute;
  z-index: 5;
  width: 310px;
  max-width: calc(100% - 8px);
  max-height: calc(100% - 56px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--vd-bg-primary);
  color: var(--vd-text-primary);
  border: 1px solid var(--vd-border-color);
  border-radius: 10px;
  box-shadow: 0 8px 28px #0003;
  font-size: 12px;
}
.vdl-earth-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: grab;
  touch-action: none;
  background: var(--vd-bg-secondary);
  flex-shrink: 0;
}
.vdl-earth-panel-head strong {
  margin-right: auto;
  letter-spacing: 0.08em;
}
.vdl-earth-panel-head button {
  background: transparent;
  color: var(--vd-text-primary);
  border: 1px solid var(--vd-border-color);
  border-radius: 4px;
  min-width: 32px;
  min-height: 32px;
  cursor: pointer;
  font-size: 18px;
}
.vdl-earth-panel-head:focus-visible {
  outline: 2px solid var(--vd-color-primary);
  outline-offset: -2px;
}
.vdl-earth-panel-body {
  overflow: auto;
  overscroll-behavior: contain;
}
@media (max-width: 640px) {
  .vdl-earth-panel {
    left: 8px !important;
    right: 8px;
    top: auto !important;
    bottom: calc(8px + env(safe-area-inset-bottom));
    width: auto;
    max-height: 52%;
  }
  .vdl-earth-panel-head {
    cursor: default;
    touch-action: auto;
  }
  .vdl-earth-panel-head button {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>
