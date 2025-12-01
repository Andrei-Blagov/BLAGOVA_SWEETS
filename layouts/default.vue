<template>
    <div class="min-h-screen flex flex-col">
        <Header />
        <main class="flex-1">
            <NuxtPage />
        </main>
        <Footer />
        <CookieConsent />
        <PartnerFloatingButton />
    </div>
</template>

<script setup lang="ts">
import Header from '~/components/Header.vue'
import Footer from '~/components/Footer.vue'
import PartnerFloatingButton from '~/components/PartnerFloatingButton.vue'
import CookieConsent from '~/components/CookieConsent.vue'
</script>
