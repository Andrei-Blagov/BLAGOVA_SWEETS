<template>
    <div>
        <HeroSection />

        <section class="max-w-6xl mx-auto px-4 py-16 lg:py-20">
            <header class="text-center mb-10">
                <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
                    Популярное
                </p>
                <h2 class="mt-1 text-3xl font-bold text-neutral-900">
                    Хиты сегодняшнего дня
                </h2>
            </header>

            <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                <ProductCard v-for="item in popularProducts" :key="item.id" :id="item.id" :image="item.image"
                    :name="item.name" :description="item.description" :price="item.price"
                    :out-of-stock="item.outOfStock" @add-to-cart="handleAddToCart(item)" />
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import HeroSection from '~/components/HeroSection.vue'
import ProductCard from '~/components/ProductCard.vue'
import { useCart } from '~/composables/useCart'
import { popularProducts, type Product } from '~/data/products'

definePageMeta({
    title: 'BLAGOVA_SWEETS — Свежие десерты каждый день'
})

useSeoMeta({
    title: 'BLAGOVA_SWEETS — Свежие десерты каждый день',
    ogTitle: 'BLAGOVA_SWEETS — Свежие десерты каждый день',
    description: 'Свежые пряники с доставкой по России, Беларусии и Казахстану.',
    ogDescription: 'Свежые пряники с доставкой по России, Беларусии и Казахстану.',
    ogType: 'website',
    ogUrl: 'https://blagovasweets.ru/',
    ogImage: 'https://blagovasweets.ru/og-bakery.jpg',
    twitterCard: 'summary_large_image'
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


