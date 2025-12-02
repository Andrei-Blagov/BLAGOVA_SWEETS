<template>
    <header class="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-neutral-100">
        <div class="max-w-6xl mx-auto px-4 py-3
             flex flex-wrap items-center gap-3 lg:gap-6">
            <!-- Бренд: логотип + название -->
            <NuxtLink to="/" class="flex items-center gap-3 min-w-0">
                <div class="flex items-center justify-center shrink-0">
                    <img class="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full object-cover"
                        src="/logo_dark.webp" alt="логотип BLAGOVA_SWEETS" />
                </div>

                <div class="leading-tight flex flex-col justify-center min-w-0">
                    <!-- Картинка-надпись: >= sm -->
                    <img class="hidden sm:block h-8 sm:h-9 lg:h-10 w-auto max-w-[220px] sm:max-w-[260px] lg:max-w-[320px] object-contain"
                        src="/blagova_sweets.webp" alt="BLAGOVA_SWEETS" />

                    <!-- Текстовое название: только на мобиле -->
                    <p class="sm:hidden text-base font-bold text-neutral-900 truncate">
                        BLAGOVA_SWEETS
                    </p>

                    <p class="text-[11px] sm:text-xs text-neutral-600 mt-0.5">
                        Свежие пряники и торты каждый день
                    </p>
                </div>
            </NuxtLink>

            <!-- Навигация + кнопки -->
            <div class="flex-1 flex flex-wrap items-center justify-end gap-2 sm:gap-4">
                <!-- Десктопная навигация -->
                <nav class="hidden md:flex flex-wrap items-center gap-x-5 gap-y-2
                 text-sm sm:text-base font-medium text-neutral-600">
                    <NuxtLink v-for="link in links" :key="link.to" :to="link.to"
                        class="relative transition-colors hover:text-neutral-900" active-class="text-neutral-900">
                        {{ link.label }}
                    </NuxtLink>
                </nav>

                <div class="flex items-center gap-2 sm:gap-3">
                    <!-- Мобильная навигация: выпадающий список -->
                    <div class="md:hidden">
                        <label class="sr-only" for="mobile-nav">Навигация</label>
                        <select id="mobile-nav" class="block px-3 py-2 rounded-pill border border-neutral-300
                     bg-white text-xs font-medium text-neutral-700
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                            :value="currentPath" @change="onMobileNavChange">
                            <option v-for="link in links" :key="link.to" :value="link.to">
                                {{ link.label }}
                            </option>
                        </select>
                    </div>

                    <NuxtLink to="/menu" class="inline-flex items-center justify-center
                   px-4 py-4 rounded-pill
                   border border-primary-600
                   bg-primary-500 text-white
                   text-xs sm:text-sm font-semibold uppercase tracking-wide
                   hover:bg-primary-800 transition-colors whitespace-nowrap">
                        Меню
                    </NuxtLink>

                    <NuxtLink to="https://www.ozon.ru/seller/blagova-sweets-3450915" class="inline-flex items-center justify-center
                   px-4 py-5 rounded-pill
                   bg-primary-800 text-white
                   text-xs font-semibold uppercase tracking-wide
                   hover:bg-primary-500 hover:text-primary-800 transition-colors whitespace-nowrap" target="_blank">
                        <span class="hidden sm:inline">Наш магазин на&nbsp;</span>
                        <span>OZON</span>
                    </NuxtLink>
                    <!-- Корзина -->
                    <!--
                    <NuxtLink
                        to="/cart"
                        class="relative inline-flex items-center justify-center
                            w-14 h-14 rounded-full border border-primary-500 bg-neutral-50
                            hover:bg-primary-800 transition-colors"
                        aria-label="Корзина"
                    >
                        <img class="w-14 h-14 rounded-full object-cover" src="/bag.webp" alt="корзина" />
                        <span
                        v-if="totalItems > 0"
                        class="absolute -top-1 -right-1
                                min-w-[18px] h-[18px]
                                px-2 rounded-full
                                bg-primary-500 text-white
                                text-[16px] font-bold
                                flex items-center justify-center"
                        >
                        {{ totalItems }}
                        </span>
                    </NuxtLink> 
                    -->
                </div>
            </div>
        </div>
    </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCart } from '~/composables/useCart'
import { useRoute, useRouter } from '#imports'

const links = [
    { to: '/', label: 'Главная' },
    // { to: '/menu', label: 'Меню' },
    // { to: '/about', label: 'О нас' },
    // { to: '/delivery', label: 'Доставка' },
    { to: '/cooperation', label: 'Сотрудничество' },
    { to: '/contact', label: 'Контакты' }
]

const { totalItems } = useCart()

const route = useRoute()
const router = useRouter()

const currentPath = computed(() => route.path)

const onMobileNavChange = (event: Event) => {
    const target = event.target as HTMLSelectElement
    const value = target.value
    if (value && value !== route.path) {
        router.push(value)
    }
}
</script>
