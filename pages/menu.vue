<template>
    <section class="max-w-6xl mx-auto px-4 py-16 lg:py-20">
        <header class="mb-8 lg:mb-10 flex flex-col gap-4
             lg:flex-row lg:items-end lg:justify-between">
            <div>
                <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
                    Меню
                </p>
                <h1 class="mt-1 text-3xl font-bold text-neutral-900">
                    Всё меню BLAGOVA_SWEETS
                </h1>
                <p class="mt-3 text-neutral-600 max-w-xl">
                    Выберите любимую выпечку. Для предзаказа торта позвоните нам за 2–3 дня.
                </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
                <button v-for="tag in PRODUCT_CATEGORIES" :key="tag.id" type="button"
                    class="px-4 py-2 rounded-pill text-sm border transition-colors" :class="tag.id === activeTag
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : 'bg-primary-100 border-transparent text-neutral-900 hover:bg-primary-500/10'"
                    @click="activeTag = tag.id">
                    {{ tag.label }}
                </button>
            </div>
        </header>

        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <ProductCard v-for="item in filteredProducts" :key="item.id" :id="item.id" :image="item.image"
                :name="item.name" :description="item.description" :price="item.price" :out-of-stock="item.outOfStock"
                @add-to-cart="handleAddToCart(item)" />
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ProductCard from '~/components/ProductCard.vue'
import { useCart } from '~/composables/useCart'
import {
    products,
    PRODUCT_CATEGORIES,
    type Product,
    type ProductCategory
} from '~/data/products'

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

const activeTag = ref<'all' | ProductCategory>('all')

const filteredProducts = computed(() => {
    if (activeTag.value === 'all') return products
    return products.filter((p) => p.category === activeTag.value)
})

const { addItem } = useCart()

const handleAddToCart = (product: Product) => {
    if (product.outOfStock) return

    addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image
    })
}
</script>
