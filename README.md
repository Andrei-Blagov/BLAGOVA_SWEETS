# BLAGOVA_SWEETS — сайт пекарни на Nuxt 4

Проект витрины и мини-интернет-магазина пекарни **BLAGOVA_SWEETS**:

- главная страница с промо-блоком, блоком «О нас» и галереей;
- меню с популярными позициями и категориями;
- корзина и оформление заказа;
- форма обратной связи;
- уведомления о заказах и сообщениях на почту и в Telegram;
- адаптивная вёрстка под мобильные, планшеты и десктоп.

Проект реализован на **Nuxt 4 + Vue 3 + TypeScript + Tailwind CSS**, с анимациями на **GSAP** и серверными маршрутами на **Nitro**.  
Данные товаров на этапе разработки берутся из локального файла, а не из БД.

---

## Стек технологий

- **Nuxt 4.2** (SSR / SPA / Static, Nitro)
- **Vue 3.5** (Composition API, `<script setup>`)
- **TypeScript**
- **Tailwind CSS**
- **GSAP** (анимации в блоке «О нас»)
- **Nodemailer** (SMTP для email-уведомлений)
- **Telegram Bot API** (уведомления в Telegram)
- (опционально) **Prisma + MySQL 8** — для хранения заказов, пользователей, сообщений

---

## Основной функционал

### Главная страница (`pages/index.vue`)

- Hero-блок с описанием бренда и кнопками:
  - переход к сотрудничеству;
  - переход в магазин на OZON.
- Компонент **`AboutCarousel.vue`**:
  - слайдер «О нас» с текстом слева и фото справа;
  - автоматическая смена слайдов каждые 3 секунды;
  - анимация появления через GSAP (fade + лёгкий сдвиг);
  - адаптивная верстка.
- Галерея работ:
  - слайдер с fade-анимацией;
  - теперь подтягивает изображения из популярных товаров.
- Блок «Популярное»:
  - выводит до 3 популярных товаров из `popularProducts` (`data/products.ts`);
  - карточки через компонент `ProductCard.vue`;
  - кнопка «В корзину» интегрирована с `useCart`.

### Меню (`pages/menu.vue`)

- Полный список товаров из `data/products.ts`.
- Фильтрация по категориям (теги: «Все», «Хлеб», «Круассаны», «Торты», «Булочки», «Печенье»).
- Используется `ProductCard.vue` для отображения товара.
- Возможность добавления в корзину из меню.

### Корзина (`pages/cart.vue`)

- Список товаров из глобального состояния `useCart`.
- Возможность:
  - изменить количество;
  - удалить позицию;
  - очистить корзину.
- Подсчёт:
  - общего количества товаров (`totalItems`);
  - общей суммы (`totalPrice`).
- Кнопка перехода к оформлению заказа (`/checkout`).

### Оформление заказа (`pages/checkout.vue`)

- Форма:
  - имя;
  - телефон;
  - адрес доставки;
  - комментарий (опционально).
- Отправка данных на API:
  - `POST /api/orders` (файл `server/api/orders.post.ts`);
- В базовой реализации:
  - заказы сохраняются в файл `data/orders.json`;
  - отправляются уведомления по email и (опционально) в Telegram.

### Контакты (`pages/contact.vue`)

- Блок с контактной информацией:
  - адрес пекарни;
  - телефон;
  - email;
  - время работы;
  - ссылки на соцсети.
- Форма обратной связи:
  - имя;
  - телефон или email;
  - текст сообщения.
- Отправка на API:
  - `POST /api/contact` (файл `server/api/contact.post.ts`);
- Дальнейшая обработка:
  - отправка email через `Nodemailer`;
  - отправка сообщения в Telegram;
  - опционально — сохранение в БД через Prisma.
- Карта:
  - iframe на OpenStreetMap с точкой расположения пекарни;
  - адаптивная высота (tailwind-классы `h-64 sm:h-80 lg:h-96`).

### Сотрудничество (`pages/cooperation.vue`)

- Статика с описанием сотрудничества для кафе, ресторанов, точек продаж.
- Ссылки и кнопки для связи/заявок.

### Хедер (`components/Header.vue`)

- Логотип + брендовая картинка:
  - логотип слева (круглая аватарка);
  - текст/картинка BLAGOVA_SWEETS рядом;
  - описание «Свежие пряники и торты каждый день».
- Навигация:
  - на десктопе: горизонтальное меню (`NuxtLink`).
  - на мобильных: выпадающий список `<select>` (выбор страницы).
