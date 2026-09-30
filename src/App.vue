<script setup lang="ts">
import { VdThemeSwitcher, useThemePreference } from '@vanduo-oss/vd3';
import VwlHexEarthDemo from './VwlHexEarthDemo.vue';
const pref = useThemePreference();
try {
  if (!localStorage.getItem('vanduo-theme-preference')) pref.setTheme('dark');
} catch {
  /* host storage is optional */
}
</script>
<template>
  <VwlHexEarthDemo
    ><template #theme
      ><div data-testid="theme-switcher"><VdThemeSwitcher :menu="false" /></div></template
  ></VwlHexEarthDemo>
</template>
