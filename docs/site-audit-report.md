# Ревизия проекта BLAGOVA SWEETS · Pattaya Atelier

**Дата:** 19 сентября 2026  
**Ветка:** `prototype/pattaya-atelier`  
**Стек:** Nuxt 4.2 · Vue 3.5 · TypeScript · Tailwind · Supabase · Edge Functions  
**Статус продукта:** интерактивный прототип будущей кондитерской/кофейни в Паттайе (не коммерческий запуск)

---

## 1. Краткий вердикт

Проект — сильный **концептуальный прототип витрины** с уже намеченной операционной основой (Supabase, staff auth, intake заказов). Визуальный язык и ключевые сценарии посетителя (каталог → подарок/праздник → корзина → checkout) проработаны лучше, чем типичный MVP.

Главный риск — **архитектурный долг от слияния двух поколений сайта** (российская витрина + паттайский atelier) и **разрыв между демо-слоем (localStorage) и рабочим слоем (Supabase)**. До коммерческого запуска критично: убрать мёртвый код, сверить цены на сервере, довести i18n/SEO, закрыть незавершённые формы и разорвать зависимость от клиентских цен.

Приоритет работ ниже: **P0** — блокер запуска / безопасность / целостность денег; **P1** — качество продукта и поддержка; **P2** — polish и рост.

---

## 2. Что есть сейчас (карта системы)

### 2.1. Активный продуктовый контур (прототип Pattaya)

| Слой | Содержание |
| --- | --- |
| Витрина | `pages/index`, `menu`, `products/[slug]`, `gift-box`, `celebration`, `cafe`, `cooperation`, `delivery`, `cart`, `checkout` |
| UI-система | `components/atelier/*`, `assets/css/main.css` + `operations.css`, CSS-токены paper/cocoa/berry |
| Состояние клиента | `useAtelier` (корзина, locale), `useOperations` (демо-чат/админка в localStorage) |
| Backend intake | Edge Function `storefront-order` → RPC `receive_storefront_order` |
| Staff | `/login`, `/admin` через Supabase Auth + RLS + RPC `staff_*` |
| Демо-операции | `/demo-admin`, плавающий `AtelierChat` (keyword bot, без LLM) |

### 2.2. Наследие старого сайта (в основном неиспользуемое)

| Артефакт | Проблема |
| --- | --- |
| `components/Header.vue`, `Footer.vue`, `HeroSection.vue`, `AboutCarousel.vue`, `ProductCard.vue`, … | Не подключены в `layouts/default.vue`; layout уже на Atelier |
| `composables/useCart.ts` + `plugins/cart.client.ts` | Параллельная корзина в ₽-логике старого магазина |
| `data/products.ts` + ~31 MB фото | Каталог РФ; живой каталог — `data/atelier.ts` |
| `server/api/*.post.ts`, Prisma/MySQL, Nodemailer | Заблокированы middleware прототипа; дублируют Supabase-путь |
| `pages/about.vue`, `contact.vue` | Редирект на `/cafe` — «дыры» в IA |
| `CookieConsent.vue` | Не подключён в layout |
| `README.md` | Описывает старый российский прод, а не текущую ветку |
| `blagova_sweets_static.zip` (37 MB) | Архив в корне репозитория |

### 2.3. Что сознательно не доделано (и это нормально для прототипа)

- LINE, Google Calendar, AI/RAG  
- Обратная доставка ответов менеджера в чат витрины  
- Реальные платежи и производственный календарь  
- Партнёрская форма (`cooperation`) — только UI-демо  
- Тайская локализация без проверки носителем  
- Cookie-баннер / аналитика / полноценный SEO  

---

## 3. Сильные стороны (сохранить)

1. **Ясный бренд и иерархия витрины** — hero, коллекция, gift story, celebration, café, partners; один сценарий на секцию.  
2. **Честность прототипа** — demo-bar, дисклеймеры, `is_demo`, `noindex`, тексты «не заказ / не оплата».  
3. **Трёхъязычность заложена с первого экрана** (RU/EN/TH) — правильное направление для Паттайи.  
4. **Операционный фундамент в Supabase** — RLS, роли staff, money в minor units, `request_key` idempotency, rate limit, revision/events.  
5. **Edge Function intake** — origin allowlist, payload limits, idempotent email keys, HTML escape.  
6. **Доступность на базовом уровне** — skip-link, focus-visible, `prefers-reduced-motion`, aria у чата/меню.  
7. **Документация в `docs/`** — database foundation, chat plan, deployment — помогает онбордингу.

