<template>
    <section class="max-w-6xl mx-auto px-4 py-16 lg:py-20">
        <div class="grid gap-10 lg:grid-cols-2">
            <div>
                <h2 class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
                    Контакты
                </h2>
                <h3 class="mt-1 text-3xl font-bold text-neutral-900">
                    Как нас найти
                </h3>

                <div class="mt-6 space-y-4 text-neutral-600">
                    <p>
                        Адрес: Московская обл., г. Ликино-Дулёво, проезд 1905 года 2-й, д. 7
                    </p>
                    <p>
                        Телефон:
                        <a href="tel:+79852361464" class="text-primary-600 hover:text-primary-800">
                            +7 (985) 236-14-64
                        </a>
                    </p>
                    <p>
                        Время работы: ежедневно с 8:00 до 20:00
                    </p>
                    <p>
                        Электронная почта:
                        <a href="mailto:hello@blagovasweets.ru" class="text-primary-600 hover:text-primary-800">
                            hello@blagovasweets.ru
                        </a>
                    </p>
                </div>

                <div class="mt-8">
                    <p class="text-sm font-semibold tracking-wide text-neutral-900 mb-3">
                        Мы в соцсетях и на маркетплейс
                    </p>
                    <div class="flex flex-wrap gap-3">
                        <a href="https://vk.com/public220650443"
                            class="text-sm text-primary-600 hover:text-primary-800">VK
                        </a>
                        <a href="https://www.ozon.ru/seller/blagova-sweets-3450915"
                            class="text-sm text-primary-600 hover:text-primary-800">OZON
                        </a>
                        <a href="#" class="text-sm text-primary-600 hover:text-primary-800">Telegram</a>
                        <a href="#" class="text-sm text-primary-600 hover:text-primary-800">Instagram</a>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-md shadow-card p-6 sm:p-8">
                <h3 class="text-xl font-semibold text-neutral-900 mb-4">
                    Написать нам
                </h3>
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
                   hover:bg-primary-800 transition-colors w-full sm:w-auto">
                        Отправить
                    </button>
                </form>
            </div>
        </div>

        <div class="mt-12">
            <div class="w-full h-64 rounded-md bg-neutral-200
               flex items-center justify-center text-neutral-600 text-sm">
                <img src="/map.png" alt="карта" class="w-full h-64 sm:h-80 object-cover" />
            </div>
        </div>
    </section>
</template>
<script setup lang="ts">
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