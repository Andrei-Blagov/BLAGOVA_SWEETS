<script setup lang="ts">
withDefaults(defineProps<{
  name: string;
  size?: number;
}>(), {
  size: 20
});
const paths: Record<string, string> = {
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  diagonal: 'M6 18 18 6M6 6h12v12',
  bag: 'M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  check: 'm5 12 4 4L19 6',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  coffee: 'M3 8h13v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Zm13 0h2a4 4 0 0 1 0 8h-2M6 2v3M11 2v3',
  gift: 'M3 8h18v4H3V8Zm2 4v9h14v-9M12 8v13M12 8C3 8 5 1 8 2c3 0 4 6 4 6Zm0 0s1-6 4-6c3-1 5 6-4 6Z',
  clock: 'M12 7v5l3 2M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0',
  leaf: 'M20 3C8 1 1 9 6 16c7 5 15-2 14-13ZM3 21 15 9',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z'
};
</script>
<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name] || paths.arrow" />
  </svg>
</template>
