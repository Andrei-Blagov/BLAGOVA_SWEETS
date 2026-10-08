# Конкурентная приёмка worker и внутренних заметок — 07.10.2026

Исходный remote HEAD: 4996ca8d0e6ef7b232baaaa7f093d60ea2962cf2.
Код приложения и последний опубликованный Preview: f61632b3974bba2385ed0f9f536ed37842eacf8e.
Тестовый HEAD: 382566598f3290f9962e93344ab246ed9fefba81.
Документационный итоговый SHA указан в PR/handoff; он не является новым Preview release.

На старте remote/PR/чистое дерево сверены, подготовлен отдельный checkout.
Прочитаны AGENTS, PROJECT_STATE, ROADMAP, CURSOR_HANDOFF, verification,
email-notifications, acceptance-20261007, dependency-ci-20261006, PR,
фактические миграции/RPC, SQL suites и notification-worker/регрессии.
UI/CSV, этап 4 и production-подготовка в этом блоке не выполнялись.

## Среда и границы

Настоящий PostgreSQL 16.15, официальный Docker image с закреплённым digest
65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65,
в отдельном service GitHub Actions на временном ubuntu runner.
Host port привязан к 127.0.0.1. БД со случайным именем создана только для
этого запуска; вначале проверено отсутствие Supabase roles.
READ COMMITTED, psycopg 3.3.6, Node 24.

В локальной Work-среде нет Docker/готового PostgreSQL, UID namespace содержит
только UID 0, а штатный PostgreSQL требует non-root. Поэтому выбран безопасный
изолированный CI service. Root guard PostgreSQL не обходился.

Все 21 application migration применены без переписывания/трансформации.
Использованы совместимые auth.uid/users, roles и storage scaffolds; pgcrypto
настоящий. Для authorize_notification_worker создан только локальный synthetic
Vault read interface с вымышленным credential. Supabase Auth, PostgREST/gateway,
hosted Vault/Cron/pg_net и настоящий provider не являются частью доказательства.
Четыре старых SQL suites также прошли на PostgreSQL, но их последовательное
исполнение отделено от конкурентной приёмки.

Сценарий: tests/concurrency/postgres_acceptance.py.
Он использует независимые backend connections, удерживает первую транзакцию,
наблюдает pg_stat_activity/pg_locks/pg_blocking_pids второй и только затем
разрешает commit. Клиентские timestamps не считаются доказательством.
Ожидание ограничено readiness/lock barriers и statement_timeout; произвольных
длинных sleep нет. Воспроизведение: tests/concurrency/README.md.

## Результаты

**Пройдено:** 12 сценариев и 16 наблюдений перекрытия в каждом из двух
окончательных CI jobs. Push выполнял точный 3825665; PR использовал merge SHA
6be7568b25874b619bc322ffad6f0d6a50758c5e для того же head. Сохранены исходные
JSON без редактирования: [push evidence](concurrency-evidence-20261007-push.json)
и [PR evidence](concurrency-evidence-20261007-pr.json), включая SHA-256 всех
применённых миграций и полный synthetic audit.

Примеры фактических барьеров из окончательного push:

| Барьер | Backend holder / waiter | Наблюдение до commit |
| --- | --- | --- |
| SQL claim | 130 / 131 | Оба idle in transaction, XID 788 / 789; непересекающиеся IDs, четыре NOWAIT отказа 55P03. |
| Два полных worker handlers | 182 / 183 | Оба claim TX открыты с собственными XID; batches 5+5 без пересечений до освобождения barrier. |
| Одинаковая заметка | 158 / 159 | 158 idle in transaction; 159 active, Lock/transactionid, blocking_pids=[158], ShareLock granted=false. |
| Изменение раньше stale заметки | 168 / 169 | 168 idle in transaction; 169 active, Lock/transactionid, blocking_pids=[168]; после commit — 40001. |

SHA-256 исходных JSON: push
0b88c131af29dc197ac499797afcb0f020fdcdbcb11bd3e7ebee0ad223c3ee54,
PR b4b515ec3fb2760f088bd702c1cee3787926bef12087d6c9c063f43def0846ff.

| Сценарий | Результат и точный контракт |
| --- | --- |
| Параллельный claim | Два открытых backend TX получают непересекающиеся batches; удерживаемые rows первого пропущены вторым через фактический SKIP LOCKED. Охвачены confirmation и change. NOWAIT отдельного monitor даёт 55P03 для всех четырёх захваченных rows. По одной attempt/audit на claim. |
| Двойной completion | Для каждой из четырёх deliveries второй backend наблюдаемо ждёт первый. После commit результаты true/false; одна попытка завершена, двойного результата нет. |
| Crash/reclaim | Для обеих очередей claim commit, соединение crashed worker закрыто; locked_at собственной изолированной фикстуры сдвинут на 6 минут назад. Reclaim даёт attempt=2 и новый token. Поздний old-token completion ждёт нового владельца и возвращает false; итог simulated, sent_at/provider null. Audit: lease_expired → simulated. |
| Параллельный retry | Для обеих очередей два одинаковых запроса с текущей revision сериализуются на order lock. Оба возвращают pending; delivery остаётся одна, retry_requested audit один. Полная строка заказа, состав, цена, нагрузка, expiry, order_events и integration jobs неизменны. |
| Одинаковые note IDs | Два запроса одного автора/заказа/текста возвращают один UUID. Одна append-only заметка с actor/revision/time; отдельного order_event для заметки по действующей схеме нет. Полный business snapshot неизменен. |
| Конфликт содержимого/автора | После наблюдаемого ожидания второй запрос получает P0001 order_note_id_conflict. Первый body/actor не перезаписаны. |
| Разные note IDs | Обе независимые заметки сохраняются на той же действительной revision. Порядок created_at/id соответствует сериализации на order lock; заметка revision не увеличивает. |
| Заметка раньше изменения | Запись заметки удерживает order lock; cancellation ждёт. После commit заметка сохраняет прежнюю revision, только изменение заказа увеличивает revision. |
| Изменение раньше заметки | Cancellation удерживает order lock; новый note request со старой revision ждёт. После commit отклоняется 40001, заметки нет; stale обхода нет. |
| Два полных worker handleRequest | Оригинальный TypeScript worker вызывается одновременно два раза. Transport bridge исполняет authorize/claim/complete через реальные PG connections/RPC. Оба claim TX удержаны до получения batches 5+5. Provider вызовы перехвачены отдельным mock, внешний network запрещён. |
| Provider mock/retry | Из 10 mock вызовов один 429 и девять 200: SQL audit failed=1/sent=9. Реальный staff retry и следующий handler claim завершают ту же delivery: sent=10, retry_requested=1. Idempotency key blagova/kind/delivery_id и SHA-256 точного request body совпадают между попытками. |
| Гонка после claim | После фактического claim заказ штатно отменён и commit завершён до processJob. Замороженное confirmation всё равно достигает mock, completion записывает sent. Cancellation не откатывается. Это ранее документированный предел, а не атомарность PostgreSQL и email. |

