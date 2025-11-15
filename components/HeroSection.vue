<template>
    <section class="bg-neutral-50">
        <div class="max-w-6xl mx-auto px-4 py-16 lg:py-12
             grid gap-10 lg:grid-cols-2 items-center">
            <!-- Левый столбец: текст -->
            <div class="space-y-6">
                <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
                    Семейная пекарня с 2020 года
                </p>

                <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 leading-tight">
                    Свежие десерты
                    <span class="text-primary-500">каждый день</span>
                    от
                    <p class="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-800">BLAGOVA_SWEETS</p>
                </h1>

                <p class="text-base sm:text-lg text-neutral-600 max-w-xl">
                    Печём торты, пряники, круассаны и другие различные десерты по классическим рецептам
                    из натуральных ингредиентов. Приходите в гости или заказывайте доставку.
                </p>

                <div class="flex flex-wrap items-center gap-4">
                    <NuxtLink to="/menu" class="inline-flex items-center justify-center
                   px-6 py-3 rounded-pill
                   bg-primary-500 text-white
                   text-sm font-semibold uppercase tracking-wide
                   hover:bg-primary-800 text-primary-500 transition-colors">
                        Смотреть меню
                    </NuxtLink>

                    <NuxtLink to="https://www.ozon.ru/seller/blagova-sweets-3450915" class="inline-flex items-center justify-center
                   px-6 py-3 rounded-pill
                   border border-primary-500
                   text-primary-600 bg-white
                   text-sm font-semibold uppercase tracking-wide
                   hover:bg-primary-800 transition-colors">
                        Наш магазин на OZON
                    </NuxtLink>
                </div>

                <div class="flex items-center gap-2">
                    <span class="inline-block w-2.5 h-2.5 rounded-full bg-accent-green"></span>
                    <span class="text-sm text-neutral-600">
                        Сегодня в наличии: имбирные пряники, миндальные круассаны, торты
                    </span>
                </div>
            </div>

            <!-- Правый столбец: фото -->
            <div class="relative">
                <div class="absolute -top-6 -right-6 w-32 h-32 rounded-full
                 bg-primary-100 hidden sm:block"></div>

                <div class="relative bg-white rounded-md shadow-card overflow-hidden
                 max-w-md mx-auto">
                    <img src="/hero-bakery.jpg" alt="Свежая выпечка из нашей пекарни"
                        class="w-full h-64 sm:h-80 object-cover" />

                    <div class="p-4 sm:p-6">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-lg font-semibold text-neutral-900">
                                Торт с клубничной начинкой и ягодным декором
                            </h3>
                            <span class="inline-flex items-center px-3 py-1 rounded-pill
                       text-xs text-center font-semibold bg-primary-100 text-primary-600">
                                Сегодня из печи
                            </span>
                        </div>
                        <p class="text-sm text-neutral-600">
                            Идеально для любого торжества.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
