export interface MockHex {
  q: number;
  r: number;
  x: number;
  y: number;
  fill: string;
  stroke: string;
  adjacent: unknown[];
  terrain: string | null;
  data: Record<string, unknown>;
}

export const lastGrid: { current: MockHexGridCore | null } = { current: null };

export class MockHexGridCore {
  element: HTMLElement;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  size: number;
  cull = true;
  hexes = new Map<string, MockHex>();
  transform = { x: 0, y: 0, scale: 1 };
  pixelRatio: number | 'auto' = 1;
  private selectCb: ((hex: MockHex) => void) | null = null;

  constructor(opts: {
    element: HTMLElement;
    canvas?: HTMLCanvasElement;
    width?: number;
    height?: number;
    size?: number;
  }) {
    this.element = opts.element;
    this.canvas = opts.canvas ?? document.createElement('canvas');
    this.canvas.width = 200;
    this.canvas.height = 120;
    if (!this.canvas.parentElement) this.element.appendChild(this.canvas);
    this.width = opts.width ?? 10;
    this.height = opts.height ?? 10;
    this.size = opts.size ?? 6;
    this.rebuild();
    lastGrid.current = this;
  }

  private rebuild(): void {
    this.hexes.clear();
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        const q = c - Math.floor(r / 2);
        const hex: MockHex = {
          q,
          r,
          x: c * 10,
          y: r * 10,
          fill: '#000',
          stroke: '#111',
          adjacent: [],
          terrain: null,
          data: {},
        };
        this.hexes.set(`${q},${r}`, hex);
      }
    }
  }

  destroy(): void {
    lastGrid.current = null;
  }

  setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.rebuild();
  }

  setCull(cull: boolean): void {
    this.cull = !!cull;
  }

  getHex(q: number, r: number): MockHex | undefined {
    return this.hexes.get(`${q},${r}`);
  }

  on(event: string, callback: (data: MockHex) => void): void {
    if (event === 'select') this.selectCb = callback;
  }

  emitSelect(col: number, row: number): void {
    const q = col - Math.floor(row / 2);
    const hex = this.getHex(q, row);
    if (hex) this.selectCb?.(hex);
  }

  customRender: ((ctx: unknown, hex: MockHex, size: number) => void) | null = null;

  setCustomRender(callback: (ctx: unknown, hex: MockHex, size: number) => void): void {
    this.customRender = callback;
  }

  getRenderStats() {
    return {
      total: this.hexes.size,
      visible: this.hexes.size,
      drawn: this.hexes.size,
      mode: 'sharp' as const,
      lastRenderMs: 1,
      pixelRatio: 1,
      scale: this.transform.scale,
    };
  }

  getTransform() {
    return { ...this.transform };
  }

  getVisibleHexes(): MockHex[] {
    return [...this.hexes.values()];
  }

  zoomIn(): void {
    this.transform.scale *= 1.5;
  }

  zoomOut(): void {
    this.transform.scale /= 1.5;
  }
}

export { MockHexGridCore as VdHexGridCore };
