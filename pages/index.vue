<template>
    <div>
        <HeroSection />
        <AboutCarousel />
        <PopularProductsSection />
    </div>
</template>

<script setup lang="ts">
import HeroSection from '~/components/HeroSection.vue'
import AboutCarousel from '~/components/AboutCarousel.vue'
import PopularProductsSection from '~/components/PopularProductsSection.vue'

definePageMeta({
    title: 'BLAGOVA_SWEETS — Свежие десерты каждый день'
})

useSeoMeta({
    title: 'BLAGOVA_SWEETS — Свежие десерты каждый день',
    ogTitle: 'BLAGOVA_SWEETS — Свежие десерты каждый день',
    description: 'Свежие пряники с доставкой по России, Беларусии и Казахстану.',
    ogDescription: 'Свежие пряники с доставкой по России, Беларусии и Казахстану.',
    ogType: 'website',
    ogUrl: 'https://blagovasweets.ru/',
    ogImage: 'https://blagovasweets.ru/og-bakery.jpg',
    twitterCard: 'summary_large_image'
})
</script>
