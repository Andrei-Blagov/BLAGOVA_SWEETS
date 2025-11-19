<template>
    <article ref="cardRef" class="bg-white rounded-md shadow-card overflow-hidden
           flex flex-col h-full relative">
        <!-- превью -->
        <div class="relative cursor-zoom-in" @click="openGallery(0)">
            <img ref="imageRef" :src="image" :alt="name" class="w-full h-full object-cover" />

            <div v-if="props.outOfStock" class="absolute inset-0 bg-black/40 flex items-center justify-center">
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

            <!-- <div class="mt-auto flex items-center justify-between gap-3 pt-4">
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
                    : 'bg-primary-500 text-white hover:bg-primary-800'" :disabled="props.outOfStock"
                    @click="handleAddToCart">
                    Добавить
                </button>
            </div> -->
        </div>
    </article>

    <!-- модалка -->
    <Teleport to="body">
        <div v-if="isGalleryOpen" class="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center"
            @click.self="closeGallery">
            <div ref="modalRef" class="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 overflow-hidden">
                <!-- крестик -->
                <button type="button" class="absolute top-3 right-3 z-20 w-8 h-8 rounded-full
                 flex items-center justify-center
                 bg-black/70 text-white text-x3 leading-none
                 hover:bg-black/90 transition" @click.stop="closeGallery">
                    X
                </button>

                <!-- основное изображение -->
                <div class="relative bg-black flex items-center justify-center">
                    <img :src="activeImage" :alt="name" class="max-h-[80vh] max-w-full object-contain" />

                    <!-- стрелка влево -->
                    <button v-if="imagesList.length > 1" type="button" class="absolute left-3 top-1/2 -translate-y-1/2
                   w-9 h-9 rounded-full bg-black/60 text-white
                   flex items-center justify-center
                   hover:bg-black/80 transition" @click.stop="prevImage">
                        <
                    </button>

                    <!-- стрелка вправо -->
                    <button v-if="imagesList.length > 1" type="button" class="absolute right-3 top-1/2 -translate-y-1/2
                   w-9 h-9 rounded-full bg-black/60 text-white
                   flex items-center justify-center
                   hover:bg-black/80 transition" @click.stop="nextImage">
                        >
                    </button>
                </div>

                <!-- точки-индикаторы -->
                <div v-if="imagesList.length > 1" class="flex items-center justify-center gap-2 py-3">
                    <button v-for="(src, index) in imagesList" :key="index" type="button"
                        class="w-2.5 h-2.5 rounded-full" :class="index === currentIndex
                                ? 'bg-neutral-900'
                                : 'bg-neutral-300'
                            " @click="goToImage(index)" />
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { gsap } from 'gsap'
import {
    computed,
    nextTick,
    onMounted,
    onBeforeUnmount,
    ref,
} from 'vue'

interface Props {
    id: number | string
    image: string       // основное изображение
    images?: string[]   // доп. изображения для галереи
    name: string
    description: string
    price: number
    outOfStock?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
    (e: 'add-to-cart'): void
}>()

const cardRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const modalRef = ref<HTMLElement | null>(null)

const isGalleryOpen = ref(false)
const currentIndex = ref(0)

const imagesList = computed<string[]>(() => {
    if (props.images && props.images.length > 0) {
        return props.images
    }
    return [props.image]
})

const activeImage = computed(() => {
    return imagesList.value[currentIndex.value] ?? imagesList.value[0]
})

const animateCardPulse = () => {
    if (!cardRef.value) return
    gsap.fromTo(
        cardRef.value,
        { scale: 1 },
        {
            scale: 1.1,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            ease: 'power1.out',
        },
    )
}

const handleAddToCart = () => {
    if (props.outOfStock) return
    emit('add-to-cart')
    if (import.meta.client) {
        nextTick(() => {
            animateCardPulse()
        })
    }
}

const openGallery = (index = 0) => {
    currentIndex.value = index
    isGalleryOpen.value = true
}

const closeGallery = () => {
    isGalleryOpen.value = false
}

const nextImage = () => {
    if (imagesList.value.length <= 1) return
    currentIndex.value =
        (currentIndex.value + 1) % imagesList.value.length
}

const prevImage = () => {
    if (imagesList.value.length <= 1) return
    currentIndex.value =
        (currentIndex.value - 1 + imagesList.value.length) %
        imagesList.value.length
}

const goToImage = (index: number) => {
    if (index < 0 || index >= imagesList.value.length) return
    currentIndex.value = index
}

onMounted(() => {
    if (!import.meta.client || !imageRef.value) return
    gsap.from(imageRef.value, {
        opacity: 0,
        scale: 0.95,
        duration: 0.8,
        ease: 'power2.out',
    })
})

onBeforeUnmount(() => {
    // сейчас нет активных gsap-твинов, оставлено на будущее
})
</script>



<!-- <template>
    <article ref="cardRef" class="bg-white rounded-md shadow-card
           overflow-hidden flex flex-col h-full relative">
        <div class="relative">
            <img ref="imageRef" :src="image" :alt="name" class="w-full h-full object-cover" />

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
                    : 'bg-primary-500 text-white hover:bg-primary-800'" :disabled="props.outOfStock"
                    @click="handleAddToCart">
                    Добавить
                </button>
            </div>
        </div>
    </article>
</template> -->

<!-- <script setup lang="ts">
import { gsap } from 'gsap'
import { nextTick, onMounted, ref } from 'vue'

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

const cardRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)

const animateCardPulse = () => {
    if (!cardRef.value) return
    gsap.fromTo(
        cardRef.value,
        { scale: 1 },
        { scale: 1.1, duration: 0.2, yoyo: true, repeat: 1, ease: 'power1.out' }
    )
}

const handleAddToCart = () => {
    if (props.outOfStock) return
    emit('add-to-cart')
    if (import.meta.client) {
        nextTick(() => {
            animateCardPulse()
        })
    }
}

onMounted(() => {
    if (!import.meta.client || !imageRef.value) return
    gsap.from(imageRef.value, {
        opacity: 0,
        scale: 0.95,
        duration: 0.8,
        ease: 'power2.out'
    })
})
</script> -->