---

## 4. Критические слабые места и рекомендации

### 4.1. Архитектура и техдолг

#### R1 · P0 — Убрать «двойной сайт» из активной ветки

**Сейчас:** в одном репозитории живут Atelier-витрина и полный набор компонентов/данных/API старого российского магазина. Layout уже Atelier, но мёртвый код, Tailwind-тема `primary-800: #3E276A`, GSAP-зависимости и 31 MB фото остаются.

**Почему плохо:** повышает когнитивную нагрузку, риск случайного подключения старого Header/useCart, путает ревьюеров и AI-агентов, раздувает бандл и Docker-контекст.

**Что сделать:**
1. Вынести legacy в отдельную ветку/архив или каталог `legacy/` с явным README «не для prototype».  
2. Удалить из сборки: неиспользуемые Vue-компоненты, `useCart`, `plugins/cart.client.ts`, `data/products.ts` (если фото нужны — оставить точечно).  
3. Удалить или вынести `blagova_sweets_static.zip` из git.  
4. Переписать корневой `README.md` под Pattaya-прототип; старый README сохранить как `docs/legacy-russia-site.md`.

#### R2 · P0 — Одна модель заказа и одна корзина

**Сейчас:** `useAtelier` (THB, localStorage) + `useOperations` (локальные DEMO-заказы) + Supabase orders + старый `useCart` + файловые `orders.json`.

**Почему плохо:** разные истины о заказе. Менеджер смотрит `/admin` (Supabase), а демо-чат/handoff живут в `/demo-admin` (localStorage) без моста. Легко тестировать «не тот» поток.

**Что сделать:**
1. Оставить **один** клиентский cart (`useAtelier`).  
2. Все «реальные» заявки — только через `storefront-order`.  
3. `/demo-admin` пометить как обучающий sandbox **или** постепенно заменить чтением Supabase (read-only demo role).  
4. Handoff «вызвать менеджера» писать в `conversations` в БД, а не только в localStorage.

#### R3 · P1 — Согласовать Prisma/MySQL и Supabase

**Сейчас:** `prisma/schema.prisma` описывает MySQL с другой моделью статусов/ролей; живая схема — Postgres в Supabase.

**Почему плохо:** два «источника правды» для данных; Prisma тянет `@prisma/client` в зависимости без пользы для прототипа.

**Что сделать:** зафиксировать Supabase как единственную БД; Prisma/MySQL и Nitro API (`server/api`) либо удалить, либо перенести в `legacy/` до отдельного решения. Не поддерживать два бэкенда параллельно.

---

### 4.2. Безопасность и целостность коммерции

#### R4 · P0 — Серверная сверка цен и состава заказа

**Сейчас:** клиент присылает `name`, `price`, `quantity`; RPC принимает `unit_price_minor` как есть (верхняя граница 100_000_000 satang). Нет привязки к `products` / `product_variants` в каталоге БД.

**Почему плохо:** любой может отправить торт за ฿1. Для демо терпимо; для запуска — критический fraud-вектор.

**Что сделать:**
1. Каталог в Supabase — source of truth (уже есть таблицы).  
2. Intake принимает `variant_id` + `quantity` (+ опции: вес, надпись).  
3. Сервер считает `unit_price_minor` и `line_total` сам; отклоняет неизвестные/неактивные варианты.  
4. Доставку считать по зоне на сервере (уже частично: 12000/18000), не доверять произвольной сумме сверх whitelist.

#### R5 · P0 — Не путать publishable key с «безопасностью»

**Сейчас:** publishable key в `nuxt.config` — нормально для anon. Защита — RLS + Edge Function.

**Риск:** `/demo-admin` без auth; если когда-то подключить к реальным данным — утечка PII.

**Что сделать:** до любых non-demo данных запретить публичный доступ к `/demo-admin` (auth или удаление с прода). Проверить, что `robots.txt` + meta noindex остаются до публичного запуска. Регулярно прогонять SQL-тесты из `supabase/tests`.

#### R6 · P1 — Origin allowlist и окружения

**Сейчас:** жёсткий список origin в Edge Function (ChatGPT site, blagovasweets.com, localhost).

**Почему важно:** preview/VPS/staging легко «отвалится» с 403; соблазн расширить `*` — опасен.

