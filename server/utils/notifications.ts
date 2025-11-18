// server/utils/notifications.ts
import nodemailer from 'nodemailer'
import { useRuntimeConfig } from '#imports'

type EmailOptions = {
    subject: string
    text: string
}

export async function sendEmailNotification({ subject, text }: EmailOptions) {
    const config = useRuntimeConfig()

    if (!config.smtpHost || !config.smtpUser || !config.smtpPass || !config.orderEmailTo) {
        console.warn('SMTP config is not set, email will not be sent')
        return
    }

    const transporter = nodemailer.createTransport({
        host: config.smtpHost,                 // mail.hosting.reg.ru
        port: config.smtpPort || 465,         // 465 из .env
        secure: true,                          // для 465 обязательно true
        auth: {
            user: config.smtpUser,
            pass: config.smtpPass
        }
    })

    await transporter.sendMail({
        from: config.orderEmailFrom,
        to: config.orderEmailTo,
        subject,
        text
    })
}

type TelegramOptions = {
    text: string
}

export async function sendTelegramNotification({ text }: TelegramOptions) {
    const config = useRuntimeConfig()

    if (!config.telegramBotToken || !config.telegramChatId) {
        console.warn('Telegram config is not set, telegram message will not be sent')
        return
    }

    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`

    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: config.telegramChatId,
            text
        })
    })
}
