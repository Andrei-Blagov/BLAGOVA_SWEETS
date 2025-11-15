<template>
    <section class="max-w-4xl mx-auto px-4 py-16 lg:py-20">
        <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
            О нас
        </p>
        <h1 class="mt-1 text-3xl font-bold text-neutral-900">
            Семейная пекарня в вашем районе
        </h1>

        <div class="mt-6 space-y-4 text-neutral-600">
            <p>
                Мы начали печь хлеб в 1990 году в небольшой пекарне во дворе. С тех пор
                мы придерживаемся простого принципа: использовать только качественные продукты
                и печь так, как пекли бы дома для своей семьи.
            </p>
            <p>
                В нашем меню — классические багеты, чиабатта, ржаной хлеб, круассаны и торты
                для особых случаев. Каждый день мы готовим ограниченное количество изделий,
                чтобы всё было максимально свежим.
            </p>
            <p>
                Зайдите к нам на завтрак или заберите свежий хлеб домой. Мы всегда рады гостям.
            </p>
        </div>

        <div class="mt-10 grid gap-6 sm:grid-cols-3">
            <div class="bg-white rounded-md shadow-card p-5">
                <h2 class="text-lg font-semibold text-neutral-900 mb-2">
                    Натуральные продукты
                </h2>
                <p class="text-sm text-neutral-600">
                    Используем муку высшего качества, сливочное масло, натуральные сливки и без
                    готовых смесей.
                </p>
            </div>
            <div class="bg-white rounded-md shadow-card p-5">
                <h2 class="text-lg font-semibold text-neutral-900 mb-2">
                    Маленькие партии
                </h2>
                <p class="text-sm text-neutral-600">
                    Печём небольшими партиями несколько раз в день, чтобы выпечка не лежала на полках.
                </p>
            </div>
            <div class="bg-white rounded-md shadow-card p-5">
                <h2 class="text-lg font-semibold text-neutral-900 mb-2">
                    Домашняя атмосфера
                </h2>
                <p class="text-sm text-neutral-600">
                    Небольшой зал, аромат свежего хлеба и уютная музыка — чтобы вы могли передохнуть.
                </p>
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
