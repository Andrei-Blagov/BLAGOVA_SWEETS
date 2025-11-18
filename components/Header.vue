<template>
    <header class="sticky top-0 z-30 bg-white shadow-sm">
        <div class="max-w-6xl mx-auto px-4 py-4
             flex flex-col gap-4
             sm:flex-row sm:items-center sm:justify-between">
            <NuxtLink to="/" class="flex items-center gap-4">
                <div class="flex items-center justify-center shrink-0">
                    <img class="w-20 h-20 rounded-full object-cover" src="/logo_dark.png"
                        alt="логотип BLAGOVA_SWEETS" />
                </div>
                <div class="leading-tight flex flex-col items-start justify-center">
                    <img class="w-80 h-10 object-cover" src="/blagova_sweets.png" alt="BLAGOVA_SWEETS" />

                    <!-- <p class="text-3xl font-bold text-neutral-900">
                        BLAGOVA_SWEETS
                    </p> -->

                    <p class="text-xs text-neutral-600">
                        Свежие пряники и торты каждый день
                    </p>
                </div>
            </NuxtLink>

            <div class="flex flex-col gap-3
               sm:flex-row sm:items-center sm:gap-6">
                <nav class="flex flex-wrap items-center gap-4 text-lg font-medium text-neutral-600">
                    <NuxtLink v-for="link in links" :key="link.to" :to="link.to"
                        class="relative transition-colors hover:text-neutral-900" active-class="text-neutral-900">
                        {{ link.label }}
                    </NuxtLink>
                </nav>

                <div class="flex items-center gap-3">
                    <!-- <NuxtLink to="/menu" class="inline-flex items-center justify-center
                   px-4 py-4 rounded-pill
                   border border-primary-500
                   text-primary-600 bg-neutral-50
                   text-sm font-semibold uppercase tracking-wide
                   hover:bg-primary-800 transition-colors">
                        Меню
                    </NuxtLink> -->

                    <NuxtLink to="https://www.ozon.ru/seller/blagova-sweets-3450915" class="inline-flex items-center justify-center
                   px-4 py-5 rounded-pill
                   bg-primary-500 text-white
                   text-xs font-semibold uppercase tracking-wide
                   hover:bg-primary-800 transition-colors">
                        Наш магазин на OZON
                    </NuxtLink>

                    <!-- Корзина -->
                    <!-- <NuxtLink to="/cart" class="relative inline-flex items-center justify-center
                   w-14 h-14 rounded-full border border-primary-500 bg-neutral-50
                   hover:bg-primary-800 transition-colors" aria-label="Корзина">
                        <img class="w-14 h-14 rounded-full object-cover" src="/bag.png" alt="корзина" />
                        <span v-if="totalItems > 0" class="absolute -top-1 -right-1
                     min-w-[18px] h-[18px]
                     px-2 rounded-full
                     bg-primary-500 text-white
                     text-[16px] font-bold
                     flex items-center justify-center">
                            {{ totalItems }}
                        </span>
                    </NuxtLink> -->
                </div>
            </div>
        </div>
    </header>
</template>

<script setup lang="ts">
import { useCart } from '~/composables/useCart'

const links = [
    { to: '/', label: 'Главная' },
    // { to: '/menu', label: 'Меню' },
    // { to: '/about', label: 'О нас' },
    // { to: '/delivery', label: 'Доставка' },
    { to: '/cooperation', label: 'Сотрудничество' },
    { to: '/contact', label: 'Контакты' }
]

const { totalItems } = useCart()
</script>
