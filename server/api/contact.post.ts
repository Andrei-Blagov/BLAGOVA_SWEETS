// server/api/contact.post.ts
import { defineEventHandler, readBody } from 'h3'
import { promises as fs } from 'fs'
import { join } from 'path'
import { sendEmailNotification, sendTelegramNotification } from '~/server/utils/notifications'

const CONTACTS_FILE = join(process.cwd(), 'data', 'contacts.json')

interface ContactPayload {
    name: string
    phone?: string
    email?: string
    message: string
}

export default defineEventHandler(async (event) => {
    const body = (await readBody(event)) as Partial<ContactPayload>

    if (!body || !body.name || !body.message) {
        return { success: false, message: 'Неверные данные формы' }
    }

    if (!body.phone && !body.email) {
        return { success: false, message: 'Укажите телефон или email' }
    }

    const contact = {
        id: Date.now().toString(),
        name: body.name.trim(),
        phone: (body.phone || '').trim(),
        email: (body.email || '').trim(),
        message: body.message.trim(),
        createdAt: new Date().toISOString()
    }

    // 1) сохранить в файл
    const dir = join(process.cwd(), 'data')
    try {
        await fs.mkdir(dir, { recursive: true })
    } catch { }

    let existing: any[] = []
    try {
        const content = await fs.readFile(CONTACTS_FILE, 'utf-8')
        existing = JSON.parse(content)
        if (!Array.isArray(existing)) existing = []
    } catch {
        existing = []
    }

    existing.push(contact)

    await fs.writeFile(CONTACTS_FILE, JSON.stringify(existing, null, 2), 'utf-8')

    // 2) уведомления
    try {
        const adminText = formatAdminContactText(contact)
        const customerText = formatCustomerContactText(contact)

        const promises = [
            sendEmailNotification({
                subject: `Новое сообщение с сайта от ${contact.name}`,
                text: adminText
            }),
            sendTelegramNotification({
                text: adminText
            })
        ]

        if (contact.email) {
            promises.push(
                sendEmailNotification({
                    to: contact.email,
                    subject: 'Мы получили ваше сообщение — BLAGOVA_SWEETS',
                    text: customerText
                })
            )
        }

        await Promise.all(promises)
    } catch (e) {
        console.error('Failed to send contact notifications', e)
    }

    return { success: true }
})

function formatAdminContactText(contact: {
    id: string
    name: string
    phone?: string
    email?: string
    message: string
    createdAt: string
}) {
    return [
        `Новое сообщение с сайта`,
        ``,
        `Имя: ${contact.name}`,
        contact.phone ? `Телефон: ${contact.phone}` : '',
        contact.email ? `Email: ${contact.email}` : '',
        ``,
        `Сообщение:`,
        contact.message,
        ``,
        `ID: ${contact.id}`,
        `Создано: ${contact.createdAt}`
    ]
        .filter(Boolean)
        .join('\n')
}

function formatCustomerContactText(contact: {
    name: string
    message: string
}) {
    return [
        `Здравствуйте, ${contact.name}!`,
        ``,
        `Спасибо за ваше сообщение в BLAGOVA_SWEETS.`,
        `Мы получили ваш запрос и свяжемся с вами в ближайшее время.`,
        ``,
        `Ваше сообщение:`,
        contact.message,
        ``,
        `С наилучшими пожеланиями,`,
        `Команда BLAGOVA_SWEETS`
    ].join('\n')
}
