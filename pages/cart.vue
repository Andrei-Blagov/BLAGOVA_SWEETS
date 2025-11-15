<template>
    <section class="max-w-4xl mx-auto px-4 py-16 lg:py-20">
        <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
            Корзина
        </p>
        <h1 class="mt-1 text-3xl font-bold text-neutral-900">
            Ваш заказ
        </h1>

        <div v-if="items.length === 0" class="mt-8 space-y-4">
            <p class="text-neutral-600">
                В корзине пока пусто.
            </p>
            <NuxtLink to="/menu" class="inline-flex items-center justify-center
               px-6 py-3 rounded-pill
               bg-primary-500 text-white
               text-sm font-semibold uppercase tracking-wide
               hover:bg-primary-600 transition-colors">
                Перейти к меню
            </NuxtLink>
        </div>

        <div v-else class="mt-8 grid gap-10 lg:grid-cols-[2fr,1fr]">
            <!-- Список позиций -->
            <div class="space-y-4">
                <div v-for="item in items" :key="item.id" class="bg-white rounded-md shadow-card p-4 flex gap-4">
                    <img :src="item.image" :alt="item.name" class="w-20 h-20 rounded-sm object-cover flex-shrink-0" />

                    <div class="flex-1 flex flex-col gap-2">
                        <div class="flex justify-between gap-3">
                            <div>
                                <h2 class="text-sm sm:text-base font-semibold text-neutral-900">
                                    {{ item.name }}
                                </h2>
                                <p class="text-xs text-neutral-600 mt-1">
                                    {{ item.price }} ₽ за штуку
                                </p>
                            </div>
                            <button type="button" class="text-xs text-neutral-500 hover:text-accent-red"
                                @click="removeItem(item.id)">
                                Удалить
                            </button>
                        </div>

                        <div class="flex items-center justify-between gap-3 mt-auto">
                            <div
                                class="inline-flex items-center border border-neutral-200 rounded-pill overflow-hidden">
                                <button type="button"
                                    class="w-8 h-8 flex items-center justify-center text-neutral-700 hover:bg-neutral-50"
                                    @click="changeQuantity(item.id, -1)">
                                    −
                                </button>
                                <span class="w-10 text-center text-sm text-neutral-900">
                                    {{ item.quantity }}
                                </span>
                                <button type="button"
                                    class="w-8 h-8 flex items-center justify-center text-neutral-700 hover:bg-neutral-50"
                                    @click="changeQuantity(item.id, 1)">
                                    +
                                </button>
                            </div>

                            <div class="text-right">
                                <p class="text-sm font-semibold text-neutral-900">
                                    {{ item.price * item.quantity }} ₽
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <button type="button" class="text-xs text-neutral-500 hover:text-accent-red" @click="clearCart">
                    Очистить корзину
                </button>
            </div>

            <!-- Итог -->
            <aside class="bg-white rounded-md shadow-card p-5 h-fit">
                <h2 class="text-lg font-semibold text-neutral-900 mb-4">
                    Итого
                </h2>
                <div class="space-y-2 text-sm text-neutral-700">
                    <div class="flex justify-between">
                        <span>Позиции</span>
                        <span>{{ totalItems }} шт.</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Сумма</span>
                        <span>{{ totalPrice }} ₽</span>
                    </div>
                </div>

                <NuxtLink to="/checkout" class="mt-6 inline-flex items-center justify-center
                 w-full px-6 py-3 rounded-pill
                 bg-primary-500 text-white
                 text-sm font-semibold uppercase tracking-wide
                 hover:bg-primary-600 transition-colors">
                    Оформить заказ
                </NuxtLink>
            </aside>
        </div>
    </section>
</template>

<script setup lang="ts">
import { useCart } from '~/composables/useCart'

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

const { items, totalItems, totalPrice, setItemQuantity, removeItem, clearCart } = useCart()

const changeQuantity = (id: number | string, delta: number) => {
    const item = items.value.find((i) => i.id === id)
    if (!item) return
    const next = item.quantity + delta
    setItemQuantity(id, next)
}
</script>
