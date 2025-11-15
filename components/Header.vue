<template>
    <header class="sticky top-0 z-30 bg-white shadow-sm">
        <div class="max-w-6xl mx-auto px-4 py-4
             flex flex-col gap-4
             sm:flex-row sm:items-center sm:justify-between">
            <NuxtLink to="/" class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-primary-100
                 flex items-center justify-center">
                    <span class="text-lg font-bold text-primary-600">
                        B
                    </span>
                </div>
                <div class="leading-tight">
                    <p class="text-base font-semibold text-neutral-900">
                        Пекарня
                    </p>
                    <p class="text-xs text-neutral-600">
                        Свежая выпечка каждый день
                    </p>
                </div>
            </NuxtLink>

            <div class="flex flex-col gap-3
               sm:flex-row sm:items-center sm:gap-6">
                <nav class="flex flex-wrap items-center gap-4 text-sm font-medium text-neutral-600">
                    <NuxtLink v-for="link in links" :key="link.to" :to="link.to"
                        class="relative transition-colors hover:text-neutral-900" active-class="text-neutral-900">
                        {{ link.label }}
                    </NuxtLink>
                </nav>

                <div class="flex items-center gap-3">
                    <NuxtLink to="/menu" class="inline-flex items-center justify-center
                   px-4 py-2 rounded-pill
                   border border-primary-500
                   text-primary-600 bg-white
                   text-xs font-semibold uppercase tracking-wide
                   hover:bg-primary-100 transition-colors">
                        Меню
                    </NuxtLink>

                    <NuxtLink to="/contact" class="inline-flex items-center justify-center
                   px-4 py-2 rounded-pill
                   bg-primary-500 text-white
                   text-xs font-semibold uppercase tracking-wide
                   hover:bg-primary-600 transition-colors">
                        Заказать
                    </NuxtLink>

                    <!-- Корзина -->
                    <NuxtLink to="/cart" class="relative inline-flex items-center justify-center
                   w-9 h-9 rounded-full bg-neutral-50
                   hover:bg-primary-100 transition-colors" aria-label="Корзина">
                        <span class="text-lg text-neutral-900">🧺</span>
                        <span v-if="totalItems > 0" class="absolute -top-1 -right-1
                     min-w-[18px] h-[18px]
                     px-1 rounded-full
                     bg-primary-500 text-white
                     text-[10px] font-semibold
                     flex items-center justify-center">
                            {{ totalItems }}
                        </span>
                    </NuxtLink>
                </div>
            </div>
        </div>
    </header>
</template>

<script setup lang="ts">
import { useCart } from '~/composables/useCart'

const links = [
    { to: '/', label: 'Главная' },
    { to: '/menu', label: 'Меню' },
    { to: '/about', label: 'О нас' },
    { to: '/contact', label: 'Контакты' }
]

const { totalItems } = useCart()
</script>
