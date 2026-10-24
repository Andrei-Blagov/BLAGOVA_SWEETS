// Archived classic storefront bootstrap. Not auto-registered by the current
// Atelier app; its validated basket is in plugins/atelier.client.ts.
// Do not move back into plugins/ without a deliberate legacy-mode decision.
import { watch } from 'vue'
import { useCart } from '~/composables/useCart'

export default defineNuxtPlugin(() => {
    const STORAGE_KEY = 'bakery-cart'
    const { items } = useCart()

    // проверка на клиент
    if (!import.meta.client) return

    // восстановление из localStorage
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

    // сохранение при изменении
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