**Что сделать:** конфигурировать origins через env (`ALLOWED_ORIGINS`), держать отдельные ключи/проекты для preview и prod, документировать процедуру добавления домена.

#### R7 · P1 — PII и согласие

**Сейчас:** checkout сохраняет контакты в Supabase; cookie-баннер не подключён; партнёрская форма ничего не пишет (ок для демо).

**Что сделать перед публичным трафиком:**
1. Политика конфиденциальности + явный consent (уже есть чекбокс на checkout — расширить ссылкой на политику).  
2. CookieConsent в layout, адаптированный под Atelier-стиль и PDPA (Таиланд) / GDPR при EU-хостинге данных (Frankfurt).  
3. Retention policy для demo-заказов и право на удаление.

#### R8 · P1 — Старые API при включении SSR

**Сейчас:** middleware режет `/api/*`. Код `orders.post.ts` пишет JSON на диск и доверяет `totalPrice` с клиента.

**Что сделать:** не «включать обратно» файловые API. Если нужен Nitro — новый thin proxy к тем же RPC/Edge, с той же валидацией цен.

---

### 4.3. Информационная архитектура и незавершённые страницы

#### R9 · P0 — Закрыть «битые» маршруты и ожидания пользователя

| Маршрут | Сейчас | Рекомендация |
| --- | --- | --- |
| `/about`, `/contact` | 302 → `/cafe` | Либо настоящие страницы About/Contact, либо 301 на осмысленные URL + убрать из старых ссылок |
| `/delivery` | Только дисклеймер | Контент зон/тарифов **или** явный «Coming soon» + CTA в меню |
| `/cooperation` форма | `sent=true` локально | Подключить к intake/CRM **или** mailto/LINE + честный UX «напишите нам» |
| Навигация | Нет Contact / About | Добавить контакты (LINE, email, Instagram) в footer минимум |

**Почему:** редирект «О нас» → «Кофейня» ломает ментальную модель; партнёрская форма с успехом без отправки вводит в заблуждение, когда demo-bar снимут.

#### R10 · P1 — Единый footer/contacts как source of truth

Контакты, соцсети, юр. статус («ещё не открыто») должны жить в одном `data/site.ts` / CMS, а не размазываться по компонентам. Иначе при открытии адреса легко забыть обновить одно из мест.

#### R11 · P1 — Разделить demo-chrome и production-chrome

Demo-bar, тексты «тестовая заявка», ссылки на `/demo-admin` должны управляться флагом `runtimeConfig.public.demoMode`. Сейчас предупреждения захардкожены — правильно для прототипа, но без флага их сложно снять точечно к запуску.

---

### 4.4. Интернационализация (i18n)

#### R12 · P0 — Заменить inline `t(ru,en,th)` на систему словарей

**Сейчас:** каждая строка — три литерала в шаблоне; URL без префикса локали; SEO-title часто только на одном языке.

**Почему плохо:**
- невозможно ревьюить переводы отдельно;  
- дубли и расхождения;  
- нет `/en/...` / `/th/...` для SEO;  
- тайский текст помечен как требующий native review.

**Что сделать:**
1. `@nuxtjs/i18n` (или аналог) + JSON/YAML словари `ru`/`en`/`th`.  
2. Prefixed routes или `hreflang`.  
3. Процесс: TH → native review checklist перед launch.  
4. Персонализацию в корзине хранить структурированно (вес, message), а не готовой строкой на языке добавления (уже отмечено в PROTOTYPE.md).

---

### 4.5. Каталог и контент

#### R13 · P0 — Каталог из БД, не только из `data/atelier.ts`

**Сейчас:** 6 SKU в TypeScript; в Supabase уже есть `products` / `variants` / `fillings`, но витрина их не читает.

**Почему:** владелец не сможет менять цены/наличие без деплоя; серверная сверка цен (R4) требует единого каталога.

**Что сделать:** витрина читает published products через anon RLS; админка owner редактирует; TS-файл оставить только как seed/fixture для тестов.

#### R14 · P1 — Уникальные фото и реальные ассеты

Повтор одних и тех же WebP у разных SKU, концепт-изображения ImageGen, 31 MB старых фото в `public/photos_of_products`.

**Что сделать:** бриф на фотосессию; WebP/AVIF + размеры; удалить неиспользуемые ассеты; `width`/`height` уже есть — сохранить; добавить blur-placeholder при необходимости.

#### R15 · P1 — Аллергены, lead time, наличие

