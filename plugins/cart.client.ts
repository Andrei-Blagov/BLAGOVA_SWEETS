import { onMounted, watch } from 'vue'
import { useCart } from '~/composables/useCart'

export default defineNuxtPlugin(() => {
    const STORAGE_KEY = 'bakery-cart'
    const { items } = useCart()

    onMounted(() => {
        // восстановление
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY)
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) {
                    items.value = parsed
                }
            }
        } catch (e) {
            console.error('Failed to restore cart from localStorage', e)
        }

        // сохранение
        watch(
            items,
            (val) => {
                try {
                    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
                } catch (e) {
                    console.error('Failed to save cart to localStorage', e)
                }
            },
            { deep: true }
        )
    })
})
