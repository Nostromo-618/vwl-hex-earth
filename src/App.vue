<script setup lang="ts">
import { VdThemeSwitcher, useThemePreference } from '@vanduo-oss/vd3';
import VdlHexEarthDemo from './VdlHexEarthDemo.vue';
const pref = useThemePreference();
try {
  if (!localStorage.getItem('vanduo-theme-preference')) pref.setTheme('dark');
} catch {
  /* host storage is optional */
}
</script>
<template>
  <VdlHexEarthDemo
    ><template #theme
      ><div data-testid="theme-switcher"><VdThemeSwitcher :menu="false" /></div></template
  ></VdlHexEarthDemo>
</template>
