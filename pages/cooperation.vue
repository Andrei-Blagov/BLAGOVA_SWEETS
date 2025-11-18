<template>
    <div>
        <section class="bg-gradient-to-b from-primary-50 to-white py-16 lg:py-20">
            <div class="max-w-6xl mx-auto px-4 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
                <div>
                    <p class="text-sm font-semibold tracking-[0.32em] uppercase text-primary-600">
                        Партнёрам
                    </p>
                    <h1 class="mt-4 text-4xl lg:text-5xl font-bold text-neutral-900">
                        Сотрудничество с BLAGOVA_SWEETS
                    </h1>
                    <p class="mt-6 text-lg text-neutral-600">
                        Мы готовим авторские пряники, капкейки и торты уже более 8 лет и снабжаем кофейни,
                        корпоративных заказчиков и маркетплейсы по всей России. На этой странице мы собрали
                        ключевую информацию о производстве, документацию и материалы, чтобы вам было проще
                        начать партнёрство.
                    </p>
                    <div class="mt-8 grid gap-4 sm:grid-cols-2">
                        <div class="p-5 rounded-xl bg-white shadow-card border border-primary-100">
                            <p class="text-sm font-medium text-primary-600 uppercase tracking-wide">
                                Производство
                            </p>
                            <p class="mt-2 text-neutral-700">
                                Собственное цеховое оборудование и HACCP-контроль качества.
                            </p>
                        </div>
                        <div class="p-5 rounded-xl bg-white shadow-card border border-primary-100">
                            <p class="text-sm font-medium text-primary-600 uppercase tracking-wide">
                                Логистика
                            </p>
                            <p class="mt-2 text-neutral-700">
                                Отправляем в РФ, Беларусь и Казахстан, работаем с холодной доставкой.
                            </p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-2xl shadow-xl border border-primary-100 overflow-hidden">
                    <div class="aspect-[4/3] relative" role="img" aria-live="polite"
                        :aria-label="slides[currentSlide].alt">
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

        <section class="max-w-6xl mx-auto px-4 py-16 space-y-10">
            <div class="grid gap-6 lg:grid-cols-3">
                <article v-for="benefit in benefits" :key="benefit.title" class="p-6 rounded-2xl bg-white shadow-card">
                    <h3 class="text-xl font-semibold text-neutral-900">
                        {{ benefit.title }}
                    </h3>
                    <p class="mt-3 text-neutral-600">
                        {{ benefit.description }}
                    </p>
                </article>
            </div>

            <div id="documents" class="bg-neutral-50 border border-neutral-100 rounded-2xl p-8">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                        <p class="text-sm font-semibold text-primary-600 uppercase tracking-[0.3em]">
                            Документы
                        </p>
                        <h2 class="mt-3 text-3xl font-bold text-neutral-900">
                            Скачать реквизиты и сертификаты
                        </h2>
                        <p class="mt-4 text-neutral-600 max-w-2xl">
                            Мы подготовили пакет файлов, который обычно запрашивают для закупок: реквизиты,
                            сертификаты качества и подтверждение регистрации. Файлы актуальны и поддерживаются
                            в формате PDF.
                        </p>
                    </div>
                    <div class="flex flex-wrap gap-4">
                        <a v-for="doc in documents" :key="doc.href" :href="doc.href" download
                            class="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-primary-200 bg-white text-primary-700 font-semibold hover:bg-primary-50 transition">
                            <span>{{ doc.label }}</span>
                        </a>
                    </div>
                </div>
            </div>

            <div id="application" class="bg-primary-600 text-white rounded-3xl p-10 grid gap-8 lg:grid-cols-2">
                <div>
                    <p class="text-sm uppercase tracking-[0.3em] text-white/80">
                        Заявка
                    </p>
                    <h2 class="mt-4 text-3xl font-bold">
                        Давайте обсудим ваше предложение
                    </h2>
                    <p class="mt-4 text-white/80">
                        Опишите формат сотрудничества, объёмы и пожелания. Мы ответим в течение рабочего дня и
                        подготовим персональное коммерческое предложение.
                    </p>
                    <ul class="mt-6 space-y-2 text-white/90">
                        <li v-for="point in ctaPoints" :key="point" class="flex items-start gap-3">
                            <span class="mt-1 h-2 w-2 rounded-full bg-white"></span>
                            <span>{{ point }}</span>
                        </li>
                    </ul>
                </div>
                <div class="bg-white text-neutral-900 rounded-2xl p-6 shadow-2xl">
                    <h3 class="text-xl font-semibold">Как отправить запрос</h3>
                    <ol class="mt-4 space-y-3 text-neutral-600 list-decimal list-inside">
                        <li>Заполните форму на странице контактов или напишите на почту</li>
                        <li>Приложите, если нужно, бриф или техническое задание</li>
                        <li>Мы ответим с подтверждением и детальной сметой</li>
                    </ol>
                    <NuxtLink to="/contact"
                        class="mt-6 inline-flex w-full items-center justify-center px-6 py-4 rounded-full bg-primary-600 text-white font-semibold uppercase tracking-wide hover:bg-primary-700 transition">
                        Перейти к форме
                    </NuxtLink>
                </div>
            </div>
        </section>
    </div>
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

const benefits = [
    { title: 'Индивидуальные рецептуры', description: 'Настраиваем состав, глазурь и упаковку под требования бренда.' },
    { title: 'Маркетинговая поддержка', description: 'Предоставляем фото и макеты для маркетплейсов и социальных сетей.' },
    { title: 'Гибкие условия оплаты', description: 'Работаем по договору поставки, предоплате или постоплате для постоянных клиентов.' }
]

const documents = [
    { href: '/docs/certificate.pdf', label: 'Сертификат качества' },
    { href: '/docs/company-details.pdf', label: 'Реквизиты компании' }
]

const ctaPoints = [
    'Опт от 50 единиц в неделю',
    'Персональный менеджер для сетей',
    'Разработка фирменных наборов'
]

const currentSlide = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
    timer = setInterval(() => {
        currentSlide.value = (currentSlide.value + 1) % slides.length
    }, 1500)
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
