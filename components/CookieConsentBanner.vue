<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-x-0 bottom-0 z-[9998] px-4 pb-4 sm:px-6 sm:pb-6 pointer-events-none"
    >
      <div
        class="pointer-events-auto max-w-6xl mx-auto
               bg-neutral-900 text-white
               rounded-md shadow-lg
               px-4 py-3 sm:px-6 sm:py-4
               flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"
      >
        <div class="text-sm leading-snug">
          <p class="font-semibold">
            Мы используем файлы cookie
          </p>
          <p class="mt-1 text-neutral-200">
            Продолжая пользоваться сайтом, вы соглашаетесь с использованием cookie.
            Нажмите «ОК», если согласны.
          </p>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <button
            type="button"
            class="inline-flex items-center justify-center
                   px-4 py-2 rounded-pill
                   bg-primary-500 text-white text-xs font-semibold uppercase tracking-wide
                   hover:bg-primary-600 transition-colors"
            @click="accept"
          >
            ОК
          </button>

          <button
            type="button"
            class="hidden sm:inline-flex items-center text-xs text-neutral-300 hover:text-white"
            @click="hide"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCookie } from '#app'

type ConsentValue = 'accepted' | 'hidden' | 'unknown'

const consent = useCookie<ConsentValue>('cookie-consent', {
  default: () => 'unknown',
  maxAge: 60 * 60 * 24 * 365 // год
})

const visible = computed(() => consent.value !== 'accepted' && consent.value !== 'hidden')

const accept = () => {
  consent.value = 'accepted'
}

const hide = () => {
  consent.value = 'hidden'
}
</script>
