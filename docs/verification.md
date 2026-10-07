# Проверка миграций и Edge Functions

Эта процедура обязательна для изменений схемы Supabase и Edge Functions. Она не развёртывает production и не раскрывает ключи.

## Актуальный статус — 07.10.2026, восстановление CI и дополнение приёмки

Shell-quote обновлён в единственной записи lockfile: 1.10.0 → 1.12.0 (текущий npm stable/latest; advisory исправлен начиная с 1.11.0). Launch-editor 2.14.1 допускает его через ^1.8.4; дополнительного override нет. Package.json, Nuxt/Vue, simple-git 4.0.2, argv-parser 2.0.1, args-pathspec 1.0.4, source-map-js 1.2.2 и защищённый DevTools adapter сохранены. Полный отчёт: [dependency-ci-20261007.md](dependency-ci-20261007.md). CI и новый Preview пока ожидают проверки; предыдущий здоровый release f61632b сохранён.

**CSV принят** по переданному подтверждению координационного чата 07.10: два фактически скачанных владельцем файла, те же 29 уникальных отменённых demo-заказов, 13/16 колонок, owner opt-in, совпадение общих полей, UTF-8 BOM/CRLF/quoting/защита формул и отсутствие внутренних заметок. Имена файлов, SHA-256 и пределы атрибуции — в датированном дополнении [acceptance-20261007.md](acceptance-20261007.md). В этом блоке исходные CSV не читались и повторно не скачивались; контакты/снимки не публикуются.

**Конкуренция worker/заметок принята:** два исходных PostgreSQL 16.15 прогона по 12 сценариев/16 доказанных перекрытий на тестовом SHA 382566598f3290f9962e93344ab246ed9fefba81. Исторический отчёт и JSON evidence сохранены без переписывания. Real-provider acceptance остаётся до production: использовался mock. Post-claim отмена может оставить замороженное сообщение для передачи provider; это открытый предел, не найденный дефект конкурентности.

**Открыт staff UI начавшегося интервала:** собственная новая пара demo-заявок, естественное начало интервала, отказ подтверждения/оценки через формы. Серверный запрет проверен; UI здесь не выполнялся. Этапы 2/3 полностью не закрыты, этап 4 не начат.

## Актуальная конкурентная приёмка — 07.10

[Отчёт и пределы доказательства](concurrency-acceptance-20261007.md): настоящий PostgreSQL 16.15 в изолированных GitHub Actions services, 21 неизменённая миграция, независимые backend PID, удерживаемые TX, pg_locks/pg_blocking_pids и NOWAIT. В каждом из двух окончательных PG jobs прошли 12 сценариев и 16 барьеров: SKIP LOCKED, CAS/completion, crash/reclaim, retry без дублей, idempotent/conflicting/distinct notes и оба порядка notes/change. Два исходных worker handleRequest используют реальные RPC через локальный transport bridge и только mock provider; стабильные ключ/body hash подтверждены. Реальная почтовая доставка/PostgREST/Cron не принимаются. Гонка после claim до provider воспроизведена: замороженное сообщение достигает mock после отмены; это прежний документированный предел. Конкурентных дефектов не найдено, application/RLS/RPC/migrations не менялись.

Исторический результат исходного конкурентного блока: remote 4996ca8d; тестовый HEAD 382566598f3290f9962e93344ab246ed9fefba81; Preview остаётся f61632b (HTTPS/health/noindex и два asset hash подтверждены). Push 37571548021 и PR 37571552272: postgres-concurrency success, общий CI failure из-за нового critical shell-quote 1.10.0 / GHSA-pqg4-j6r4-53mv. Runtime audit 0; full 4 moderate/16 high/1 critical. Audit gate, scoped Git override, DevTools adapter и lockfile не менялись. Этот исходный failure устранён последующим dependency-блоком, см. актуальный статус выше. Для test-only push marker [no-preview] пропускает только deployment; verify зависит от PG job.

