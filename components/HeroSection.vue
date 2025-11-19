<template>
    <section class="bg-neutral-50">
        <div class="max-w-6xl mx-auto px-4 py-16 lg:py-12
             grid gap-10 lg:grid-cols-2 items-center">
            <!-- Левый столбец: текст -->
            <div class="space-y-6">
                <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
                    Семейная пекарня с 2018 года
                </p>

                <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 leading-tight">
                    Свежие десерты
                    <span class="text-primary-500">каждый день</span>
                    от
                    <p class="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-800">BLAGOVA_SWEETS</p>
                </h1>

                <p class="text-base sm:text-lg text-neutral-600 max-w-xl">
                    Печём торты, пряники и другие различные десерты по классическим рецептам
                    из натуральных ингредиентов.
                </p>

                <div class="flex flex-wrap items-center gap-4">
                    <!-- <NuxtLink to="/menu" class="inline-flex items-center justify-center
                   px-6 py-3 rounded-pill
                   bg-primary-500 text-white
                   text-sm font-semibold uppercase tracking-wide
                   hover:bg-primary-600 transition-colors
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40">
                        Смотреть меню
                    </NuxtLink> -->

                    <NuxtLink to="https://www.ozon.ru/seller/blagova-sweets-3450915" class="inline-flex items-center justify-center
                   px-6 py-3 rounded-pill
                   border border-primary-600
                   text-white bg-primary-800
                   text-sm font-semibold uppercase tracking-wide
                   hover:bg-primary-500 transition-colors
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                        aria-label="Наш магазин на OZON">
                        Наш магазин на OZON
                    </NuxtLink>

                    <NuxtLink to="/cooperation" class="inline-flex items-center justify-center 
                   px-6 py-3 rounded-pill
                   border border-primary-600
                   bg-primary-500 text-white
                   text-sm font-semibold uppercase tracking-wide
                   hover:bg-primary-800 transition-colors
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                        aria-label="Подать заявку на сотрудничество">
                        Сотрудничество
                    </NuxtLink>
                </div>

                <div class="text-sm text-neutral-500">
                    У вас кафе, ресторан и вы хотите стать партнёром? Загляните на страницу
                    <NuxtLink to="/cooperation" class="text-primary-600 hover:text-primary-800 font-semibold"
                        aria-label="Подать заявку на сотрудничество">
                        сотрудничества.
                    </NuxtLink>
                    Там вы сможете узнать о нас больше и скачать документы.
                </div>

                <!-- <div class="flex items-center gap-2">
                    <span class="inline-block w-2.5 h-2.5 rounded-full bg-accent-green"></span>
                    <span class="text-sm text-neutral-600">
                        Сегодня в наличии: имбирные пряники, миндальные круассаны, торты
                    </span>
                </div> -->
            </div>

            <!-- Правый столбец: фото -->
            <div class="relative">
                <div class="absolute -top-6 -right-6 w-32 h-32 rounded-full
                 bg-primary-100 hidden sm:block"></div>

                <div class="relative bg-white rounded-md shadow-card overflow-hidden
                 max-w-md mx-auto">
                    <img src="/present.jpg" alt="Свежие десерты от BLAGOVA_SWEETS"
                        class="w-full h-64 sm:h-80 object-cover" />
                    <div class="p-4 sm:p-6">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-lg font-semibold text-neutral-900">
                                Рады нашему сотрудничеству!
                            </h3>
                            <!-- <span class="inline-flex items-center px-3 py-1 rounded-pill
                       text-xs text-center font-semibold bg-primary-100 text-primary-600">
                                Сегодня из печи
                            </span> -->
                        </div>
                        <p class="text-sm text-neutral-600">
                            Подарки каждому партнёру.
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- <div class="bg-white rounded-2xl shadow-xl border border-primary-100 overflow-hidden">
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
        </div> -->
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

