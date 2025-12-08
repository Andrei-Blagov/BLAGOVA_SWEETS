# BLAGOVA_SWEETS — сайт пекарни на Nuxt 4

Проект витрины и мини-интернет-магазина пекарни **BLAGOVA_SWEETS**:

- главная страница с промо-блоком, блоком «О нас» и галереей/популярными позициями;
- меню с товарами и категориями;
- корзина и оформление заказа (реализовано в коде);
- форма обратной связи;
- адаптивная вёрстка под мобильные, планшеты и десктоп.

Сейчас сайт в продакшене используется как **сайт-визитка**:  
функционал корзины, оформления заказа и Telegram-уведомлений реализован и протестирован, но **по просьбе заказчика временно отключён** на боевом деплое (в т.ч. нет Node-backend’а на хостинге).

Рабочая в проде часть логики:  
**форма контактов отправляет письма через PHP-скрипт `contact.php` (функция `mail()`).**

---

## Стек технологий

- **Nuxt 4.2** (SSR / SPA / Static, Nitro)
- **Vue 3.5** (Composition API, `<script setup>`)
- **TypeScript**
- **Tailwind CSS**
- **GSAP** (анимации в блоке «О нас» и в интерфейсе)
- **Статический деплой** на shared-хостинге (Reg.ru)
- **PHP `contact.php` + `mail()`** — для отправки форм контактов на проде

Дополнительно (используется в локальной/SSR-версии, но сейчас отключено на бою):

- **Nodemailer** (SMTP для email-уведомлений о заказах и сообщениях)
- **Telegram Bot API** (уведомления в Telegram)
- **Prisma + MySQL 8** — для хранения заказов, пользователей, сообщений (опционально)

---

## Текущее состояние проекта

- Продакшен-деплой — **статически сгенерированный сайт** (`npm run generate` + загрузка `.output/public` на хостинг).
- Рабочий функционал:
  - главная, меню, блок «О нас», галерея, контакты, сотрудничество;
  - форма контактов → отправка писем на рабочую почту + письмо-подтверждение пользователю;
  - адаптивная вёрстка.
- Реализовано, но **отключено на боевом деплое**:
  - корзина и оформление заказа;
  - API-маршруты `/api/orders`, `/api/contact` (Nuxt/Nitro);
  - уведомления через Nodemailer/Telegram;
  - интеграция с БД через Prisma.

В будущем возможно переключение на SSR/Node-деплой (VPS), где все серверные фичи будут включены.

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
  - изображения берутся из популярных товаров.
- Блок «Популярное»:
  - выводит до N популярных товаров из `popularProducts` (`data/products.ts`);
  - карточки через компонент `ProductCard.vue`;
  - кнопка «В корзину» интегрирована с `useCart` (в проде экшены скрыты/отключены).

### Меню (`pages/menu.vue`)

- Полный список товаров из `data/products.ts`.
- Фильтрация по категориям (`PRODUCT_CATEGORIES`).
- Карточки товаров — `ProductCard.vue`.
- Логика добавления в корзину реализована, но на бою не используется.

### Корзина (`pages/cart.vue`) — реализовано, но отключено в проде

- Список товаров из глобального состояния `useCart`.
- Возможность:
  - изменить количество;
  - удалить позицию;
  - очистить корзину.
- Подсчёт:
  - общего количества товаров (`totalItems`);
  - общей суммы (`totalPrice`).
- Кнопка перехода к оформлению заказа (`/checkout`).

### Оформление заказа (`pages/checkout.vue`) — реализовано, но отключено в проде

- Форма:
  - имя;
  - телефон;
  - адрес доставки;
  - комментарий (опционально).
- В SSR-версии:
  - отправка данных на `POST /api/orders` (`server/api/orders.post.ts`);
  - сохранение заказов в `data/orders.json` (или в БД при включении Prisma);
  - отправка уведомлений по email и в Telegram.
- На текущем статическом деплое отправка заказов на backend не используется.

### Контакты (`pages/contact.vue`)

- Блок с контактной информацией:
  - адрес пекарни;
  - телефон;
  - email;
  - время работы;
  - ссылки на соцсети/маркетплейс.
- Форма обратной связи:
  - имя (обязательно);
  - телефон и/или email (минимум одно поле должно быть заполнено);
  - сообщение (минимальная длина — 10 символов).