Хороший задел в типах. Перед запуском: юридически корректные аллергены (TH labeling), календарь lead time с учётом загрузки производства (не только `leadDays` на SKU), статус `sold out` / seasonal.

---

### 4.6. UX / UI

#### R16 · P1 — Типографика

`--serif: Georgia` и `--sans: Arial` — системные стеки. Для брендового сайта Паттайи лучше подобрать пару с лицензией и поддержкой тайского (например, display + Noto Sans Thai / IBM Plex Thai), подключить через `font-face` / `nuxt/fonts`, не блокируя FCP.

#### R17 · P1 — Мобильная навигация и плотность

Desktop-nav + burger ок. Проверить: sticky header + demo-bar + chat launcher + toast — не перекрывают CTA на 390px. Gift-box и celebration — сложные формы; добавить progress («шаг 2 из 3») и sticky summary цены.

#### R18 · P2 — Движение

`prefers-reduced-motion` учтён — хорошо. Добавить 2–3 осмысленных micro-interaction в Atelier (reveal секций, bag bounce) через CSS, без возврата тяжёлого GSAP на каждую карточку (старый ProductCard тянет GSAP).

#### R19 · P1 — Пустые и ошибочные состояния

Checkout/cart уже имеют empty states. Добавить: offline/ошибка Edge Function с retry; 404 страница в стиле бренда; состояние «каталог временно недоступен».

#### R20 · P2 — Админка UX

`/admin` функционален, но монолитный SFC (~200 строк template). Разбить на вкладки-компоненты; на мобиле sidebar неудобен — нужен bottom-nav / drawer. Календарь сейчас фильтрует только загруженную страницу заказов — для запуска нужен серверный query по дате.

---

### 4.7. Чат и коммуникации

#### R21 · P1 — Чат: честный scope до LLM

Keyword + knowledge keywords — ок для прототипа. Риски: ложные обещания («менеджер ответит»), расхождение knowledge в localStorage vs `knowledge_documents` в Supabase.

**Что сделать:**
1. Публичные ответы чата — только из `knowledge_documents` status=published visibility=public.  
2. Handoff создаёт conversation в БД + (позже) LINE Notify / push в admin.  
3. LLM/RAG — отдельный этап после утверждённой базы знаний и guardrails (см. `docs/knowledge-base-draft.md`).

#### R22 · P1 — Партнёры и контакты — один канал intake

Сейчас заказы → Supabase; партнёры → noop; старый contact.php в legacy. Унифицировать: `enquiry` type (order | partner | contact) в одной Edge Function или отдельном RPC.

---

### 4.8. SEO, аналитика, перформанс

#### R23 · P1 — SEO-каркас к запуску

Сейчас правильно `noindex`. К launch:
- уникальные title/description на язык;  
- Open Graph / Twitter cards с фото продукта;  
- sitemap + сменить `robots.txt`;  
- JSON-LD `Bakery` / `Product` / `Offer` (только когда цены реальные);  
- канонические URL с локалью.

#### R24 · P1 — Производительность

- `main.css` ~2400 строк + Tailwind — проследить purge; рассмотреть разделение operations.css только для admin layout.  
- Не тащить GSAP/nodemailer/prisma в клиентский бандл витрины.  
- Проверить LCP hero (`fetchpriority="high"` уже есть).  
- Убрать zip и лишние фото из Docker context (`.dockerignore`).

#### R25 · P2 — Аналитика

Планировать privacy-friendly аналитику (Plausible/Umami или GA4 с consent). События: add_to_cart, begin_checkout, submit_order, chat_open, language_switch.

---

### 4.9. Качество кода, тесты, процесс

#### R26 · P0 — Автотесты и CI

**Сейчас:** SQL-тесты и `tests/supabase-auth.mjs` есть; в `package.json` нет `test`/`lint`/`typecheck`; отдельный tsc не гонялся (сеть).

**Что сделать:**
1. `nuxt typecheck` / `vue-tsc` в CI.  
2. ESLint + Prettier.  
3. Playwright smoke: home, locale, add to bag, checkout validation, login gate admin.  
4. CI job на SQL tests против ephemeral DB.

#### R27 · P1 — Декомпозиция больших файлов

`admin.vue`, `demo-admin.vue`, `Chat.vue`, `main.css` — кандидаты на модули. Иначе регрессии неизбежны.

#### R28 · P1 — Единый стиль кода

