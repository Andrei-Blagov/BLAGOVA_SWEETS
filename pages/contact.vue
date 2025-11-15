<template>
    <section class="max-w-6xl mx-auto px-4 py-16 lg:py-20">
        <div class="grid gap-10 lg:grid-cols-2">
            <div>
                <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
                    Контакты
                </p>
                <h1 class="mt-1 text-3xl font-bold text-neutral-900">
                    Как нас найти
                </h1>

                <div class="mt-6 space-y-4 text-neutral-600">
                    <p>
                        Адрес: г. Примерск, ул. Выпечной, д. 1
                    </p>
                    <p>
                        Телефон:
                        <a href="tel:+79990000000" class="text-primary-600 hover:text-primary-500">
                            +7 (999) 000-00-00
                        </a>
                    </p>
                    <p>
                        Время работы: ежедневно с 8:00 до 20:00
                    </p>
                    <p>
                        Электронная почта:
                        <a href="mailto:hello@bakery.local" class="text-primary-600 hover:text-primary-500">
                            hello@bakery.local
                        </a>
                    </p>
                </div>

                <div class="mt-8">
                    <p class="text-sm font-semibold tracking-wide text-neutral-900 mb-3">
                        Мы в соцсетях
                    </p>
                    <div class="flex flex-wrap gap-3">
                        <a href="#" class="text-sm text-primary-600 hover:text-primary-500">Instagram</a>
                        <a href="#" class="text-sm text-primary-600 hover:text-primary-500">VK</a>
                        <a href="#" class="text-sm text-primary-600 hover:text-primary-500">Telegram</a>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-md shadow-card p-6 sm:p-8">
                <h2 class="text-xl font-semibold text-neutral-900 mb-4">
                    Написать нам
                </h2>
                <form class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1">
                            Имя
                        </label>
                        <input type="text" class="w-full px-3 py-2 rounded-sm border border-neutral-200
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white" placeholder="Как к вам обращаться" />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1">
                            Телефон или email
                        </label>
                        <input type="text" class="w-full px-3 py-2 rounded-sm border border-neutral-200
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white" placeholder="+7… или email" />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1">
                            Сообщение
                        </label>
                        <textarea rows="4" class="w-full px-3 py-2 rounded-sm border border-neutral-200
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white resize-none" placeholder="Что вы хотите уточнить или заказать"></textarea>
                    </div>

                    <button type="submit" class="inline-flex items-center justify-center
                   px-6 py-3 rounded-pill
                   bg-primary-500 text-white
                   text-sm font-semibold uppercase tracking-wide
                   hover:bg-primary-600 transition-colors w-full sm:w-auto">
                        Отправить
                    </button>
                </form>
            </div>
        </div>

        <div class="mt-12">
            <div class="w-full h-64 rounded-md bg-neutral-200
               flex items-center justify-center text-neutral-600 text-sm">
                Здесь может быть карта (Yandex/Google)
            </div>
        </div>
    </section>
</template>
<script setup lang="ts">
definePageMeta({
    title: 'Пекарня — свежая выпечка каждый день'
})

useSeoMeta({
    title: 'Пекарня — свежая выпечка каждый день',
    ogTitle: 'Пекарня — свежая выпечка каждый день',
    description: 'Свежий хлеб, круассаны и десерты с доставкой по городу.',
    ogDescription: 'Свежий хлеб, круассаны и десерты с доставкой по городу.',
    ogType: 'website',
    ogUrl: 'https://example.com/',
    ogImage: 'https://example.com/og-bakery.jpg',
    twitterCard: 'summary_large_image'
})
</script>