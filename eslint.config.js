import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      'node_modules/**',
      '.kilo/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
  },
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        ResizeObserver: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        PointerEvent: 'readonly',
        KeyboardEvent: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-closing-bracket-newline': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        fetch: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'vue/one-component-per-file': 'off',
      'vue/require-default-prop': 'off',
    },
  },
)
