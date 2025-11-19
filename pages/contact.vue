<template>
    <section class="max-w-6xl mx-auto px-4 py-16 lg:py-20">
        <div class="grid gap-10 lg:grid-cols-2">
            <div>
                <h2 class="text-sm font-semibold tracking-wide text-primary-600 uppercase">
                    Контакты
                </h2>
                <h3 class="mt-1 text-3xl font-bold text-neutral-900">
                    Как нас найти
                </h3>

                <div class="mt-6 space-y-4 text-neutral-600">
                    <p>
                        Адрес: Московская обл., г. Ликино-Дулёво, проезд 1905 года 2-й, д. 7
                    </p>
                    <p>
                        Телефон:
                        <a href="tel:+79852361464" class="text-primary-600 hover:text-primary-800">
                            +7 (985) 236-14-64
                        </a>
                    </p>
                    <p>
                        Время работы: ежедневно с 8:00 до 20:00
                    </p>
                    <p>
                        Электронная почта:
                        <a href="mailto:hello@blagovasweets.ru" class="text-primary-600 hover:text-primary-800">
                            hello@blagovasweets.ru
                        </a>
                    </p>
                </div>

                <div class="mt-8">
                    <p class="text-sm font-semibold tracking-wide text-neutral-900 mb-3">
                        Мы в соцсетях и на маркетплейс
                    </p>
                    <div class="flex flex-wrap gap-3">
                        <a href="https://vk.com/public220650443"
                            class="text-sm text-primary-600 hover:text-primary-800">VK
                        </a>
                        <a href="https://www.ozon.ru/seller/blagova-sweets-3450915"
                            class="text-sm text-primary-600 hover:text-primary-800">OZON
                        </a>
                        <a href="#" class="text-sm text-primary-600 hover:text-primary-800">Telegram</a>
                        <a href="#" class="text-sm text-primary-600 hover:text-primary-800">Instagram</a>
                    </div>
                </div>
            </div>

            <div ref="formCard" class="bg-white rounded-md shadow-card p-6 sm:p-8">
                <h3 class="text-xl font-semibold text-neutral-900 mb-4">
                    Написать нам
                </h3>

                <div v-if="submitSuccess" ref="successBanner"
                    class="mb-6 rounded-md bg-accent-green/10 px-4 py-3 text-sm text-accent-green">
                    Спасибо! Мы получили ваше сообщение и перезвоним в ближайшее время.
                </div>

                <form class="space-y-4" @submit.prevent="submitContact">
                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1" for="contact-name">
                            Имя
                        </label>
                        <input id="contact-name" v-model="form.name" type="text" class="w-full px-3 py-2 rounded-sm border
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white" :class="errors.name ? 'border-accent-red' : 'border-neutral-200'"
                            placeholder="Как к вам обращаться" />
                        <p v-if="errors.name" class="mt-1 text-xs text-accent-red">
                            {{ errors.name }}
                        </p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1" for="contact-channel">
                            Телефон или email
                        </label>
                        <input id="contact-channel" v-model="form.contact" type="text" class="w-full px-3 py-2 rounded-sm border
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white" :class="errors.contact ? 'border-accent-red' : 'border-neutral-200'"
                            placeholder="+7… или email" />
                        <p v-if="errors.contact" class="mt-1 text-xs text-accent-red">
                            {{ errors.contact }}
                        </p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-neutral-900 mb-1" for="contact-message">
                            Сообщение
                        </label>
                        <textarea id="contact-message" v-model="form.message" rows="4" class="w-full px-3 py-2 rounded-sm border
                     text-sm text-neutral-900
                     focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                     bg-white resize-none" :class="errors.message ? 'border-accent-red' : 'border-neutral-200'"
                            placeholder="Что вы хотите уточнить или заказать"></textarea>
                        <p v-if="errors.message" class="mt-1 text-xs text-accent-red">
                            {{ errors.message }}
                        </p>
                    </div>

                    <p v-if="submitError" class="text-sm text-accent-red">
                        {{ submitError }}
                    </p>

                    <button type="submit" class="inline-flex items-center justify-center
                   px-6 py-3 rounded-pill
                   bg-primary-500 text-white
                   text-sm font-semibold uppercase tracking-wide
                   hover:bg-primary-800 transition-colors w-full sm:w-auto
                   disabled:opacity-60 disabled:cursor-not-allowed" :disabled="submitting">
                        {{ submitting ? 'Отправка…' : 'Отправить' }}
                    </button>
                </form>
            </div>
        </div>

        <div class="mt-12">
            <div class="w-full h-64 rounded-md bg-neutral-200
               flex items-center justify-center text-neutral-600 text-sm">
                <img src="/map.png" alt="карта" class="w-full h-64 sm:h-80 object-cover" />
            </div>
        </div>
    </section>
</template>
<script setup lang="ts">
import { gsap } from 'gsap'
import { nextTick, reactive, ref } from 'vue'

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

const form = reactive({
    name: '',
    contact: '',
    message: ''
})

const errors = reactive({
    name: '',
    contact: '',
    message: ''
})

const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)
const formCard = ref<HTMLElement | null>(null)
const successBanner = ref<HTMLElement | null>(null)

const validate = () => {
    let ok = true
    errors.name = ''
    errors.contact = ''
    errors.message = ''

    if (!form.name.trim()) {
        errors.name = 'Укажите ваше имя'
        ok = false
    }

    if (!form.contact.trim()) {
        errors.contact = 'Оставьте телефон или email'
        ok = false
    }

    if (!form.message.trim() || form.message.trim().length < 10) {
        errors.message = 'Расскажите, что вас интересует'
        ok = false
    }

    return ok
}

const submitContact = async () => {
    submitError.value = ''
    submitSuccess.value = false

    if (!validate()) return

    submitting.value = true
    try {
        const res = await $fetch<{ success: boolean; message?: string }>('/api/contact', {
            method: 'POST',
            body: {
                name: form.name,
                contact: form.contact,
                message: form.message
            }
        })

        if (!res.success) {
            submitError.value = res.message || 'Не удалось отправить сообщение'
            return
        }

        form.name = ''
        form.contact = ''
        form.message = ''
        submitSuccess.value = true

        if (import.meta.client) {
            await nextTick()
            if (formCard.value) {
                gsap.fromTo(
                    formCard.value,
                    { y: 0 },
                    { y: -6, duration: 0.25, yoyo: true, repeat: 1, ease: 'power1.out' }
                )
            }
            if (successBanner.value) {
                gsap.from(successBanner.value, {
                    opacity: 0,
                    y: -10,
                    duration: 0.4,
                    ease: 'power2.out'
                })
            }
        }
    } catch (error) {
        submitError.value = 'Не удалось отправить сообщение. Попробуйте позже.'
    } finally {
        submitting.value = false
    }
}
</script>