<script setup lang="ts">
const {
  t,
  locale,
  toast
} = useAtelier();
useHead(() => ({
  htmlAttrs: {
    lang: locale.value
  }
}));
let timer: ReturnType<typeof setTimeout> | undefined;
watch(toast, value => {
  if (timer) clearTimeout(timer);
  if (value) timer = setTimeout(() => {
    toast.value = '';
  }, 3500);
});
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>
<template>
  <div>
    <a class="skip-link" href="#main">{{ t('К содержимому','Skip to content','ข้ามไปเนื้อหา') }}</a>
    <AtelierHeader />
    <main id="main">
      <slot />
    </main>
    <AtelierFooter />
    <Transition name="toast">
      <div v-if="toast" class="toast-notice" role="status">
        <AtelierIcon name="check" />{{ toast }}<NuxtLink to="/cart">{{ t('Корзина','View bag','ตะกร้า') }} →</NuxtLink>
      </div>
    </Transition>
  </div>
</template>
