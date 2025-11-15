import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'BLAGOVA_SWEETS — свежая выпечка каждый день',
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
        // { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }
      ]
    }
  }
})