<template>
    <section class="max-w-6xl mx-auto px-4 py-16 lg:py-20">
        <header class="mb-8 lg:mb-10 flex flex-col gap-4
             lg:flex-row lg:items-end lg:justify-between">
            <div>
                <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
                    Меню
                </p>
                <h1 class="mt-1 text-3xl font-bold text-neutral-900">
                    Всё меню пекарни
                </h1>
                <p class="mt-3 text-neutral-600 max-w-xl">
                    Выберите любимую выпечку. Для предзаказа торта позвоните нам за 1–2 дня.
                </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
                <button v-for="tag in tags" :key="tag.id" type="button"
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

interface Product {
    id: number
    image: string
    name: string
    description: string
    price: number
    category: string
    outOfStock?: boolean
}

const products: Product[] = [
    {
        id: 1,
        image: '/bread-1.jpg',
        name: 'Багет классический',
        description: 'Хрустящая корочка, мягкий мякиш.',
        price: 150,
        category: 'bread'
    },
    {
        id: 2,
        image: '/bread-2.jpg',
        name: 'Ржаной хлеб',
        description: 'Богатый вкус, идеально к супам.',
        price: 160,
        category: 'bread'
    },
    {
        id: 3,
        image: '/croissant-1.jpg',
        name: 'Круассан сливочный',
        description: 'Слоёное тесто, сливочное масло.',
        price: 190,
        category: 'croissant'
    },
    {
        id: 4,
        image: '/croissant-2.jpg',
        name: 'Круассан шоколадный',
        description: 'Начинка из тёмного шоколада.',
        price: 210,
        category: 'croissant'
    },
    {
        id: 5,
        image: '/cake-1.jpg',
        name: 'Торт «Наполеон»',
        description: 'Классический торт, нужен предзаказ.',
        price: 1200,
        category: 'cake',
        outOfStock: true
    },
    {
        id: 6,
        image: '/cake-2.jpg',
        name: 'Чизкейк ванильный',
        description: 'Песочная основа, нежная начинка.',
        price: 950,
        category: 'cake'
    },
    {
        id: 7,
        image: '/cookie-1.jpg',
        name: 'Печенье с шоколадом',
        description: 'Мягкое печенье с кусочками шоколада.',
        price: 90,
        category: 'cookie'
    },
    {
        id: 8,
        image: '/bun-1.jpg',
        name: 'Булочка с корицей',
        description: 'Сдобное тесто и корица.',
        price: 120,
        category: 'bun'
    }
]

const tags = [
    { id: 'all', label: 'Все' },
    { id: 'bread', label: 'Хлеб' },
    { id: 'croissant', label: 'Круассаны' },
    { id: 'cake', label: 'Торты' },
    { id: 'bun', label: 'Булочки' },
    { id: 'cookie', label: 'Печенье' }
]

const activeTag = ref<string>('all')

const filteredProducts = computed(() => {
    if (activeTag.value === 'all') return products
    return products.filter((p) => p.category === activeTag.value)
})

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
