<template>
    <article class="bg-white rounded-md shadow-card
           overflow-hidden flex flex-col h-full relative">
        <div class="relative">
            <img :src="image" :alt="name" class="w-full h-52 object-cover" />

            <div v-if="props.outOfStock" class="absolute inset-0 bg-black/40
               flex items-center justify-center">
                <span class="px-3 py-1 rounded-pill
                 bg-white/90 text-xs font-semibold
                 text-accent-red uppercase tracking-wide">
                    Нет в наличии
                </span>
            </div>
        </div>

        <div class="p-4 sm:p-5 flex-1 flex flex-col">
            <header class="mb-2">
                <h3 class="text-lg font-semibold text-neutral-900 mb-1">
                    {{ name }}
                </h3>
                <p class="text-sm text-neutral-600">
                    {{ description }}
                </p>
            </header>

            <div class="mt-auto flex items-center justify-between gap-3 pt-4">
                <div class="flex flex-col">
                    <span class="text-lg font-bold text-neutral-900">
                        {{ price }} ₽
                    </span>
                    <span class="text-xs font-medium"
                        :class="props.outOfStock ? 'text-accent-red' : 'text-accent-green'">
                        {{ props.outOfStock ? 'Недоступно' : 'В наличии сегодня' }}
                    </span>
                </div>

                <button type="button" class="inline-flex items-center justify-center
                 px-4 py-2 rounded-pill
                 text-xs font-semibold uppercase tracking-wide
                 transition-colors" :class="props.outOfStock
                    ? 'bg-neutral-200 text-neutral-600 cursor-not-allowed'
                    : 'bg-primary-500 text-white hover:bg-primary-600'" :disabled="props.outOfStock" @click="handleAddToCart">
                    Добавить
                </button>
            </div>
        </div>
    </article>
</template>

<script setup lang="ts">
interface Props {
    id: number | string
    image: string
    name: string
    description: string
    price: number
    outOfStock?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
    (e: 'add-to-cart'): void
}>()

const handleAddToCart = () => {
    if (props.outOfStock) return
    emit('add-to-cart')
}
</script>
