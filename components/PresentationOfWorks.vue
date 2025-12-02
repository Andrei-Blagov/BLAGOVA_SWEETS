<template>
    <section class="bg-neutral-50">
        <div class="max-w-6xl mx-auto px-4 py-1">
            <div class="bg-white rounded-2xl shadow-xl border border-primary-100 overflow-hidden">
                <div v-if="currentSlide" class="relative h-[400px] overflow-hidden bg-neutral-100" role="img"
                    aria-live="polite" :aria-label="currentSlide.alt">
                    <transition name="fade" mode="out-in">
                        <img :key="currentIndex" :src="currentSlide.src" :alt="currentSlide.alt"
                            class="absolute inset-0 w-full h-full object-contain" />
                    </transition>

                    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2" role="tablist"
                        aria-label="Слайды работ">
                        <span v-for="(slide, index) in slides" :key="slide.src + index" class="w-2 h-2 rounded-full"
                            :aria-label="slide.alt" :class="index === currentIndex ? 'bg-white' : 'bg-white/50'"
                            :aria-current="index === currentIndex" />
                    </div>
                </div>

                <div class="flex flex-col items-center p-6 border-t border-neutral-100">
                    <p class="text-sm font-semibold text-primary-600 uppercase tracking-wide">
                        Галерея работ
                    </p>
                    <p class="mt-2 text-neutral-700">
                        Несколько примеров наших популярных позиций.
                    </p>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { popularProducts, type Product } from '~/data/products'

interface Slide {
    src: string
    alt: string
}

// делаем слайды из популярных товаров
const slides = computed<Slide[]>(() =>
    popularProducts.map((p: Product) => ({
        src: p.mainImage,
        alt: p.name
    }))
)

const currentIndex = ref(0)
const currentSlide = computed<Slide | null>(() => {
    const arr = slides.value
    if (!arr.length) return null

    const index = currentIndex.value % arr.length
    // если вдруг arr[index] окажется undefined — вернём null
    return arr[index] ?? null
})

let timer: number | null = null

onMounted(() => {
    if (!import.meta.client) return
    if (!slides.value.length) return

    timer = window.setInterval(() => {
        const len = slides.value.length || 1
        currentIndex.value = (currentIndex.value + 1) % len
    }, 3500)
})

onBeforeUnmount(() => {
    if (timer !== null) {
        window.clearInterval(timer)
        timer = null
    }
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
