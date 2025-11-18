import { defineEventHandler, readBody } from 'h3'
import { promises as fs } from 'fs'
import { join } from 'path'
import { sendEmailNotification, sendTelegramNotification } from '~/server/utils/notifications'

const CONTACT_FILE = join(process.cwd(), 'data', 'contact-messages.json')

interface ContactPayload {
    name: string
    contact: string
    message: string
}

export default defineEventHandler(async (event) => {
    const body = (await readBody(event)) as Partial<ContactPayload>

    if (!body || !body.name?.trim() || !body.contact?.trim() || !body.message?.trim()) {
        return {
            success: false,
            message: 'Укажите имя, способ связи и сообщение'
        }
    }

    const entry = {
        id: Date.now().toString(),
        name: body.name.trim(),
        contact: body.contact.trim(),
        message: body.message.trim(),
        createdAt: new Date().toISOString()
    }

    await persistContact(entry)

    try {
        const text = formatContactText(entry)

        await Promise.all([
            sendEmailNotification({
                subject: `Новое обращение от ${entry.name}`,
                text
            }),
            sendTelegramNotification({ text })
        ])
    } catch (error) {
        console.error('Failed to send contact notifications', entry.id, error)
    }

    return {
        success: true
    }
})

async function persistContact(entry: { id: string; name: string; contact: string; message: string; createdAt: string }) {
    const dir = join(process.cwd(), 'data')
    try {
        await fs.mkdir(dir, { recursive: true })
    } catch { }

    let existing: any[] = []
    try {
        const content = await fs.readFile(CONTACT_FILE, 'utf-8')
        existing = JSON.parse(content)
        if (!Array.isArray(existing)) existing = []
    } catch {
        existing = []
    }

    existing.push(entry)

    await fs.writeFile(CONTACT_FILE, JSON.stringify(existing, null, 2), 'utf-8')
}

function formatContactText(entry: { id: string; name: string; contact: string; message: string; createdAt: string }) {
    return [
        `Новое обращение #${entry.id}`,
        ``,
        `Имя: ${entry.name}`,
        `Контакт: ${entry.contact}`,
        ``,
        `Сообщение:`,
        entry.message,
        ``,
        `Отправлено: ${entry.createdAt}`
    ]
        .filter(Boolean)
        .join('\n')
}