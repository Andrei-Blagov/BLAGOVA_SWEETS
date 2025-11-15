import { defineEventHandler, readBody } from 'h3'
import { promises as fs } from 'fs'
import { join } from 'path'
import nodemailer from 'nodemailer'
import { useRuntimeConfig } from '#imports'

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

    // 2) отправим уведомления (best-effort, ошибку наружу не выкидываем)
    try {
        await Promise.all([
            sendOrderEmail(order),
            sendOrderTelegram(order)
        ])
    } catch (e) {
        console.error('Failed to send notifications for order', order.id, e)
    }

    return {
        success: true,
        orderId: order.id
    }
})

async function sendOrderEmail(order: OrderPayload & { id: string; createdAt: string }) {
    const config = useRuntimeConfig()

    if (!config.smtpHost || !config.smtpUser || !config.smtpPass || !config.orderEmailTo) {
        console.warn('SMTP config is not set, email will not be sent')
        return
    }

    const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: false,
        auth: {
            user: config.smtpUser,
            pass: config.smtpPass
        }
    })

    const itemsText = order.items
        .map(
            (i) =>
                `- ${i.name} × ${i.quantity} = ${i.price * i.quantity} ₽`
        )
        .join('\n')

    const text = [
        `Новый заказ #${order.id}`,
        ``,
        `Имя: ${order.name}`,
        `Телефон: ${order.phone}`,
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

    await transporter.sendMail({
        from: config.orderEmailFrom,
        to: config.orderEmailTo,
        subject: `Новый заказ #${order.id} на сумму ${order.totalPrice} ₽`,
        text
    })
}

async function sendOrderTelegram(order: OrderPayload & { id: string; createdAt: string }) {
    const config = useRuntimeConfig()
    const token = config.telegramBotToken
    const chatId = config.telegramChatId

    if (!token || !chatId) {
        console.warn('Telegram config is not set, message will not be sent')
        return
    }

    const itemsText = order.items
        .map(
            (i) =>
                `• ${i.name} × ${i.quantity} = ${i.price * i.quantity} ₽`
        )
        .join('\n')

    const text = [
        `Новый заказ #${order.id}`,
        ``,
        `Имя: ${order.name}`,
        `Телефон: ${order.phone}`,
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

    const url = `https://api.telegram.org/bot${token}/sendMessage`

    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML'
        })
    })
}
