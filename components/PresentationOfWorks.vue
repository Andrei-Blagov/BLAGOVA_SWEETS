<template>
    <section class="bg-neutral-50">
        <!-- <div class="max-w-6xl mx-auto px-4 grid lg:grid-cols-[0.5fr_2fr] items-center"> -->
        <div class="max-w-6xl mx-auto px-4 py-12">
            <div class="bg-white rounded-2xl shadow-xl border border-primary-100 overflow-hidden">
                <div class="aspect-[4/3] relative" role="img" aria-live="polite" :aria-label="slides[currentSlide].alt">
                    <transition name="fade" mode="out-in">
                        <img :key="currentSlide" :src="slides[currentSlide].src" :alt="slides[currentSlide].alt"
                            class="absolute inset-0 w-full h-full object-cover" />
                    </transition>
                    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2" role="tablist"
                        aria-label="Слайды работ">
                        <span v-for="(slide, index) in slides" :key="slide.src" class="w-2 h-2 rounded-full"
                            :aria-label="slide.alt" :class="index === currentSlide ? 'bg-white' : 'bg-white/50'"
                            :aria-current="index === currentSlide" />
                    </div>
                </div>
                <div class="p-6 border-t border-neutral-100">
                    <p class="text-sm font-semibold text-primary-600 uppercase tracking-wide">
                        Галерея работ
                    </p>
                    <p class="mt-2 text-neutral-700">
                        Каждые 1,5 секунды мы показываем новое изделие из нашей витрины.
                    </p>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

definePageMeta({
    title: 'BLAGOVA_SWEETS — Сотрудничество'
})

useSeoMeta({
    title: 'BLAGOVA_SWEETS — Сотрудничество',
    description: 'Условия сотрудничества с BLAGOVA_SWEETS: производство, документы и заявка на партнёрство.',
    ogTitle: 'BLAGOVA_SWEETS — Сотрудничество',
    ogDescription: 'Скачайте документы и узнайте об условиях партнёрства с BLAGOVA_SWEETS.',
    ogImage: 'https://blagovasweets.ru/og-bakery.jpg',
    ogType: 'website'
})

const slides = [
    { src: '/gingerbread-man.jpg', alt: 'Фирменные пряники BLAGOVA_SWEETS' },
    { src: '/cake-frictes.jpg', alt: 'Ягодный торт' },
    { src: '/croissant-2.jpg', alt: 'Слоёные круассаны' },
    { src: '/gingerbread-fox.png', alt: 'Именные пряники для событий' }
]

const currentSlide = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
    timer = setInterval(() => {
        currentSlide.value = (currentSlide.value + 1) % slides.length
    }, 3500)
})

onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.6s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
