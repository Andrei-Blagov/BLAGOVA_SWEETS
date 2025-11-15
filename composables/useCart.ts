import { computed } from 'vue'
import { useState } from '#imports'

export interface CartItem {
    id: number | string
    name: string
    price: number
    image: string
    quantity: number
}

export interface ProductInput {
    id: number | string
    name: string
    price: number
    image: string
}

export const useCart = () => {
    const items = useState<CartItem[]>('cart-items', () => [])

    const totalItems = computed(() =>
        items.value.reduce((sum, item) => sum + item.quantity, 0)
    )

    const totalPrice = computed(() =>
        items.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
    )

    function addItem(product: ProductInput, quantity = 1) {
        if (quantity <= 0) return

        const existing = items.value.find((i) => i.id === product.id)
        if (existing) {
            existing.quantity += quantity
        } else {
            items.value.push({
                ...product,
                quantity
            })
        }
    }

    function removeItem(id: number | string) {
        items.value = items.value.filter((i) => i.id !== id)
    }

    function setItemQuantity(id: number | string, quantity: number) {
        if (quantity <= 0) {
            removeItem(id)
            return
        }

        const item = items.value.find((i) => i.id === id)
        if (!item) return
        item.quantity = quantity
    }

    function clearCart() {
        items.value = []
    }

    return {
        items,
        totalItems,
        totalPrice,
        addItem,
        removeItem,
        setItemQuantity,
        clearCart
    }
}