- Валидация на клиенте (`emailPattern`, проверки длины и обязательности).
- Отправка данных:

  **На проде (статический деплой):**

  - форма шлёт POST-запрос на `/contact.php`:
    ```ts
    const res = await $fetch<{ success: boolean; message?: string }>('/contact.php', {
      method: 'POST',
      body: {
        name: form.name,
        phone: form.phone,
        email: form.email,
        message: form.message
      }
    })
    ```

  - `public/contact.php`:
    - принимает JSON;
    - отправляет письмо админу;
    - отправляет письмо-подтверждение пользователю (если указан email).

  **В SSR-/dev-режиме (опционально):**

  - форма может быть настроена на `POST /api/contact` (`server/api/contact.post.ts`), где:
    - письмо отправляется через Nodemailer;
    - (опционально) дублируется в Telegram;
    - (опционально) сохраняется в БД.

- Карта:
  - iframe на OpenStreetMap с точкой расположения пекарни;
  - адаптивная высота (`h-64 sm:h-80 lg:h-96`).

### Сотрудничество (`pages/cooperation.vue`)

- Статика с описанием сотрудничества для кафе, ресторанов, точек продаж.
- Ссылки и кнопки для связи/заявок.

### Хедер (`components/Header.vue`)

- Логотип + брендовая картинка:
  - логотип слева (круглая аватарка);
  - текст/картинка BLAGOVA_SWEETS рядом;
  - подпись «Свежие пряники и торты каждый день».
- Навигация:
  - на десктопе: горизонтальное меню (`NuxtLink`);
  - на мобильных: выпадающий список `<select>` (смена страницы через `router.push`).
- Кнопки:
  - «Меню» (CTA);
  - кнопка OZON:
    - на больших экранах текст: «Наш магазин на OZON»;
    - на маленьких — только «OZON».
- Адаптивность:
  - `flex` + `flex-wrap`, брейкпоинты `sm`, `md`, `lg`.

### Футер (`components/Footer.vue`)

- Логотип и название.
- Краткое описание пекарни и ассортимента.
- Контакты:
  - адрес, телефон, email.
- Реквизиты (ИП, ИНН, ОГРН).
- Навигация (основные ссылки).

### Модалка о cookie (`components/CookieConsent.vue`)

- Модальное окно с сообщением о cookie.
- Кнопки:
  - «Принять все»;
  - «Только необходимые».
- Хранение решения:
  - `useCookie('cookie-consent')` с `maxAge` ~ 1 год;
  - модалка не отображается, если согласие уже сохранено.
- Подключена в `layouts/default.vue`.

---

## Источник данных товаров

Файл: **`data/products.ts`**

- Описание типа товара (пример):

```ts
export type ProductCategory = 'gingerbread' | 'cake' | 'cupcakes' | 'cookie'

export interface Product {
  id: number
  slug: string
  name: string
  description: string
  price: number
  category: ProductCategory
  mainImage: string
  images?: string[]
  isPopular?: boolean
  outOfStock?: boolean
  active?: boolean
}
```

#### Масcив products: Product[] — единый источник данных для меню и главной.

#### PRODUCT_CATEGORIES — список категорий для фильтрации в меню.

#### popularProducts — фильтр по isPopular === true, используется:

  - на главной для блока «Популярное»;

  - в галерее для слайдера.

## Состояние корзины
composables/useCart.ts
Композиционный хук useCart инкапсулирует логику корзины:

  - items — Ref<CartItem[]>, где CartItem включает:

    - id, name, price, image, quantity.

  - totalItems — суммарное количество.

  - totalPrice — суммарная стоимость.

  - Методы:

    - addItem(item);

    - removeItem(id);

    - setQuantity(id, quantity);

    - clearCart().

Использование (логика реализована, но в проде не активна):

  - pages/index.vue, pages/menu.vue — добавление в корзину;

  - pages/cart.vue, pages/checkout.vue — управление корзиной;

  - Header.vue — вывод количества товаров (при необходимости).

## Плагин сохранения корзины (plugins/cart.client.ts)
Файл: plugins/cart.client.ts

Синхронизирует корзину с localStorage:

```ts
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
```
## Уведомления и backend
## 1. E-mail / Telegram через Nuxt (SSR-вариант, сейчас отключён в проде)