В каждом прогоне 22 собственных synthetic заказа отменены штатным API; active/reservations=0, 6 notes/27 attempts/83 order events и полный synthetic audit сохранены в двух JSON в git. Все соединения и backends закрыты, собственные DB/roles и CI services/networks удалены. Рабочие Supabase/Auth/worker/Cron/Vault/чужие данные не затронуты, live фикстур нет. Конкурентный блок пройден. CSV позднее принят координационным чатом (см. дополнение); staff UI прошлого остаётся открытым. Новый critical audit устранён отдельным dependency-блоком; фактические новые CI/deployment фиксируются выше. UI/CSV, этап 4, production и реальные письма/платежи в этом блоке не выполнялись.

## История UI/CSV-приёмки 07.10 до координационного подтверждения

Источник текущего результата — [acceptance-20261007.md](acceptance-20261007.md). Код/Preview f61632b, push 37481561506 и PR 37481569799 успешны; опубликованные entry и staff/CSV assets побайтово совпали с новой локальной сборкой. Публичный полный интервал и реальные chat central/jomtien → staff-карточки пройдены. Staff-формы прошлого не приняты: безопасный rollback SQL отдельно подтвердил атомарность. Подготовка CSV 29 заказов на двух страницах прошла; реальный download заблокирован retained_data_restricted/reset runtime, файла нет, owner opt-in UI не проверен. Серверная privacy новой выборки подтверждена отдельно.

Все 29 новых собственных demo-заявок отменены staff_change_order; резервы/нагрузка 0, снимки/аудит сохранены. Старые 32 остаются отменёнными. Rules v5, guard O, Cron active */2; права и приложение не менялись. npm ci/build и 7 существующих прицельных регрессий passed. Для документации новый deployment не выполняется. Доказательства скачанного файла и staff-форм до закрытия этапа 2/CSV обязательны; конкуренция worker/заметок не входит в эту сессию.

## История приёмки на 06.10.2026

Для статуса использовать docs/acceptance-20261006.md, docs/dependency-ci-20261006.md и текущий раздел PROJECT_STATE.md. Исходные push/PR для `565fae6` остановились на critical audit. Новый fix закрепляет стабильный DevTools 3.4.2, обновляет только simple-git 4.0.2/argv-parser 2.0.1/args-pathspec 1.0.4 и адаптирует один несовместимый import до nuxt prepare. Оба audit gate сохранены: runtime 0 vulnerabilities; full 4 moderate, 16 high, 0 critical. Чистый npm ci, 55 security/regression tests, 21 миграция и четыре SQL-набора прошли локально, typecheck exit=0 с прежним upstream warning. Фактическое прохождение push/PR CI и новый deployment проверяются отдельно и отражаются в PR №1; ранние success относятся только к своим SHA. Календарь 32/32 принят в owner UI; live SQL повторил заполнение, атомарные отказы прошлого, три зоны и CSV/privacy под authenticated manager/owner. Все 32 собственные фикстуры отменены штатным API; ресурс освобождён, guard и Cron включены.

Manager self-claim/release, запрет чужого назначения/contact opt-in, оценка и подтверждение, owner UI retry и заметка уже приняты 05.10. Ранние записи об отсутствии staff-сессии сохранены как история.

