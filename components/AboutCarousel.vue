<template>
    <section class="bg-neutral-50">
        <div class="max-w-6xl mx-auto px-4 py-16 lg:py-12">
            <header class="mb-2 text-center lg:text-left">
                <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
                    О нас
                </p>
                <h2 class="mt-1 text-3xl font-bold text-neutral-900">
                    Почему BLAGOVA_SWEETS доверяют
                </h2>
            </header>

            <div ref="wrapperEl" class="grid gap-10 lg:grid-cols-2 items-center">
                <!-- Текст слева -->
                <div ref="textEl" class="space-y-4">
                    <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
                        {{ currentSlide.tagline }}
                    </p>
                    <h3 class="text-2xl font-bold text-neutral-900">
                        {{ currentSlide.title }}
                    </h3>
                    <p class="text-base text-neutral-700">
                        {{ currentSlide.text }}
                    </p>

                    <ul v-if="currentSlide.bullets && currentSlide.bullets.length"
                        class="mt-4 space-y-2 text-sm text-neutral-700">
                        <li v-for="(bullet, idx) in currentSlide.bullets" :key="idx" class="flex items-start gap-2">
                            <span class="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                            <span>{{ bullet }}</span>
                        </li>
                    </ul>

                    <div class="mt-4 flex items-center gap-2 text-xs text-neutral-500">
                        <span v-for="(slide, index) in slides" :key="slide.id"
                            class="inline-flex w-2 h-2 rounded-full transition-colors"
                            :class="index === activeIndex ? 'bg-primary-500' : 'bg-neutral-300'" />
                        <span>
                            {{ activeIndex + 1 }} / {{ slides.length }}
                        </span>
                    </div>
                </div>

                <!-- Фото справа -->
                <div ref="imageEl" class="flex justify-center lg:justify-end">
                    <div
                        class="w-full max-w-md bg-white rounded-md shadow-card border border-neutral-100 overflow-hidden">
                        <img :src="currentSlide.image" :alt="currentSlide.imageAlt"
                            class="w-full h-full max-h-96 object-contain bg-neutral-100" />
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'

interface Slide {
    id: number
    image: string
    imageAlt: string
    tagline: string
    title: string
    text: string
    bullets?: string[]
}

const slides: Slide[] = [
    {
        id: 1,
        image: '/about-natural.webp',
        imageAlt: 'Натуральный состав пряников BLAGOVA_SWEETS',
        tagline: 'Натуральный состав',
        title: 'Пряники без лишней химии',
        text:
            'Готовим козульное тесто без мёда, без готовых смесей и искусственных усилителей вкуса. В составе: мука высшего сорта, сахар, масло сливочное, яйцо, корица, имбирь, сода, питьевая вода и кондитерская глазурь.',
        bullets: [
            'без ГМО и скрытых добавок',
            'только понятные ингредиенты',
            'стабильный домашний вкус в каждой партии'
        ]
    },
    {
        id: 2,
        image: '/about-support.webp',
        imageAlt: 'Информация для покупателей о службе поддержки',
        tagline: 'Забота о клиентах',
        title: 'Решаем вопросы, а не спорим в отзывах',
        text:
            'Если с заказом что-то пошло не так: перепутали товар, задержалась доставка или упаковка повредилась — мы всегда готовы помочь. Нам важно, чтобы впечатление от покупки было тёплым, как свежий пряник из печи.',
        bullets: [
            'оперативно отвечаем через поддержку Ozon',
            'ищем решение, а не оправдания',
            'каждое обращение разбираем вручную'
        ]
    },
    {
        id: 3,
        image: '/about-packaging.webp',
        imageAlt: 'Надёжная упаковка пряников BLAGOVA_SWEETS',
        tagline: 'Надёжная упаковка',
        title: 'Пряники доезжают целыми',
        text:
            'Мы упаковываем заказы так, будто отправляем подарок близкому человеку: плотная коробка, воздушно-пузырьковая плёнка и индивидуальные герметичные пакеты для каждого пряника.',
        bullets: [
            'картонные коробки повышенной плотности',
            'несколько слоёв защиты внутри',
            'подходит для доставки на дальние расстояния'
        ]
    },
    {
        id: 4,
        image: '/about-kids.webp',
        imageAlt: 'Ребёнок с пряником BLAGOVA_SWEETS',
        tagline: 'Для детей',
        title: 'Большая радость для маленьких сладкоежек',
        text:
            'Наши пряники — это не только вкусно, но и по-семейному трогательно. Яркая печать, крупный размер и аккуратная форма делают их идеальным сладким подарком на праздники и выпускные.',
        bullets: [
            'дети любят и вкус, и внешний вид',
            'подходят для школьных праздников и утренников',
            'каждый пряник выглядит как маленький сувенир'
        ]
    },
    {
        id: 5,
        image: '/about-safe.webp',
        imageAlt: 'Тесто для пряников без мёда',
        tagline: 'Безопасно для детей',
        title: 'Продуманный состав для чувствительных малышей',
        text:
            'Мы не используем мёд и делаем рецепт максимально деликатным, чтобы пряники подходили даже маленьким детям, и тем у кого есть склонность к аллергии.',
        bullets: [
            'без содержания мёда',
            'гипоаллергенный рецепт',
            'подходит для детских садов и школ'
        ]
    },
    {
        id: 6,
        image: '/about-sticks.webp',
        imageAlt: 'Пряники с отверстиями для палочек',
        tagline: 'Удобство в подаче',
        title: 'Пряники, которые легко превратить в букет',
        text:
            'Каждый пряник идёт с аккуратным отверстием для палочки, а палочки входят в комплект. Можно собрать съедобный букет, композицию на стол или подарочный сет без лишних хлопот.',
        bullets: [
            'отверстия в каждом прянике',
            'палочки входят в набор',
            'подходит для сладких букетов и фотозон'
        ]
    }
]

const activeIndex = ref(0)

// гарантируем, что currentSlide всегда Slide, а не undefined
// const currentSlide = computed<Slide>(() => {
//     return slides[activeIndex.value] ?? slides[0]
// })
const currentSlide = computed<Slide>(() => slides[activeIndex.value]!)

const textEl = ref<HTMLElement | null>(null)
const imageEl = ref<HTMLElement | null>(null)

let timer: number | null = null

const runEnterAnimation = () => {
    if (!import.meta.client) return
    const targets: HTMLElement[] = []
    if (textEl.value) targets.push(textEl.value)
    if (imageEl.value) targets.push(imageEl.value)

    if (!targets.length) return

    gsap.fromTo(
        targets,
        { opacity: 0, x: 300 },
        {
            opacity: 1,
            x: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: 'power2.out'
        }
    )
}

onMounted(() => {
    runEnterAnimation()

    if (!import.meta.client) return

    timer = window.setInterval(() => {
        activeIndex.value = (activeIndex.value + 1) % slides.length
    }, 5000)
})

onBeforeUnmount(() => {
    if (timer) {
        window.clearInterval(timer)
        timer = null
    }
})

watch(
    activeIndex,
    async () => {
        await nextTick()
        runEnterAnimation()
    }
)
</script>
