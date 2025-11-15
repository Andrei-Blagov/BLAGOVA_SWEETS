<template>
    <section class="max-w-4xl mx-auto px-4 py-16 lg:py-20">
        <p class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
            Оформление заказа
        </p>
        <h1 class="mt-1 text-3xl font-bold text-neutral-900">
            Завершить заказ
        </h1>

        <!-- пустая корзина -->
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

        <!-- успешный заказ -->
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

        <!-- форма -->
        <div v-else class="mt-8 grid gap-10 lg:grid-cols-[2fr,1fr]">
            <div class="bg-white rounded-md shadow-card p-6 sm:p-8">
                <h2 class="text-xl font-semibold text-neutral-900 mb-4">
                    Данные для доставки
                </h2>

                <form class="space-y-4" @submit.prevent="submitOrder">
                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1">
                            Имя
                        </label>
                        <input v-model="form.name" type="text" class="w-full px-3 py-2 rounded-sm border
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white" :class="errors.name ? 'border-accent-red' : 'border-neutral-200'"
                            placeholder="Как к вам обращаться" />
                        <p v-if="errors.name" class="mt-1 text-xs text-accent-red">
                            {{ errors.name }}
                        </p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1">
                            Телефон
                        </label>
                        <input v-model="form.phone" type="tel" class="w-full px-3 py-2 rounded-sm border
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white" :class="errors.phone ? 'border-accent-red' : 'border-neutral-200'" placeholder="+7…" />
                        <p v-if="errors.phone" class="mt-1 text-xs text-accent-red">
                            {{ errors.phone }}
                        </p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1">
                            Адрес доставки
                        </label>
                        <textarea v-model="form.address" rows="3" class="w-full px-3 py-2 rounded-sm border
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white resize-none" :class="errors.address ? 'border-accent-red' : 'border-neutral-200'"
                            placeholder="Город, улица, дом, подъезд, комментарии для курьера"></textarea>
                        <p v-if="errors.address" class="mt-1 text-xs text-accent-red">
                            {{ errors.address }}
                        </p>
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

                    <p v-if="submitError" class="text-sm text-accent-red">
                        {{ submitError }}
                    </p>

                    <button type="submit" class="inline-flex items-center justify-center
                   px-6 py-3 rounded-pill
                   bg-primary-500 text-white
                   text-sm font-semibold uppercase tracking-wide
                   hover:bg-primary-600 transition-colors w-full sm:w-auto
                   disabled:opacity-60 disabled:cursor-not-allowed" :disabled="submitting">
                        {{ submitting ? 'Отправка...' : 'Подтвердить заказ' }}
                    </button>
                </form>
            </div>

            <!-- блок "Ваш заказ" как раньше -->
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

const { items, totalItems, totalPrice, clearCart } = useCart()
const submitted = ref(false)
const submitting = ref(false)
const submitError = ref('')

const form = reactive({
    name: '',
    phone: '',
    address: '',
    comment: ''
})

const errors = reactive({
    name: '',
    phone: '',
    address: ''
})

const validate = () => {
    let ok = true
    errors.name = ''
    errors.phone = ''
    errors.address = ''

    if (!form.name.trim()) {
        errors.name = 'Укажите ваше имя'
        ok = false
    }

    if (!form.phone.trim()) {
        errors.phone = 'Укажите телефон'
        ok = false
    } else if (form.phone.replace(/\D/g, '').length < 10) {
        errors.phone = 'Телефон указан некорректно'
        ok = false
    }

    if (!form.address.trim() || form.address.trim().length < 10) {
        errors.address = 'Пожалуйста, укажите полный адрес'
        ok = false
    }

    return ok
}

const submitOrder = async () => {
    submitError.value = ''

    if (!validate()) return
    if (items.value.length === 0) {
        submitError.value = 'Корзина пуста'
        return
    }

    submitting.value = true
    try {
        const res = await $fetch<{ success: boolean; orderId?: string; message?: string }>(
            '/api/orders',
            {
                method: 'POST',
                body: {
                    name: form.name,
                    phone: form.phone,
                    address: form.address,
                    comment: form.comment,
                    items: items.value,
                    totalItems: totalItems.value,
                    totalPrice: totalPrice.value
                }
            }
        )

        if (!res.success) {
            submitError.value = res.message || 'Ошибка при оформлении заказа'
            submitting.value = false
            return
        }

        clearCart()
        submitted.value = true
    } catch (e) {
        submitError.value = 'Не удалось отправить заказ. Попробуйте ещё раз'
    } finally {
        submitting.value = false
    }
}
</script>