- Кнопки:
  - «Меню» (CTA);
  - кнопка OZON:
    - на больших экранах текст: «Наш магазин на OZON»;
    - на маленьких экранах показывается только «OZON», размер кнопки сохранён.
- Адаптивность:
  - layout на `flex` + `flex-wrap`;
  - брейкпоинты `sm`, `md`, `lg` для размеров и видимости элементов.

### Футер (`components/Footer.vue`)

- Логотип и название.
- Описание пекарни и ассортимент.
- Контакты:
  - адрес, телефон, email.
- Реквизиты (ИП, ИНН, ОГРН).
- Навигация (ссылки на основные страницы).

### Модалка о cookie (`components/CookieConsent.vue`)

- Модальное окно снизу экрана с текстом:
  - краткая информация о cookie;
  - кнопки «Принять» и «Только необходимые».
- Хранение решения:
  - `useCookie('cookie-consent')` с `maxAge ~ 1 год`;
  - модалка больше не показывается, если согласие уже дано.
- Подключена глобально в `layouts/default.vue`.

---

## Источник данных товаров

Файл: **`data/products.ts`**

- Описание типа товара:

```ts
export type ProductCategory = 'bread' | 'croissant' | 'cake' | 'bun' | 'cookie'

export interface Product {
  id: number
  slug: string
  name: string
  description: string
  price: number
  category: ProductCategory
  image: string
  isPopular?: boolean
  outOfStock?: boolean
  active?: boolean
}
Масcив products: Product[] — единый источник данных для меню и главной.

PRODUCT_CATEGORIES — список категорий для фильтрации в меню.

popularProducts — фильтр по isPopular === true, используется:

на главной для блока «Популярное»;

в галерее для слайдера.

Состояние корзины
composables/useCart.ts
Композиционный хук useCart инкапсулирует логику корзины:

items — Ref<CartItem[]>, где CartItem включает:

id, name, price, image, quantity.

totalItems — суммарное количество.

totalPrice — суммарная стоимость.

Методы:

addItem(item);

removeItem(id);

setQuantity(id, quantity);

clearCart().

Используется в:

Header.vue (потенциально для отображения количества товаров в корзине);

pages/index.vue, pages/menu.vue (добавление в корзину);

pages/cart.vue, pages/checkout.vue.

Плагин сохранения корзины (plugins/cart.client.ts)
Файл: plugins/cart.client.ts

Синхронизирует корзину с localStorage:

ts
Копировать код
import { watch } from 'vue'
import { useCart } from '~/composables/useCart'

export default defineNuxtPlugin(() => {
  const STORAGE_KEY = 'bakery-cart'
  const { items } = useCart()

  if (!import.meta.client) return

  // восстановление
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

  // сохранение
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
API-маршруты
1. Заказ: POST /api/orders
Файл: server/api/orders.post.ts

Интерфейс данных:

ts
Копировать код
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
Логика:

Валидация:

обязательные поля: name, phone, address, items (не пустой массив);

totalItems и totalPrice можно пересчитать или брать из тела.

Формирование заказа:

ts
Копировать код
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
Сохранение в файл:

путь data/orders.json;

при отсутствии файла — автоматическое создание;

при повреждённом JSON — начинается с пустого массива.

Уведомления (best effort):

e-mail: через sendEmailNotification(subject, text);

Telegram: через sendTelegramNotification(text).

Ответ:

json
Копировать код
{
  "success": true,
  "orderId": "1763456637088"
}
При ошибке валидации:

json
Копировать код
{
  "success": false,
  "message": "Неверные данные заказа"
}
2. Контакты: POST /api/contact
Файл: server/api/contact.post.ts

Минимальный интерфейс:

ts
Копировать код
interface ContactPayload {
  name: string
  contact: string // телефон или email
  message: string
}
Логика:

Валидация:

все поля обязательны;

ограничение длины message (например, до 2000 символов).

Опционально — сохранение в БД (таблица ContactMessage через Prisma).

Уведомления:

отправка e-mail на ORDER_EMAIL_TO/contactEmailTo;

отправка сообщения в Telegram.

Пример ответа:

json
Копировать код
{ "success": true }
При ошибке валидации:

json
Копировать код
{ "success": false, "message": "Заполните все поля" }
Уведомления: e-mail и Telegram
Файл: server/utils/notifications.ts

E-mail (sendEmailNotification)
Используется Nodemailer и runtimeConfig Nuxt:

ts
Копировать код
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
    host: config.smtpHost,               // mail.hosting.reg.ru
    port: config.smtpPort || 465,        // 465 = SSL/TLS
    secure: true,
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
Telegram (sendTelegramNotification)
ts
Копировать код
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
Конфигурация Nuxt (nuxt.config.ts)
Ключевые моменты:

Подключение Tailwind CSS;

runtimeConfig для секретов (.env);

SSR/Static режим.

Фрагмент:

ts
Копировать код
export default defineNuxtConfig({
  ssr: true,

  modules: [
    '@nuxtjs/tailwindcss'
    // другие модули
  ],

  runtimeConfig: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    orderEmailTo: process.env.ORDER_EMAIL_TO,
    orderEmailFrom: process.env.ORDER_EMAIL_FROM || 'BLAGOVA_SWEETS <hello@blagovasweets.ru>',

    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,

    databaseUrl: process.env.DATABASE_URL, // для Prisma (опционально)

    public: {
      // public-настройки при необходимости
    }
  }
})
Переменные окружения (.env)
Пример .env:

env
Копировать код
# SMTP (исходящая почта для уведомлений)
SMTP_HOST=mail.hosting.reg.ru
SMTP_PORT=465
SMTP_USER=hello@blagovasweets.ru
SMTP_PASS=your_smtp_password
ORDER_EMAIL_TO=contact@blagovasweets.ru
ORDER_EMAIL_FROM="BLAGOVA_SWEETS <hello@blagovasweets.ru>"

# Telegram (опционально)
TELEGRAM_BOT_TOKEN=1234567890:XXXXXXXXXXXXXXXXXXXXXXXXXXXX
TELEGRAM_CHAT_ID=123456789

# Prisma / база (опционально, если используется MySQL)
DATABASE_URL="mysql://user:password@localhost:3306/blagova_sweets"
Файл .env не должен попадать в репозиторий.

Prisma + MySQL (опционально)
При желании можно перевести хранение заказов и сообщений в БД.

prisma/schema.prisma
Пример блока:

prisma
Копировать код
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model ContactMessage {
  id        String   @id @default(cuid())
  name      String
  contact   String
  message   String
  source    String?
  createdAt DateTime @default(now())

  @@index([createdAt])
}

// далее модели User, Product, Order, OrderItem и т.п.
prisma.config.ts
ts
Копировать код
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'
import path from 'node:path'

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations')
  },
  datasource: {
    url: env('DATABASE_URL')
  }
})
Миграции и генерация
Локально:

bash
Копировать код
npx prisma migrate dev --name init
npx prisma generate
На проде:

bash
Копировать код
npx prisma migrate deploy
npx prisma generate
После этого в серверных маршрутах можно использовать PrismaClient для чтения/записи.

Установка и запуск локально
Требования
Node.js 18+ (лучше 20+)

npm или pnpm

(опционально) MySQL 8, если используете Prisma

1. Клонирование и зависимости
bash
Копировать код
git clone <repo-url> blagova_sweets
cd blagova_sweets
npm install
2. .env
Создать .env по примеру выше.

3. Режим разработки
bash
Копировать код
npm run dev
Приложение откроется по адресу http://localhost:3000.

Сборка и деплой
SSR / Node-сервер (VPS)
Сборка:

bash
Копировать код
npm run build
Запуск:

bash
Копировать код
node .output/server/index.mjs
Через PM2:

bash
Копировать код
npm install -g pm2
pm2 start .output/server/index.mjs --name blagova_sweets
pm2 save
Nginx в качестве reverse proxy (пример):

nginx
Копировать код
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
Статическая генерация (shared-хостинги)
Генерация статики:

bash
Копировать код
npm run generate
Результат:

готовый статический сайт находится в .output/public.

Заливка:

скопировать содержимое .output/public в корень сайта на хостинге (например, через панель или FTP);

использовать как обычный статический сайт (HTML + JS + CSS).

Важно: в чисто статическом режиме серверные маршруты (/api/orders, /api/contact) работать не будут — для реальной обработки заказов и отправки уведомлений нужен backend (SSR или отдельный Node-сервис).

Дополнительно
Tailwind:

используется для всей сетки, отступов, цветов, типографики;

основные цвета и шрифты описаны в tailwind.config.

GSAP:

используется в AboutCarousel.vue для анимации смены слайдов;

подключается только на клиенте через import.meta.client.

Адаптивность:

используется flex, grid и брейкпоинты sm, md, lg;

хедер, карточки, формы и блоки оптимизированы для мобилок.

Лицензия / авторство
Проект разработан специально для пекарни BLAGOVA_SWEETS.
Повторное использование кода и дизайна — по согласованию с владельцем проекта.
