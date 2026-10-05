# Проверка миграций и Edge Functions

Эта процедура обязательна для изменений схемы Supabase и Edge Functions. Она не развёртывает production и не раскрывает ключи.

## Перед изменением

1. Сверить текущий commit, ветку и черновой PR №1.
2. Прочитать `AGENTS.md`, `docs/PROJECT_STATE.md` и нужный этап `docs/ROADMAP.md`.
3. Проверить команды установленной версии CLI через `supabase --help` и `supabase <group> --help`; не подставлять флаги по памяти.
4. Перед работой с функцией проверить актуальные документы Supabase по CORS и Edge Functions.

## Миграции

1. Создать новую миграцию через `supabase migration new <name>`; уже применённые файлы не менять.
2. В тестовом проекте выполнить SQL-тесты из `supabase/tests/` и сценарий повторного запроса/конкурентного доступа, относящийся к изменению.
3. Проверить RLS, grants и Security Advisor. Таблицы без клиентских политик должны быть явно доступны только через `service_role` и это должно быть отражено в документации.
4. После готовности сформировать чистую миграцию, проверить список через `supabase migration list --local` и обновить `docs/PROJECT_STATE.md`.

## Edge Functions

1. Локально проверить метод, тело, размер запроса, ошибки, rate limit и идемпотентность.
2. Для browser-вызова отправить `OPTIONS` с разрешённым `Origin`: ожидаются статус `204`, пустое тело и заголовки `Access-Control-Allow-*`.
3. Проверить `POST` с разрешённым и запрещённым origin, некорректным payload и повторной отправкой.
4. Убедиться, что `service_role`, Resend, OpenAI и другие секреты читаются только из переменных среды функции, не попадают в браузер, ответы или логи.
5. После развёртывания проверить логи функции и только затем отметить синхронизацию выполненной в `docs/PROJECT_STATE.md`.

## Локальные проверки репозитория

```bash
npm run check:secrets
npm ci
npm audit --omit=dev --omit=optional --audit-level=high
npm audit --audit-level=critical
npm run test:security
npm run build
```

GitHub Actions проверяет секреты до запуска install-скриптов зависимостей, затем выполняет `npm ci`, audit runtime-зависимостей, security-тесты и сборку для push в `prototype/pattaya-atelier` и pull request. CI использует только разрешение `contents: read` и не получает deployment- или production-секреты.

Runtime audit блокирует high/critical уязвимости в обязательных production-зависимостях; дополнительный полный audit блокирует critical во всём lockfile. Полный audit всё ещё сообщает high advisory `GHSA-ggr8-5vv4-36mx` для `deepmerge-ts`, который приходит только через dev/optional Prisma CLI. Рекомендованный npm auto-fix откатывает Prisma с 6.19.3 на 6.12.0, поэтому такой downgrade не применяется; Prisma CLI отдельно проверяется командой `prisma validate`, а advisory нужно пересмотреть после выпуска совместимого исправления upstream.

## Этап 2: обязательные проверки

```bash
npm run test:database
npm run typecheck
```

CI запускает эти проверки без подключения к реальной БД. PGlite проверяет SQL/миграции/RLS в одном соединении; конкурентный сценарий проверяется отдельно на demo Supabase: заполнить интервал до 24 единиц, отправить одновременно две заявки по 8; ожидается один успех, один slot_capacity_full. Аналогично проверить два поздних подтверждения истёкших резервов, а затем два одновременных вызова одного request_key (одна запись). QA-заявки отменить, не удалять. Никогда не принимать прохождение однопоточного harness за доказательство конкуренции.

Результат 05.10: матрица structured_order_capacity.sql с rollback прошла локально и в Supabase. Настоящие параллельные транзакции дали ожидаемые результаты. 9 исторических заказов и 18 позиций сохранены; новые QA-записи сохраняют снимки после отмены.

Зависимости 05.10: совместимое обновление serialize-javascript до 7.1.2 устранило найденный XSS advisory. `npm audit --omit=dev --omit=optional --audit-level=high` чист. High остаются в сборочных цепочках braces/micromatch/Tailwind, node-forge/listhen/Nuxt и deepmerge-ts/Prisma. Force-fix предлагает несовместимый откат Nuxt и Prisma либо Tailwind 4; он не применён. Nuxt перенесён в devDependencies по фактическому использованию: Preview содержит только статические файлы и Nginx. Перед использованием build:server/Node production заново пересмотреть эти зависимости; full audit critical остаётся обязательным. Vue typecheck проходит, но upstream Nuxt выдаёт warning о отсутствующем vue-router/volar/sfc-route-blocks; route blocks в проекте не используются.
