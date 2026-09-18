import { defineNuxtConfig } from 'nuxt/config';
export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],
  devtools: {
    enabled: false
  },
  vite: {
    server: {
      allowedHosts: ['terminal.local']
    }
  },
  css: ['~/assets/css/main.css', '~/assets/css/operations.css'],
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
    pageTransition: {
      name: 'page',
      mode: 'out-in'
    },
    head: {
      title: 'BLAGOVA SWEETS — Pattaya · Prototype',
      meta: [{
        name: 'robots',
        content: 'noindex, nofollow'
      }, {
        name: 'theme-color',
        content: '#faf7f2'
      }, {
        name: 'description',
        content: 'BLAGOVA SWEETS Pattaya — концепция кондитерской и кофейни. Интерактивный прототип.'
      }],
      link: [
      // { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      // можно добавить PNG-иконку
      {
        rel: 'icon',
        type: 'image/webp',
        href: '/favicon.webp'
      },
      // и иконку для iOS
      {
        rel: 'apple-touch-icon',
        href: '/favicon.webp'
      }]
    }
  }
});
