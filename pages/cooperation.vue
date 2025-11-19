<template>
    <div>
        <section class="bg-gradient-to-b from-primary-50 to-white py-12 lg:py-12">
            <div class="max-w-6xl mx-auto px-4 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
                <div class="flex flex-col h-full">
                    <p class="text-sm font-semibold tracking-[0.32em] uppercase text-primary-600">
                        Партнёрам
                    </p>
                    <h1 class="mt-4 text-4xl lg:text-5xl font-bold text-neutral-900">
                        Сотрудничество с
                        <p class="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-800">
                            BLAGOVA_SWEETS
                        </p>
                    </h1>
                    <p class="mt-6 text-lg text-neutral-600">
                        Мы готовим авторские пряники, капкейки и торты уже более 5 лет и снабжаем кофейни,
                        корпоративных заказчиков и маркетплейсы по всей России. На этой странице мы собрали
                        ключевую информацию о производстве, документацию и материалы, чтобы вам было проще
                        начать партнёрство.
                    </p>
                    <div class="mt-auto grid gap-4 sm:grid-cols-2">
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
                <PresentationOfWorks />
            </div>
        </section>

        <section class="max-w-6xl mx-auto px-4 py-12 space-y-10">
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
                            Скачать реквизиты и деклорацию о соответствии (EAC)
                        </h2>
                        <p class="mt-4 text-neutral-600 max-w-2xl">
                            Мы подготовили пакет файлов, который обычно запрашивают для закупок: реквизиты,
                            сертификаты качества и подтверждение регистрации. Файлы актуальны и поддерживаются
                            в формате PDF.
                        </p>
                    </div>
                    <div class="flex flex-wrap gap-4">
                        <a v-for="doc in documents" :key="doc.href" :href="doc.href" download class="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-primary-800
                        bg-primary-100 text-primary-700 border border-dashed border-primary-400
                        text-sm font-semibold uppercase tracking-wide
                        hover:bg-primary-500 transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40">
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
                        class="mt-6 inline-flex w-full items-center justify-center px-6 py-4 rounded-full bg-primary-600 text-white font-semibold uppercase tracking-wide hover:bg-primary-800 transition">
                        Перейти к форме
                    </NuxtLink>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
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

const benefits = [
    { title: 'Индивидуальные рецептуры', description: 'Настраиваем состав, глазурь и упаковку под требования бренда.' },
    { title: 'Маркетинговая поддержка', description: 'Предоставляем фото и макеты для маркетплейсов и социальных сетей.' },
    { title: 'Гибкие условия оплаты', description: 'Работаем по договору поставки, предоплате или постоплате для постоянных клиентов.' }
]

const documents = [
    { href: '/docs/declaration.pdf', label: 'Деклорация соответствия (EAC)' },
    { href: '/docs/EGRIP.pdf', label: 'Реквизиты компании (ЕГРИП)' }
]

const ctaPoints = [
    'Опт от 50 единиц в неделю',
    'Персональный менеджер для сетей',
    'Разработка фирменных наборов'
]
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