#### В продакшене на shared-хостинге эта часть не используется, так как Nuxt-backend не развёрнут (есть только статический фронтенд).

В папке server/utils/notifications.ts реализованы функции:

  - sendEmailNotification — отправка почты через SMTP (Nodemailer);

  - sendTelegramNotification — отправка сообщений в Telegram через Bot API.

Используются в:

  - server/api/orders.post.ts — уведомления о заказах;

  - server/api/contact.post.ts — уведомления о сообщениях с формы.

Для этих функций нужен .env:

```env
# SMTP (исходящая почта для уведомлений заказов/контактов)
SMTP_HOST=mail.hosting.reg.ru
SMTP_PORT=465
SMTP_USER=hello@blagovasweets.ru
SMTP_PASS=your_smtp_password
ORDER_EMAIL_TO=contact@blagovasweets.ru
ORDER_EMAIL_FROM="BLAGOVA_SWEETS <hello@blagovasweets.ru>"

# Telegram (опционально)
TELEGRAM_BOT_TOKEN=1234567890:XXXXXXXXXXXXXXXXXXXXXXXXXXXX
TELEGRAM_CHAT_ID=123456789

# Prisma / база (опционально)
DATABASE_URL="mysql://user:password@localhost:3306/blagova_sweets"
```

### API-маршруты
1. Заказ: POST /api/orders
  Файл: server/api/orders.post.ts

  Интерфейс данных:

  ```ts
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
  ```
  Логика:

1. Валидация:

  - обязательные поля: name, phone, address, items (не пустой массив);

  - totalItems и totalPrice можно пересчитать или брать из тела.

2. Формирование заказа:

  ```ts
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
  ```

3. Сохранение в файл:

  - путь data/orders.json;

  - при отсутствии файла — автоматическое создание;

  - при повреждённом JSON — начинается с пустого массива.

4. Уведомления (best effort):

  - e-mail: через sendEmailNotification(subject, text);

  - Telegram: через sendTelegramNotification(text).

  Ответ:

  ```JSON
  {
    "success": true,
    "orderId": "1763456637088"
  }
  ```
  При ошибке валидации:

  ```JSON
  {
    "success": false,
    "message": "Неверные данные заказа"
  }
  ```

2. Контакты: POST /api/contact
  Файл: server/api/contact.post.ts

  Минимальный интерфейс:

  ```ts
  interface ContactPayload {
    name: string
    contact: string // телефон или email
    message: string
  }
  ```

  Логика:

  1. Валидация:

    - все поля обязательны;

    - ограничение длины message (например, до 2000 символов).

  2. Опционально — сохранение в БД (таблица ContactMessage через Prisma).

  3. Уведомления:

    - отправка e-mail на ORDER_EMAIL_TO/contactEmailTo;

    - отправка сообщения в Telegram.

  Пример ответа:

  ```JSON
  { "success": true }
  ```

  При ошибке валидации:

  ```JSON
  { "success": false, "message": "Заполните все поля" }
  ```

### Уведомления: e-mail и Telegram
Файл: server/utils/notifications.ts

### E-mail (sendEmailNotification)
Используется Nodemailer и runtimeConfig Nuxt:

```ts
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
```

### Telegram (sendTelegramNotification)
```ts
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
```

### Prisma + MySQL (опционально)
При желании можно перевести хранение заказов и сообщений в БД.

prisma/schema.prisma
Пример блока:

```prisma
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
```

prisma.config.ts
```ts
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
```

### Миграции и генерация

Локально:

```bash
npx prisma migrate dev --name init
npx prisma generate
```
На проде:

```bash
npx prisma migrate deploy
npx prisma generate
```

После этого в серверных маршрутах можно использовать PrismaClient для чтения/записи.

## 2. E-mail через PHP (текущий рабочий вариант на статиκе)

Файл: public/contact.php

Используется сейчас на бою. Пример реализации:

