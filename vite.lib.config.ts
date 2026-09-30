import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist/lib',
    emptyOutDir: true,
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index', cssFileName: 'style' },
    rolldownOptions: {
      external: [
        'vue',
        '@vanduo-oss/vd3',
        '@vanduo-oss/vwl-cbun/hex-grid',
        '@vanduo-oss/vwl-cbun/hex-grid/hex-math',
      ],
    },
  },
});
