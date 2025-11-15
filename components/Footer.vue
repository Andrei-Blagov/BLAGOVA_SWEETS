<template>
    <footer class="mt-16 bg-neutral-900 text-neutral-200">
        <div class="max-w-6xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-3">
            <div>
                <p class="text-lg font-semibold text-white">
                    Пекарня
                </p>
                <p class="mt-3 text-sm text-neutral-400">
                    Свежая выпечка каждый день. Хлеб, круассаны, торты и десерты к кофе.
                </p>
            </div>

            <div class="text-sm space-y-2">
                <p class="font-semibold text-white">
                    Контакты
                </p>
                <p>г. Примерск, ул. Выпечной, д. 1</p>
                <p>Ежедневно с 8:00 до 20:00</p>
                <p>Тел: +7 (999) 000-00-00</p>
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
            <div class="max-w-6xl mx-auto px-4 py-4 text-xs text-neutral-500
               flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p>© 2025 Пекарня. Все права защищены.</p>
                <p>Сделано на Nuxt 3.</p>
            </div>
        </div>
    </footer>
</template>
