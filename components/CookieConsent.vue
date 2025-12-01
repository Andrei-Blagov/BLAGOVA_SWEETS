<template>
    <transition name="fade">
        <div v-if="visible" class="fixed inset-x-0 bottom-0 z-40
             px-4 pb-4 sm:px-0 sm:pb-0
             pointer-events-none">
            <div class="max-w-4xl mx-auto
               pointer-events-auto
               rounded-md shadow-card border border-neutral-200
               bg-white/95 backdrop-blur
               p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div class="flex-1 text-sm text-neutral-700">
                    <p class="font-semibold text-neutral-900 mb-1">
                        Мы используем файлы cookie
                    </p>
                    <p>
                        Продолжая пользоваться сайтом, вы соглашаетесь на использование cookie
                        для сохранения настроек и анализа посещаемости.
                    </p>
                </div>

                <div class="flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
                    <button type="button" class="inline-flex justify-center items-center
                   px-4 py-2 rounded-pill
                   bg-primary-500 text-white text-sm font-semibold
                   hover:bg-primary-600 transition-colors" @click="accept">
                        Принять
                    </button>
                    <button type="button" class="inline-flex justify-center items-center
                   px-4 py-2 rounded-pill
                   border border-neutral-300
                   bg-white text-sm font-medium text-neutral-700
                   hover:bg-neutral-50 transition-colors" @click="decline">
                        Только необходимые
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCookie } from '#imports'

// храним решение в куке на год
const consent = useCookie<'accepted' | 'declined' | null>('cookie-consent', {
    default: () => null,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
})

// показываем модалку, только если ещё нет решения
const visible = computed(() => consent.value === null)

const accept = () => {
    consent.value = 'accepted'
}

const decline = () => {
    consent.value = 'declined'
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.25s ease, transform 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: translateY(8px);
}
</style>
