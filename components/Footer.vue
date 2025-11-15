<template>
    <footer class="bg-neutral-900 text-neutral-200">
        <div class="max-w-6xl mx-auto px-4 py-6 grid gap-8 md:grid-cols-3">
            <div>
                <div class="flex items-center">
                    <img class="mr-2 w-12 h-12 rounded-full object-cover" src="/logo_dark.png"
                        alt="логотип BLAGOVA_SWEETS" />
                    <p class="text-lg font-semibold text-white">
                        BLAGOVA_SWEETS
                    </p>
                </div>
                <p class="mt-3 text-sm text-neutral-400">
                    Свежие десерты каждый день. Пряники, круассаны, торты к кофе и чаю.
                </p>
            </div>

            <div class="text-sm space-y-2">
                <p class="font-semibold text-white">
                    Контакты
                </p>
                <p>Московская обл., г. Ликино-Дулёво, проезд 1905 года 2-й, д. 7</p>
                <p>Ежедневно с 8:00 до 20:00</p>
                <p>Тел: +7 (985) 236-14-64</p>
            </div>

            <div class="text-sm space-y-2">
                <p class="font-semibold text-white">
                    Навигация
                </p>
                <div class="flex flex-col gap-1">
                    <NuxtLink to="/" class="hover:text-white">Главная</NuxtLink>
                    <NuxtLink to="/menu" class="hover:text-white">Меню</NuxtLink>
                    <NuxtLink to="/about" class="hover:text-white">О нас</NuxtLink>
                    <NuxtLink to="/contact" class="hover:text-white">Контакты</NuxtLink>
                </div>
            </div>
        </div>

        <div class="border-t border-white/10">
            <div class="max-w-6xl mx-auto px-4 py-2 text-xs text-neutral-500
               flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p>© 2025 BLAGOVA_SWEETS. Все права защищены.</p>
                <p>Product by developers "Blagov`s and sons"</p>
            </div>
        </div>
    </footer>
</template>
