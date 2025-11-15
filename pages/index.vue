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
                <ProductCard v-for="item in products" :key="item.id" :id="item.id" :image="item.image" :name="item.name"
                    :description="item.description" :price="item.price" :out-of-stock="item.outOfStock"
                    @add-to-cart="handleAddToCart(item)" />
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import HeroSection from '~/components/HeroSection.vue'
import ProductCard from '~/components/ProductCard.vue'
import { useCart } from '~/composables/useCart'

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

interface Product {
    id: number
    image: string
    name: string
    description: string
    price: number
    outOfStock?: boolean
}

const products: Product[] = [
    {
        id: 1,
        image: '/bread-1.jpg',
        name: 'Багет классический',
        description: 'Пшеничная мука, хрустящая корочка, мягкий мякиш.',
        price: 150
    },
    {
        id: 2,
        image: '/croissant-1.jpg',
        name: 'Круассан миндальный',
        description: 'Слоёное тесто, миндальный крем, сахарная пудра.',
        price: 220
    },
    {
        id: 3,
        image: '/ciabatta-1.jpg',
        name: 'Чиабатта с розмарином',
        description: 'Итальянский хлеб с оливковым маслом и розмарином.',
        price: 180
    },
    {
        id: 4,
        image: '/cake-1.jpg',
        name: 'Торт «Наполеон»',
        description: 'Классический торт с заварным кремом.',
        price: 350,
        outOfStock: true
    },
    {
        id: 5,
        image: '/bun-1.jpg',
        name: 'Булочка с корицей',
        description: 'Сдобное тесто с корицей и глазурью.',
        price: 120
    },
    {
        id: 6,
        image: '/cookie-1.jpg',
        name: 'Печенье шоколадное',
        description: 'Крупные кусочки тёмного шоколада.',
        price: 90
    }
]

const { addItem } = useCart()

const handleAddToCart = (product: Product) => {
    addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image
    })
}
</script>
