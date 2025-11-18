import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    orderEmailTo: process.env.ORDER_EMAIL_TO || 'hello@blagovasweets.ru',
    orderEmailFrom: process.env.ORDER_EMAIL_FROM || 'BLAGOVA_SWEETS<hello@blagovasweets.ru >',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    public: {}
  },
  app: {
    head: {
      title: 'BLAGOVA_SWEETS — свежие десерты каждый день',
      meta: [
        {
          name: 'description',
          content: 'Сайт BLAGOVA_SWEETS: меню, заказ, контакты.'
        }
      ],
      link: [
        // { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        // можно добавить PNG-иконку
        { rel: 'icon', type: 'image/png', href: '/favicon.png', sizes: '180x180' },
        // и иконку для iOS
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon.png' }
      ]
    }
  }
})