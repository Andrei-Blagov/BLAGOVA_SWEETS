import { defineEventHandler, readBody } from 'h3'
import { promises as fs } from 'fs'
import { join } from 'path'
import { sendEmailNotification, sendTelegramNotification } from '~/server/utils/notifications'

const ORDERS_FILE = join(process.cwd(), 'data', 'orders.json')

interface OrderItem {
    id: number | string
    name: string
    price: number
    image: string
    quantity: number
}

interface OrderPayload {
    name: string
    phone: string
    email?: string
    address: string
    comment?: string
    items: OrderItem[]
    totalItems: number
    totalPrice: number
}

export default defineEventHandler(async (event) => {
    const body = (await readBody(event)) as Partial<OrderPayload>

    if (
        !body ||
        !body.name ||
        !body.phone ||
        !body.address ||
        !Array.isArray(body.items) ||
        body.items.length === 0
    ) {
        return {
            success: false,
            message: 'Неверные данные заказа'
        }
    }

    const order: OrderPayload & { id: string; createdAt: string } = {
        id: Date.now().toString(),
        name: body.name,
        phone: body.phone,
        email: body.email || '',
        address: body.address,
        comment: body.comment || '',
        items: body.items,
        totalItems: body.totalItems ?? 0,
        totalPrice: body.totalPrice ?? 0,
        createdAt: new Date().toISOString()
    }

    // 1) сохраним в файл
    const dir = join(process.cwd(), 'data')
    try {
        await fs.mkdir(dir, { recursive: true })
    } catch { }

    let existing: any[] = []
    try {
        const content = await fs.readFile(ORDERS_FILE, 'utf-8')
        existing = JSON.parse(content)
        if (!Array.isArray(existing)) existing = []
    } catch {
        existing = []
    }

    existing.push(order)

    await fs.writeFile(ORDERS_FILE, JSON.stringify(existing, null, 2), 'utf-8')

    // 2) уведомления
    try {
        const adminText = formatOrderText(order, '-')
        const telegramText = formatOrderText(order, '•')
        const customerText = formatCustomerOrderText(order)

        const promises: Promise<any>[] = [
            sendEmailNotification({
                subject: `Новый заказ #${order.id} на сумму ${order.totalPrice} ₽`,
                text: adminText
            }),
            sendTelegramNotification({
                text: telegramText
            })
        ]

        if (order.email) {
            promises.push(
                sendEmailNotification({
                    to: order.email,
                    subject: `Ваш заказ #${order.id} — BLAGOVA_SWEETS`,
                    text: customerText
                })
            )
        }

        await Promise.all(promises)
    } catch (e) {
        console.error('Failed to send notifications for order', order.id, e)
    }

    return {
        success: true,
        orderId: order.id
    }
})

function formatOrderText(
    order: OrderPayload & { id: string; createdAt: string },
    bulletChar: string
) {
    const itemsText = order.items
        .map(
            (i) =>
                `${bulletChar} ${i.name} × ${i.quantity} = ${i.price * i.quantity} ₽`
        )
        .join('\n')

    return [
        `Новый заказ #${order.id}`,
        ``,
        `Имя: ${order.name}`,
        `Телефон: ${order.phone}`,
        order.email ? `Email: ${order.email}` : '',
        `Адрес: ${order.address}`,
        order.comment ? `Комментарий: ${order.comment}` : '',
        ``,
        `Позиции:`,
        itemsText,
        ``,
        `Итого: ${order.totalItems} шт. на сумму ${order.totalPrice} ₽`,
        ``,
        `Создан: ${order.createdAt}`
    ]
        .filter(Boolean)
        .join('\n')
}

function formatCustomerOrderText(
    order: OrderPayload & { id: string; createdAt: string }
) {
    const itemsText = order.items
        .map(
            (i) =>
                `• ${i.name} × ${i.quantity} = ${i.price * i.quantity} ₽`
        )
        .join('\n')

    return [
        `Здравствуйте, ${order.name}!`,
        ``,
        `Спасибо за ваш заказ в BLAGOVA_SWEETS.`,
        `Номер вашего заказа: #${order.id}`,
        `Сумма: ${order.totalPrice} ₽ (${order.totalItems} шт.)`,
        ``,
        `Состав заказа:`,
        itemsText,
        ``,
        `Адрес доставки:`,
        order.address,
        order.comment ? `Комментарий: ${order.comment}` : '',
        ``,
        `Мы свяжемся с вами для подтверждения и уточнения времени доставки.`,
        ``,
        `С наилучшими пожеланиями,`,
        `Команда BLAGOVA_SWEETS`
    ]
        .filter(Boolean)
        .join('\n')
}