```php
<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

$name    = trim($data['name']    ?? '');
$phone   = trim($data['phone']   ?? '');
$email   = trim($data['email']   ?? '');
$message = trim($data['message'] ?? '');

if ($name === '' || $message === '' || ($phone === '' && $email === '')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Заполните обязательные поля']);
    exit;
}

// Письмо админу
$toAdmin    = 'contact@blagovasweets.ru';   // рабочий ящик
$fromEmail  = 'hello@blagovasweets.ru';     // адрес отправителя (с вашего домена)
$subjectAdm = 'Сообщение с сайта BLAGOVA_SWEETS';

$bodyAdm = "Новое сообщение с сайта BLAGOVA_SWEETS\n\n"
         . "Имя: {$name}\n"
         . "Телефон: {$phone}\n"
         . "Email: {$email}\n\n"
         . "Сообщение:\n{$message}\n";

$headersAdm = "From: BLAGOVA_SWEETS <{$fromEmail}>\r\n"
            . "Content-Type: text/plain; charset=utf-8\r\n";

if ($email !== '') {
    $headersAdm .= "Reply-To: {$email}\r\n";
}

$okAdmin = mail($toAdmin, $subjectAdm, $bodyAdm, $headersAdm);

// Письмо пользователю (подтверждение)
$okUser = true;

if ($email !== '') {
    $subjectUser = 'Мы получили ваше сообщение — BLAGOVA_SWEETS';

    $bodyUser = "Здравствуйте, {$name}!\n\n"
              . "Спасибо за обращение в семейную пекарню BLAGOVA_SWEETS.\n"
              . "Мы получили ваше сообщение и свяжемся с вами в ближайшее время.\n\n"
              . "Ваше сообщение:\n{$message}\n\n"
              . "С уважением,\n"
              . "команда BLAGOVA_SWEETS";

    $headersUser = "From: BLAGOVA_SWEETS <{$fromEmail}>\r\n"
                 . "Content-Type: text/plain; charset=utf-8\r\n";

    $okUser = mail($email, $subjectUser, $bodyUser, $headersUser);
}

if ($okAdmin) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Не удалось отправить письмо']);
}
```

Поведение:

 - Администратор получает письмо с деталями заявки.

 - Пользователь (если указал email) получает письмо-подтверждение, что сообщение принято.

## Конфигурация Nuxt (nuxt.config.ts)
Ключевые моменты:

  - Подключение Tailwind CSS;

  - runtimeConfig для секретов (.env);

  - SSR/Static режим.

Фрагмент:

```ts
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
```


## Установка и запуск локально

### Требования
  - Node.js 18+ (лучше 20+)

  - npm или pnpm

  - (опционально) MySQL 8, если используете Prisma

1. ### Клонирование и зависимости
```bash
git clone <repo-url> blagova_sweets
cd blagova_sweets
npm install
```
2. ### .env
Создать .env по примеру выше.

3. ### Режим разработки
```bash
npm run dev
```
Приложение откроется по адресу http://localhost:3000.


## Сборка и деплой

### SSR / Node-сервер (VPS)
  1. Сборка:

  ```bash
  npm run build
  ```
  2. Запуск:

  ```bash
  node .output/server/index.mjs
  ```
  3. Через PM2:

  ```bash
  npm install -g pm2
  pm2 start .output/server/index.mjs --name blagova_sweets
  pm2 save
  ```
  4. Nginx в качестве reverse proxy (пример):

  ```Nginx
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
  ```

### Статическая генерация (shared-хостинги)
1. Генерация статики:

```bash
npm run generate
```
2. Результат:

  - готовый статический сайт находится в .output/public.

3. Заливка:

  - скопировать содержимое .output/public в корень сайта (через панель/FTP/SSH);

  - убедиться, что contact.php лежит в той же директории, что и index.html.

4. Особенности:

  - серверные маршруты /api/orders, /api/contact не работают (нет Node-backend’а);

  - отправка писем с контактов работает через contact.php (PHP / mail());

  - корзина/оформление заказа/Telegram-уведомления реализованы в коде, но отключены в продакшене.

## Дополнительно
  - Tailwind:

    - используется для всей сетки, отступов, цветов, типографики;

    - основные цвета и шрифты описаны в tailwind.config.

  - GSAP:

    - используется в AboutCarousel.vue для анимации смены слайдов;

    - подключается только на клиенте через import.meta.client.

  - Адаптивность:

    - используется flex, grid и брейкпоинты sm, md, lg;

    - хедер, карточки, формы и блоки оптимизированы для мобилок.

## Лицензия / авторство
Проект разработан специально для пекарни BLAGOVA_SWEETS.
Повторное использование кода и дизайна — по согласованию с владельцем проекта.