Смешение Composition API ок, но: где-то явные `import { computed } from 'vue'`, где-то автоимпорты Nuxt; старые компоненты — Options-like шаблоны. Принять convention: Nuxt auto-imports, `<script setup lang="ts">`, Atelier design tokens only.

#### R29 · P2 — Observability

Логи Edge Function уже есть (`console.error`). Добавить: structured logs без PII, алерт на spike 429/5xx, backup/retention policy Postgres (документировать RPO/RTO).

---

### 4.10. Деплой и окружения

#### R30 · P1 — Согласовать static generate и staff SPA

`Dockerfile` → `nuxt generate` → nginx. Staff auth и admin работают как SPA против Supabase — ок. Но preview middleware режет API; healthcheck ожидает `/health` — убедиться, что nginx отдаёт его (см. `deploy/nginx.conf`).

**Что сделать:** явные env: `demo` / `preview` / `prod`; секреты только в Supabase/host; документ cutover DNS из `docs/deployment-context.md` превратить в чеклист запуска.

#### R31 · P2 — Owner activation

По `docs/owner-activation.md` / database-foundation: владелец ещё не активирован. Без этого `/admin` бесполезен в бою. Закрыть до первого внешнего теста с реальными менеджерами.

---

## 5. Матрица приоритетов (roadmap-ориентир)

### Фаза A — «Чистый прототип» (сразу)

- R1 очистка legacy  
- R2 одна корзина / ясный статус demo-admin  
- R9 честные страницы и формы  
- R11 флаг `demoMode`  
- R26 typecheck + минимальный smoke  
- README под текущую ветку  

### Фаза B — «Готовность к закрытой бете»

- R4 серверные цены из каталога  
- R13 витрина ← Supabase catalog  
- R12 i18n-модуль + native TH review  
- R7 privacy/cookies  
- R21 chat knowledge из БД + handoff в conversations  
- R31 owner/staff accounts  
- R14 реальные фото  

### Фаза C — «Коммерческий запуск»

- Платежи (idempotent webhooks)  
- LINE + Calendar dispatcher (уже заложены jobs `held`)  
- Производственный календарь / capacity  
- R23 SEO index  
- Юридические тексты, аллергены, адрес, часы  
- Мониторинг и бэкапы (R29)  

---

## 6. Рекомендуемая целевая архитектура

```
[Витрина Nuxt SSR/SSG]
   │  i18n dictionaries · catalog read (anon RLS)
   │  cart (client) · checkout
   ▼
[Edge Functions]
   │  validate origin · rate limit
   │  resolve prices from catalog
   │  receive_storefront_order / enquire_partner
   ▼
[Supabase Postgres + Auth + RLS]
   │  orders · conversations · knowledge · staff
   ▼
[Admin Nuxt pages]
   │  staff RPC only
   ▼
[Workers / n8n later]
      LINE · Calendar · email · (optional) AI retrieval
```

Удалить из целевого контура: файловый JSON API, Prisma/MySQL, PHP contact, параллельный `useCart`, публичный `/demo-admin` на проде.

---

## 7. Чеклист «не запускать в прод, пока…»

- [ ] Цены и наличие считаются на сервере по каталогу БД  
- [ ] Нет публичной демо-админки с доступом к реальным данным  
- [ ] Owner/manager созданы, RLS прогнан тестами  
- [ ] Партнёрская/контактная формы реально доставляют заявки  
- [ ] TH-тексты проверены носителем; юридические страницы на месте  
- [ ] Cookie/consent и политика хранения PII  
- [ ] `noindex` снят осознанно; OG/sitemap готовы  
- [ ] Платежи или явный offline-payment flow с ручным подтверждением  
- [ ] Адрес, часы, аллергены, lead times — утверждённые, не placeholder  
- [ ] CI: typecheck + smoke e2e + SQL access tests  

---

## 8. Итог

Прототип уже выполняет свою работу: показывает бренд, сценарии покупки и контур операций. Слабые места не в «отсутствии красоты», а в **незавершённой консолидации архитектуры**, **доверии к клиентским ценам**, **раздвоении демо/рабочих данных** и **наследии старого сайта**. Если двигаться по фазам A→B→C выше, из текущего кода получается цельный продукт без необходимости переписывать Nuxt «с нуля».

---

*Отчёт составлен по состоянию репозитория на 19.09.2026. Не заменяет security audit / legal review / native language QA.*
