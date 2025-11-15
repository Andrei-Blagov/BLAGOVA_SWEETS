<template>
    <section class="max-w-4xl mx-auto px-4 py-16 lg:py-20">
        <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
            Оформление заказа
        </p>
        <h1 class="mt-1 text-3xl font-bold text-neutral-900">
            Завершить заказ
        </h1>

        <div v-if="items.length === 0 && !submitted" class="mt-8 space-y-4">
            <p class="text-neutral-600">
                В вашей корзине нет товаров. Пожалуйста, добавьте позиции перед оформлением заказа.
            </p>
            <NuxtLink to="/menu" class="inline-flex items-center justify-center
               px-6 py-3 rounded-pill
               bg-primary-500 text-white
               text-sm font-semibold uppercase tracking-wide
               hover:bg-primary-600 transition-colors">
                Перейти к меню
            </NuxtLink>
        </div>

        <div v-else-if="submitted" class="mt-8 space-y-4">
            <h2 class="text-xl font-semibold text-neutral-900">
                Спасибо за заказ!
            </h2>
            <p class="text-neutral-600">
                Мы свяжемся с вами для подтверждения заказа и уточнения времени доставки.
            </p>
            <NuxtLink to="/" class="inline-flex items-center justify-center
               px-6 py-3 rounded-pill
               bg-primary-500 text-white
               text-sm font-semibold uppercase tracking-wide
               hover:bg-primary-600 transition-colors">
                На главную
            </NuxtLink>
        </div>

        <div v-else class="mt-8 grid gap-10 lg:grid-cols-[2fr,1fr]">
            <!-- Форма -->
            <div class="bg-white rounded-md shadow-card p-6 sm:p-8">
                <h2 class="text-xl font-semibold text-neutral-900 mb-4">
                    Данные для доставки
                </h2>
                <form class="space-y-4" @submit.prevent="submitOrder">
                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1">
                            Имя
                        </label>
                        <input v-model="form.name" type="text" class="w-full px-3 py-2 rounded-sm border border-neutral-200
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white" placeholder="Как к вам обращаться" required />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1">
                            Телефон
                        </label>
                        <input v-model="form.phone" type="tel" class="w-full px-3 py-2 rounded-sm border border-neutral-200
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white" placeholder="+7…" required />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1">
                            Адрес доставки
                        </label>
                        <textarea v-model="form.address" rows="3" class="w-full px-3 py-2 rounded-sm border border-neutral-200
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white resize-none" placeholder="Город, улица, дом, подъезд, комментарии для курьера"
                            required></textarea>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1">
                            Комментарий к заказу
                        </label>
                        <textarea v-model="form.comment" rows="3" class="w-full px-3 py-2 rounded-sm border border-neutral-200
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white resize-none"
                            placeholder="Например: без изюма, позвонить за 10 минут до приезда"></textarea>
                    </div>

                    <button type="submit" class="inline-flex items-center justify-center
                   px-6 py-3 rounded-pill
                   bg-primary-500 text-white
                   text-sm font-semibold uppercase tracking-wide
                   hover:bg-primary-600 transition-colors w-full sm:w-auto">
                        Подтвердить заказ
                    </button>
                </form>
            </div>

            <!-- Итог -->
            <aside class="bg-white rounded-md shadow-card p-5 h-fit">
                <h2 class="text-lg font-semibold text-neutral-900 mb-4">
                    Ваш заказ
                </h2>
                <div class="space-y-3 text-sm text-neutral-700 mb-4 max-h-64 overflow-y-auto">
                    <div v-for="item in items" :key="item.id" class="flex justify-between gap-3">
                        <div class="flex-1">
                            <p class="font-medium text-neutral-900">
                                {{ item.name }}
                            </p>
                            <p class="text-xs text-neutral-500">
                                {{ item.quantity }} × {{ item.price }} ₽
                            </p>
                        </div>
                        <div class="text-right">
                            <p class="font-semibold text-neutral-900">
                                {{ item.price * item.quantity }} ₽
                            </p>
                        </div>
                    </div>
                </div>

                <div class="space-y-2 text-sm text-neutral-700 border-t border-neutral-200 pt-4">
                    <div class="flex justify-between">
                        <span>Позиции</span>
                        <span>{{ totalItems }} шт.</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Сумма</span>
                        <span>{{ totalPrice }} ₽</span>
                    </div>
                </div>

                <p class="mt-4 text-xs text-neutral-500">
                    Оплата при получении. После отправки заказа мы позвоним вам для подтверждения.
                </p>
            </aside>
        </div>
    </section>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useCart } from '~/composables/useCart'

const { items, totalItems, totalPrice, clearCart } = useCart()

const submitted = ref(false)

const form = reactive({
    name: '',
    phone: '',
    address: '',
    comment: ''
})

const submitOrder = () => {
    if (items.value.length === 0) return

    // Здесь можно отправить данные на backend
    // console.log({
    //   form,
    //   items: items.value,
    //   totalItems: totalItems.value,
    //   totalPrice: totalPrice.value
    // })

    clearCart()
    submitted.value = true
}
</script>