Дополнительная бизнес-логика, RLS, staff API, Edge Function и применённые
миграции не менялись: конкурентного дефекта по проверенным сценариям нет.
Provider acceptance означает только mock boundary + реальные RPC и audit.
Реальная провайдерная доставка, серверная HTTP инфраструктура Supabase и
production mail не принимаются этим отчётом. Старые backoff/max5/23h/stale/privacy
сохраняют отдельное SQL/unit покрытие; новые timing claims им не приписываются.

## Проверки и CI

Локально: чистый npm ci, 55 security tests, PGlite 21 миграция/4 suites,
typecheck (exit 0 с прежним upstream warning), build 32 маршрута,
repository scanner и built-assets scanner passed. Новый Python/Node harness
проверен syntax checks; конкурентное выполнение — исключительно реальный CI PG.

Первый test-only HEAD 2ae6696: push 37571234436 и PR 37571239758 остановились
на full critical audit до приёмки. Затем приёмка вынесена в отдельный обязательный
postgres-concurrency job, от которого зависит verify. Ни одна npm audit команда,
threshold или permission не ослаблена.

Окончательные [push CI 37571548021](https://github.com/Andrei-Blagov/BLAGOVA_SWEETS/actions/runs/37571548021)
и [PR CI 37571552272](https://github.com/Andrei-Blagov/BLAGOVA_SWEETS/actions/runs/37571552272):
postgres-concurrency **success**, verify **failure** только на неизменённом
full critical audit; последующие npm test/typecheck/build steps в этих CI
skipped, их результаты выше относятся к локальному запуску.
Deployment/audit-VPS/restart skipped. Предыдущий 58ba4e6 также прошёл оба PG
jobs, но целые runs 37571380338/37571386317 были failure на том же audit.
Artifacts окончательных jobs: 11460454793 и 11461340478, retention 14 дней;
копии JSON в git сохраняют доказательства после expiry.

**Новый внешний blocker:** runtime audit = 0, полный audit теперь
4 moderate / 16 high / 1 critical. Существующий shell-quote 1.10.0
в Nuxt → DevTools → launch-editor помечен GHSA-pqg4-j6r4-53mv; advisory добавлен
в GitHub DB 06.10, исправленная версия 1.11.0.
[Первичный advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv).
Это не новая установленная зависимость тестового harness.
Package/lockfile, scoped Git override и DevTools adapter не менялись.
Исправление зависимости остаётся отдельной постановкой; CI зелёным не объявляется.

Для test/doc-only push добавлен marker [no-preview], отключающий только
автоматический deployment. Verify/PR CI не отключаются. Обычные application
push и явный workflow_dispatch deploy сохраняют прежний verified path.
Никакого повторного Preview deployment для этих тестов не было.
Независимый HTTPS /health: 200, ok, X-Robots-Tag noindex.
Entry DMc1FfJu.js (332770 bytes, SHA-256
a069592aace9844ae2ab91d74434bd68b0ba402e0eddb424014a28483105f3b8)
и staff DJbSMP5f.js (89503 bytes, SHA-256
9b3c0b0e11b307b7e22a62579c4a773fc68f919ee3788e13ae045250deb39abe)
совпадают с проверенным release f61632b и acceptance-20261007.

## Очистка и остаток

Каждый прогон сохранил 22 собственных synthetic заказа; перед удалением
изолированной БД все отменены штатным staff_change_order.
Активных заказов/резервов 0. До удаления сохранены 6 заметок,
27 attempts и 83 order events; финальные JSON дополнительно содержат сами
synthetic orders/items/notes/events/attempts.
Соединения закрыты, PG backends проверены, собственная БД/roles удалены;
runner удаляет service container и его сеть. JSON остаётся в git и CI artifacts.

Рабочая demo-БД upmmgdshvgyqivfsyqju, её Auth/worker/Cron/Vault и чужие данные
не менялись и для этих тестов не использовались. Новых live demo-фикстур нет,
реальных писем/платежей нет. Main/production не изменены; PR остаётся Draft.

Этот конкурентный блок пройден отдельно по двум успешным PG jobs/evidence.
Этап 3 целиком не закрыт: staff UI отказа прошлого и два реально скачанных CSV
по acceptance-20261007 остаются за пределами этой задачи. Новый critical audit
также требует отдельного решения координационного чата. Этап 4 не начинался.
