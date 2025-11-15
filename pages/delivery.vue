<template>
    <section class="max-w-4xl mx-auto px-4 py-16 lg:py-20">
        <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
            Доставка и заказ
        </p>
        <h1 class="mt-1 text-3xl font-bold text-neutral-900">
            Доставка и предзаказ
        </h1>

        <div class="mt-6 space-y-4 text-neutral-600">
            <p>
                Мы доставляем выпечку по городу ежедневно с 9:00 до 19:00. Минимальная сумма заказа —
                800 ₽. Стоимость доставки уточняйте по телефону или при оформлении заказа на сайте.
            </p>
            <p>
                Торты и большие заказы нужно оформлять минимум за 1–2 дня. Для корпоративных заказов
                напишите нам или позвоните — мы подготовим предложение.
            </p>
            <p>
                Самовывоз всегда бесплатный. Заказ можно забрать в пекарне по адресу
                г. Примерск, ул. Выпечной, д. 1.
            </p>
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