Browser download 06.10 не дал файла: после native credential delivery среда заблокировала дальнейшую работу (`retained_data_restricted`, затем `native credential state cannot be safely resumed`). Открытый CSV из отдельной серверной выборки подтверждает содержимое/формат, но не получение через ссылку UI. Публичный выбор полного интервала, сквозной chat → staff-карточка и staff-формы прошлого остаются UI-пунктами. Конкурентную проверку worker/заметок выполнять отдельно, без остановки постоянного Cron.

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
npm run test:database
npm run typecheck
npm run build
```

GitHub Actions проверяет секреты до запуска install-скриптов зависимостей, затем выполняет `npm ci`, audit runtime-зависимостей, security-тесты и сборку для push в `prototype/pattaya-atelier` и pull request. CI использует только разрешение `contents: read` и не получает deployment- или production-секреты в verify. Отдельный job `Deploy verified preview` получает только environment `preview`, запускается после успешного verify на push рабочей ветки и не выполняет миграции.

Runtime audit блокирует high/critical уязвимости в обязательных production-зависимостях; дополнительный полный audit блокирует critical во всём lockfile. Полный audit всё ещё сообщает high advisory `GHSA-ggr8-5vv4-36mx` для `deepmerge-ts`, который приходит только через dev/optional Prisma CLI. Рекомендованный npm auto-fix откатывает Prisma с 6.19.3 на 6.12.0, поэтому такой downgrade не применяется; Prisma CLI отдельно проверяется командой `prisma validate`, а advisory нужно пересмотреть после выпуска совместимого исправления upstream.

## Этап 2: обязательные проверки

```bash
npm run test:database
npm run typecheck
```

CI запускает эти проверки без подключения к реальной БД. PGlite проверяет SQL/миграции/RLS в одном соединении; конкурентный сценарий проверяется отдельно на demo Supabase: заполнить интервал до 24 единиц, отправить одновременно две заявки по 8; ожидается один успех, один slot_capacity_full. Аналогично проверить два поздних подтверждения истёкших резервов, а затем два одновременных вызова одного request_key (одна запись). QA-заявки отменить, не удалять. Никогда не принимать прохождение однопоточного harness за доказательство конкуренции.

Результат 05.10: матрица structured_order_capacity.sql с rollback прошла локально и в Supabase. Настоящие параллельные транзакции дали ожидаемые результаты. 9 исторических заказов и 18 позиций сохранены; новые QA-записи сохраняют снимки после отмены.

Зависимости 05.10: совместимое обновление serialize-javascript до 7.1.2 устранило найденный XSS advisory. `npm audit --omit=dev --omit=optional --audit-level=high` чист. High остаются в сборочных цепочках braces/micromatch/Tailwind, node-forge/listhen/Nuxt и deepmerge-ts/Prisma. Force-fix предлагает несовместимый откат Nuxt и Prisma либо Tailwind 4; он не применён. Nuxt перенесён в devDependencies по фактическому использованию: Preview содержит только статические файлы и Nginx. Перед использованием build:server/Node production заново пересмотреть эти зависимости; full audit critical остаётся обязательным. Vue typecheck проходит, но upstream Nuxt выдаёт warning о отсутствующем vue-router/volar/sfc-route-blocks; route blocks в проекте не используются.

Live Preview и CI 05.10: push-run `37302558650` успешно проверил и опубликовал `a852791`; PR-run `37302565344` прошёл verify. Проверены OPTIONS всех пяти функций (204 без тела), legacy date-only availability, корзины из 4/5 тортов и подарок. Браузер: 5 тортов не помещаются; checkout торт + 6 капкейков сохранил `BLG-43CCD91D` (14 единиц, 204000 сатангов, 60 минут), чат сохранил `BLG-4DC57ABB` (8 единиц, 145000 сатангов) и обновлял доступность при смене количества. Оба заказа demo, после проверки отменены без удаления снимков. Owner/manager UI новой версии ещё требует ручной приёмки: проверочный браузер показал вход, активной staff-сессии нет; SQL-права и typecheck прошли.

## Регрессии ручной приёмки этапа 2

`tests/security/stage2-acceptance.test.mjs` исполняет реальные Vue scripts с изолированными API: все три зоны, серверная сумма при устаревшей цене каталога, ошибка прошедшего интервала и SSR полного календаря. `supabase/tests/stage2_acceptance.sql` проверяет запрет оценки/продления/подтверждения прошлого, атомарный отказ, сохранность исторических операций и перенос в будущее. Временное отключение trigger используется только для собственных исторических фикстур и возвращается до RPC; весь сценарий завершается rollback. Тест выполняется вторым в `npm run test:database`; также прошёл в demo Supabase.

Новая миграция создана CLI и применена через API; local filename `20261005144844`, remote version `20261005145406`. CLI `migration list --local` требует отдельного локального PostgreSQL, которого в этой среде нет. PGlite применил все 19 миграций. Security Advisor после изменения не выявил новых замечаний. Две попытки параллельного lock-wait сценария через connector не дали перекрытия транзакций; успешной проверкой конкуренции их не считать. Предыдущие реальные проверки вместимости этапа 2 сохраняются, порядок блокировок не изменён.

## Этап 3: первый операционный блок

`npm run test:database` включает `staff_order_workspace.sql`: 131 временная заявка, >100 результатов, стабильные страницы, общие метрики, полнотекстовое сочетание имени и состава, номер/источник/получение/дату, независимые детали, снимки/серверную цену, заметки/повторы/stale revision и реальный SQL role authenticated/anon. Выполнять только с итоговым rollback; QA-данные не оставлять. Сценарий прошёл в PGlite и настоящем Supabase. Отозванный сотрудник сразу теряет доступ к заметкам, проекции и RPC. Публичные read RPC являются SECURITY INVOKER; private write RPC проверяет активное staff-членство, блокирует заказ и проверяет revision. Новая проекция имеет RLS/grants и обновляется trigger в той же транзакции.

`staff-workspace.test.mjs` исполняет Vue scripts: серверные фильтры/метрики, карточка между страницами, поздние ответы, сохранение текста заметки при конфликте и request ID при сетевом повторе. История строится только по сохранённым revision, не текущему каталогу. Новые concurrent note calls отдельно не подтверждены; проверка блокировки и последовательный retry не подменяют несколько соединений. Preview UI требует визуальной приёмки owner/manager. Новых production-интеграций или Edge Function изменений нет.

## Stage 3 operations

Run `npm run test:security`, `npm run test:database`, `npm run typecheck`, `npm run build`, tracked/built secret scanners. The database harness now runs 21 application migrations and four SQL suites. `supabase/tests/staff_operations.sql` tests 105 temporary orders and role fixtures in a rollback transaction; also execute it against demo Supabase after the migration. Platform setup in `supabase/ops/install_notification_schedule.sql` is separate from portable application migrations.

Read-only live checks: job active on */2, HTTP response 200 (Cron success alone is insufficient), healthy worker counters, status/attempt history without secrets. Browser OPTIONS/unauthenticated POST and worker missing-token tests must reject unauthorised actions. Provider retries are mocked; demo worker is verified without emailing anyone. The two connector claim requests on 05.10 did not overlap; the attempted additional Cron concurrency test was auto-review rejected and was not executed. Do not label serial SQL/PGlite as multi-connection proof.

Manual acceptance: owner assignment/revision/history, manager self-claim/release and inability to steal; applied-filter CSV covering more than one page, manager exclusion of customer details, owner contact opt-in; confirmation/change saved even if mail fails; delivery retry requeues existing ID without changing order revision; stale messages/manual-review states; scheduler crash/reclaim/CAS in an isolated concurrency setup. Repeat the three stage 2 fixes separately. Production mail remains disabled.

## Staff access timeout

`staff-auth.test.mjs` executes the actual identity reader and composable: active allowed staff role only, Auth/membership timeout, AbortSignal, no late staff lookup after expired Auth, no stale identity after a newer check or sign-out. The entire verification has a 20-second deadline; a timeout fails closed and the admin gate offers retry. Public catalog uses a separate non-persistent storage key; staff session storage remains unchanged. A duplicate-client warning was observed with the old build, but it is not proof of the stalled request cause. At the staff-access fix: 51 security/regression tests; current total is 53. Recheck fresh load, expired session and owner/manager forms after Preview deployment.

`order-export.test.mjs` checks explicit-download file lifetime and revocation when filters change or the component unmounts. Late responses after owner permission/filter changes cannot publish a contacts-bearing blob. CSV preparation reports readiness and exposes a persistent download link instead of asserting that a detached synthetic click saved a file. Current total: 53 tests. Browser download still requires actual staff login and opening the exported CSV.
