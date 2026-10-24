# Сохранённые legacy элементы

Текущий demo работает через Atelier pages/layout, Supabase и static Nginx.
Этот архив не включает PHP/SMTP/MySQL автоматически и не мигрирует данные.

| Элемент | Статус |
|---|---|
| contact.php | Сохранённая PHP форма; находится вне public. В финальном Nginx image нет PHP runtime. |
| nuxt/cart.client.ts | Бывший auto plugin из plugins/. Читал bakery-cart и создавал старый useCart store. В текущем Atelier не нужен, больше не auto-registered. |
| ../composables/useCart.ts | Сохранён для ссылок из старых Header/PopularProductsSection; текущие pages/layout используют useAtelier. |
| ../components/AboutCarousel.vue, ProductCard.vue | Сохраняют GSAP imports; поэтому пакет не удалён без архивации/проверки всей classic UI цепочки. |
| ../server/api/contact.post.ts, orders.post.ts | Оставлены для документированного build:server; не входят в static runtime. Обычные /api пути блокирует prototype middleware. Не приняты для Node production. |
| ../server/utils/notifications.ts | Импортирует Nodemailer для этих Node handlers. Текущий Edge outbox его не использует. |
| ../prisma/schema.prisma, ../prisma.config.ts | MySQL/Prisma CLI артефакты; нет исполняемого PrismaClient import в app/server. Генератор/CLI сохраняются, удаление пакетов отложено. Текущие migrations — supabase/migrations. |

Перенос cart bootstrap не очищает localStorage и не меняет актуальный ключ
blagova-prototype-basket-v1. Его владелец — plugins/atelier.client.ts с нормализацией.
Не возвращать bootstrap в plugins/ без явного решения о classic-mode: это снова
включит чтение отдельного bakery-cart. Не объявлять безопасность Node routes
только по guard: case variants и полноценный HTTP/runtime acceptance здесь не
проверялись. Никакие старые handlers не запускались и писем/Telegram не отправляли.
