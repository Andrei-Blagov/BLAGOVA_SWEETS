# Preview release — 24.10.2026

## Итог и идентичность

Выпуск завершён только на https://preview.blagovasweets.com/ через существующий маршрут GitHub Actions environment preview → OVH и существующий Supabase проект upmmgdshvgyqivfsyqju. Новая инфраструктура и диагностические workflows не создавались.

- Reviewed application: 58209191d20dee16b22a5d2a1a753c36080860ed; tree c6be4aa0ba4489cfbd90633e8339700e9bd41002.
- Previous main: 46c4144a84e7aaedaa97b83fb98e02e5dd843bad; сохранён archive/main-before-preview-20261024.
- Обычный merge [PR №5](https://github.com/Andrei-Blagov/BLAGOVA_SWEETS/pull/5): main/release ee35d6a84c47f8630dab6c4cf4e8981f7825ca04; родители previous main и ровно reviewed application.
- Release tree ecea1b22cef1968fd275a5fdd392d1537ff4be0f отличается от application tree только прежним main manual-only recovery workflow. Ops commit 24d827e и незавершённые ops-изменения не переносились.
- Prototype fast-forward с ожидаемым f6327c3 на этот normal merge. Force/reset не использовались.
- Последующий документационный commit не меняет source/Preview и не запускает повторный deployment; его SHA указан в PR/handoff.

[Integration PR CI 40106589674](https://github.com/Andrei-Blagov/BLAGOVA_SWEETS/actions/runs/40106589674) success, deployment skipped. [Release push CI 40109074274](https://github.com/Andrei-Blagov/BLAGOVA_SWEETS/actions/runs/40109074274) success: реальные PostgreSQL worker/pending/catalog suites, verify и ровно один штатный deployment. Main push не имеет автоматического Preview trigger; dispatch с default deploy для чтения не применялся. Не повторялся failed drill 40101974486.

## Пауза, данные и восстановление

Владелец явно разрешил merge/deploy, отдельно принял риск пропуска restore/rollback drill, затем одобрил конкретный временный write fence. Стандартного application maintenance switch не найдено.

Существующий worker Cron job 1 приостановлен атомарно с установкой закрытой trigger function и 35 BEFORE STATEMENT guards: 33 public/private application tables и storage.objects/storage.buckets. Ещё два guards добавлены новым private intent tables. Проверялся session_user, чтобы SECURITY DEFINER RPC не обходил паузу; maintenance postgres оставался доступен. Существующие Auth/grants/RLS/default privileges не переписывались ради паузы.

Перед паузой unfinished attempts/processing check = 0; ранее полный queue inventory имел только terminal/manual statuses. После замечания владельца проверен именно полный перечень statuses/leases: sending/processing, active lease, unfinished attempts и active API transactions = 0. Простое ожидание не выдаётся за очистку sending.

Возможность DROP обоих Storage guards подтверждена реальным DROP в транзакции с ROLLBACK текущей ролью: оба восстановлены. Одного TRIGGER privilege для этого утверждения не использовали; membership владельца Storage отсутствовало. Фактическое окончательное удаление всех guards позднее также прошло.

Pause подтверждена 15:40:04 UTC. Fresh private snapshot снят 15:43:30 UTC, после 206 секунд, одним согласованным SQL snapshot при закрытых writers/paused Cron. Повторная проверка не обнаружила leases, unfinished attempts или active API transactions. Public availability через service-backed Edge в паузе отказала.

Приватная копия содержит 33 application tables, 74 прежних RPC/function definitions, columns/constraints/indexes/triggers/RLS/ACL/default privileges/enums/sequences/migration history и Storage metadata; временные guard definitions исключены. Полнота JSON/архива и контрольные суммы проверены. Все шесть прежних hosted Edge bundles (11 source files), включая отличающийся storefront-order v12, и фактические JWT options сохранены приватно. Env values не выводились и deployment их не менял. Raw data/контакты/receipt capabilities/секреты/backup links в публичный git не добавлялись.

Прежние frontend image/config сохранены existing deploy script в scoped /opt/blagova-sweets-preview / Compose blagova-sweets-preview, service storefront. Скрипт прошёл healthy/image checks и сохранил предыдущую конфигурационную пару; Docker images не удалялись. Отдельный restore/rollback drill **не выполнялся по решению владельца**. Application snapshot не включает managed Auth rows, Storage bytes или Vault values. Старый snapshot поверх новых принятых записей не восстанавливался.

## Миграции и Edge

Пять application migrations применены исходными reviewed SQL по порядку; source SHA-256 сверены с точным checkout. Hosted migration service назначил свои timestamps:

| Source migration | Hosted history version |
| --- | --- |
| 20261024081356_storefront_pending_intent.sql | 20261024154727 |
| 20261024082529_storefront_initial_outbox.sql | 20261024154751 |
| 20261024084412_storefront_chat_trust_budget.sql | 20261024154944 |
| 20261024090606_atomic_catalog_workspace.sql | 20261024155011 |
| 20261024111725_restrict_chat_sequence_acl.sql | 20261024155017 |

Три отдельные operational history records фиксируют install guard, attachment новых tables и cleanup: preview_release_pause_20261024, preview_release_pause_new_intents_20261024, preview_release_resume_writes_20261024. Это не дополнительные application features/переписывание прежних migrations. По окончании temporary function/37 triggers отсутствуют.

Проверено: новые intent/catalog RPC присутствуют; старый ten-argument chat overload отсутствует, новый six-argument присутствует; anon/authenticated sequence SELECT/UPDATE/USAGE запрещены, service_role USAGE сохранён. Authenticated browser DML products запрещён, owner aggregate RPC остаётся executable для authenticated с внутренней owner-проверкой. Все восемь published products проходят текущий validator. Никакого backfill initial notifications старых заказов не выполнялось.

| Edge | Hosted version | verify_jwt |
| --- | --- | --- |
| storefront-order | 13 | false |
| storefront-chat | 6 | false |
| confirm-order | 4 | false |
| storefront-availability | 4 | false |
| order-change | 3 | true |
| notification-worker | 2 | false |

Все hosted source/shared imports после deployment получены и совпали с reviewed checkout. JWT options сохранены фактическими; env/credentials/Vault/worker URL/token не заменялись.

Две ранее отдельно разрешённые demo карточки custom-gift/celebration-set получили нейтральные descriptions RU/EN/TH без характеристик/гарантий; published/is_demo сохранены, catalog_version 1→2, два audit события. Цены/варианты/профили не менялись. Thai остаётся черновым переводом до проверки носителем.

## Проверки

Чистая установка lockfile + штатный postinstall/DevTools adapter; 122/122 security tests, 26 migrations/4 SQL suites, typecheck (прежний upstream route-block warning), static build 32 routes, release manifest, source и built scanners прошли локально. Эти gates повторно прошли в integration/release CI. Runtime audit 0; full **9 high / 6 moderate / 0 critical** в известных dev/transitive цепочках. Пороги не ослаблялись.

Deployment server log: healthy release ee35d6a84c47f8630dab6c4cf4e8981f7825ca04, 15:57:40 UTC. Независимые /health 200/ok, HTTPS, X-Robots-Tag, meta robots, robots.txt Disallow: /; десять маршрутов HTTP 200, включая menu/cart/checkout/login/admin/product fallback. Все **42 JS/CSS** совпали с проверенной локальной сборкой по SHA-256. Public HTML /admin=200 само по себе не доказывает staff authorization.

Пять browser Edge OPTIONS=204 с правильным Preview origin; confirm/order-change/worker без staff/scheduler credentials =401. Никакого real provider или paid AI smoke.

После совместимого frontend/backend temporary guards удалены. Через настоящий hosted HTTP API прошли **20** bounded checks:
- cart-aware availability;
- создание одного demo pending order BLG-10412D97, 1 cake / 1450 ฿ / load 8, snapshot и expiry;
- тот же submit даёт duplicate без второй записи/initial notifications;
- resolve возвращает сохранённый receipt; изменённый состав на том же intent даёт 409, неверный capability —404;
- close-fence неотправленного intent и отказ позднего submit;
- start/send/replay/handoff RU/EN/TH; server-owned policy/source и отсутствие двойного ответа;
- forged assistant field отклонён 400.

Существующий worker вызван обычным dedicated-credential route, без экспорта токена: HTTP200, два initial events order_received_customer/order_received_manager обработаны simulated по одной попытке, provider ID/sent_at NULL. Затем QA order отменён через native staff_change_order: cancelled/revision2/expiry NULL, frozen item и 2 events сохранены. Три собственных QA thread возвращены из requested в bot через staff_conversation_action; сообщения не удалялись. Эти staff RPC выполнялись в maintenance SQL с явно заданным локальным контекстом существующего owner, без изменения Auth/roles; это **не browser login/UI acceptance**.

Отмена обработана worker HTTP200 как simulated, одна attempt, provider ID/sent_at NULL. Cron возвращён active с прежним */2, command/URL/token не менялись. Итог 16:10:17 UTC: временных guards/function 0, queued/failed/sending=0, unfinished attempts=0, SQL auth context сброшен. Последующая availability целевого QA date показывает 0/32 и свободные интервалы; health снова 200/ok/noindex.

Сравнение до/после application migrations: все 33 старых datasets совпали после исключения только новых schema-default columns. После smoke/cleanup исходные записи 15 business relations (87 orders, items/events/notes, deliveries/attempts, messages/conversations/customers, integration jobs, variants/profiles/images/rules) также совпали по canonical hashes. Storage bucket/object metadata совпали; 1 bucket/6 objects. Новые QA и согласованные builder descriptions учитываются отдельно. Rate-limit housekeeping является частью уже reviewed application и не выдаётся за неизменность всех operational counters после smoke.

## Границы и следующий этап

Выпуск завершён на существующем Preview. Production-домен/другие OVH приложения/платежи/настоящая почта/платный AI не включались. Новый полный аудит и новая инфраструктура не начинались. Staff UI в настоящих owner/manager browser sessions заново не проходился; проверены HTTP API/SQL/native RPC и опубликованные bytes/routes. Real-provider/idempotency acceptance и post-claim delivery policy не заменяются simulated проверкой. Recovery drill сознательно пропущен; ограничения Auth/Storage backup сохранены.

Этап 4 — опубликованная база знаний, retrieval/RAG и оценка качества — этим выпуском не разрабатывался. Старые preflight NO-GO в source documentation являются историей и заменены этим фактическим итогом, а не переписаны как якобы выполненный прежний deployment.
