<template>
  <NuxtLoadingIndicator />
  <NuxtLayout>
    <NuxtPage />
    <CookieConsentBanner />
  </NuxtLayout>
</template>

<script setup lang="ts"> 
import CookieConsentBanner from '~/components/CookieConsentBanner.vue'
</script>
