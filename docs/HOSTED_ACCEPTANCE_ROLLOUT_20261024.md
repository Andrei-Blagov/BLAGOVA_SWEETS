# Hosted acceptance и совместимый rollout — 24.10.2026

## Объект и разрешённая граница

Code SHA: `59c5b1f685d919f75c77b336cdd527d9ee946949`.
[Независимый Linux aggregate](INDEPENDENT_LINUX_CHECKPOINT_20261024.md) PASS.
Documentation follow-up имеет собственный commit; app/backend/lockfile не меняются.
Точный новый HEAD сверяется по diff перед любой публикацией.

Пользователь разрешил обычные history-preserving merges проверенной версии в main
и deployment на существующий `https://preview.blagovasweets.com` на OVH.
Это demo кондитерской собственного производства с маленькой кофейней.
Коммерческие домены, другие OVH проекты, платежи, реальные письма и knowledge
не входят в rollout. Никакого force push/reset или удаления данных.
GitHub repository PUBLIC: raw backup/evidence/customer rows/secrets и
непроверенные персональные assets не должны попадать в него.

## Текущее решение: NO-GO для переключения

Linux и limited review gates пройдены. Пока не доказаны external publishers,
live source/schema parity, backup/restore и hosted интеграции; content preflight
нашёл две неполные published карточки. Авторизация merge/deploy сохраняется,
но не заменяет проверки и не разрешает обход отказа.

### Read-only live preflight, 24.10.2026 10:50 UTC

Проект `upmmgdshvgyqivfsyqju`, BLAGOVA_SWEETS_Frankfurt, ACTIVE_HEALTHY,
Postgres 17.6.1.166. Metadata: 21 migration history records; local application
migrations 25. Числа **не являются разницей в четыре применённых файла**:
live timestamps местами другие, live schedule installer записан отдельно,
локальный storefront_chat имеет другую историю. Запрещено вслепую прогонять
все 25 файлов или переписывать migration history для совпадения count.

Live RPC metadata показывает старую `storefront_chat_action` с десятью
параметрами, включая assistant body/source. Новых submit/resolve intent,
save_catalog_product/save_catalog_setting и bind_receipt_delivery в проверенном
списке нет. Это подтверждает несовместимость, а не полную проверку схемы.

Edge metadata ACTIVE: storefront-order v12, storefront-chat v5, confirm-order v3,
storefront-availability v3, order-change v2, notification-worker v1.
Source parity этих deployment не проверена по одному version number/hash bundle.
verify_jwt metadata сохраняются: order-change true, остальные false.
Не включать/выключать JWT verification, credentials или CORS ради rollout.

SELECT по двум demo builders вернул только статусы/счётчики/флаги, без customer
data и содержимого описаний:

| Поле | celebration-set | custom-gift |
|---|---|---|
| status / is_demo | published / true | published / true |
| Missing description languages | ru, en, th | ru, en, th |
| Missing name languages | нет | нет |
| Active category / variants | true / 1 | true / 1 |
| Active variant/option translation gaps | 0 / 0 | 0 / 0 |
| product_images / primary metadata | 0 / 0 | 0 / 0 |
| Legacy image_path present | true | true |
| Missing referenced Storage metadata | 0 | 0 |
| Product profile basic shape | valid | valid |

Ноль missing Storage metadata при отсутствии image rows не доказывает наличие
или доступность фото. Legacy image_path допускается A4 validator, HTTP/alt/
внешняя доступность этим SELECT не проверялись. Category translations, все
опции/профили и весь published каталог этим узким запросом не сертифицированы.

Новые описания не сочинялись; live content/status/цены не изменялись. A4 не
переписывает grandfathered rows при установке, но отклонит последующее
сохранение неполной published карточки и связанные category edits.
До полной catalog acceptance нужно решение владельца: предоставить утверждённые
RU/EN/TH описания либо отдельно разрешить перевод этих карточек в draft.
Временный явно согласованный read-only catalog возможен как ограниченный
fallback; он не считается прохождением owner save/publish acceptance.

## Совместимость компонентов

| Компонент | Новый контракт | Порядок / опасный mixed state |
|---|---|---|
| Pending intake | key + independent token + canonical fingerprint; saved receipt и 24h TTL | Schema до нового storefront-order; новый frontend требует новых resolve/close. Key не даёт права читать чужой заказ |
| Initial outbox | две atomic receipt rows после сохранения items | Schema и новый notification-worker должны быть готовы до нового intake; старый worker не должен обрабатывать новые receipt events |
| Chat | server-owned body/source, шесть RPC args, budgets | A3 удаляет старый overload. Старый Edge перестанет работать; старый UI assistant fields отклоняются новым Edge |
| Catalog | owner aggregate RPC/CAS вместо direct browser DML | A4 отзывает direct writes; старый admin save несовместим. Не возвращать grants ради старого UI |
| Staff provenance | legacy assistant/system source unverified | Новый staff reader/template обязателен; история не удаляется |
| Frontend | Nuxt static Nginx + новые RPC/Edge | После schema/Edge; stale tabs должны reload, не показывать фиктивный успех |

Изменённые Edge исходники относительно f6327c3: storefront-order, storefront-chat,
notification-worker и shared notificationCopy. confirm-order, order-change,
storefront-availability не требуют замены лишь ради версии; их фактическую
совместимость и source parity всё равно проверить.

## Gates и последовательность

1. **Identity / publishers.** Повторно сверить remote main/prototype/PR #1 и
   отсутствие чужих новых изменений. Сохранить прежний main SHA и достижимую
   archival ref обычным non-force действием перед merge. Проверить CI enabled,
   hooks, Apps, rulesets/environment filters и внешние publishing bindings,
   включая main. Unknown или permission denial = STOP, не отсутствие trigger.
   Sites проект не менять и не публиковать для решения этой задачи.
   Сейчас connector подтвердил существующий Sites v11; source credential null
   не доказывает отсутствие binding. Отдельный reviewer продолжает inventory.
2. **Проверенный integration result.** Локально подготовить normal merge reviewed
   feature → prototype и prototype → main, сопоставить итоговые trees с code SHA
   плюс только documentation follow-up. Конфликты/любой новый app diff требуют
   review и affected checks, нельзя merge unreviewed HEAD. Existing Draft PR #1
   допускается после reconciliation, не автоматически по старому approval.
   Повторить scanner состава staged public tree, проверить intended assets.
3. **Trigger control до push.** ci.yml: push только prototype; PR checks на
   refs/pull/N/merge не допускают Preview jobs; dispatch prototype default=deploy.
   Если prototype обновляется до backend readiness, фактическое merge/head
   commit message должно содержать [no-preview] (PR title/body недостаточно).
   [preview-audit] вызывает SSH audit, [preview-restart] на push выполняется
   после deploy; их не использовать как no-deploy substitute.
   Main push не запускает этот tracked workflow, но external triggers неизвестны.
   Расширять CI push/deploy filters на main не требуется. Любой необходимый
   trigger change сначала отдельным reviewed patch; не выключать security gates
   или внешние Apps молча. Публикация и deployment — разные контролируемые шаги.
4. **Recovery coverage до maintenance.** Зафиксировать фактический Preview image
   digest/source marker, Compose/config pair, previous artifact и свободное
   место; приватно сохранить действующие Edge sources и non-secret deployment
   options. Проверить backup schema+data+roles/grants/RLS/functions/sequences,
   включая private intents/outbox и references; Auth, Storage metadata и bytes,
   Cron/Vault/config требуют отдельного покрытия. Data dump не заменяет blob
   backup, source repo не заменяет backup данных/настроек.
   Backup хранить вне git/Library public artifacts с ограниченным доступом;
   секретные значения не выводить. Проверить restore в isolated disposable
   target без endpoints/providers и без изменения live. Нет подтверждённого
   backup/restore либо нужен платный ресурс/новый доступ = STOP и точный blocker.
   A1 mocked Docker PASS не заменяет OVH restore drill.
5. **Maintenance и in-flight fence.** До несовместимых контрактов согласовать
   короткое demo maintenance окно: остановить новые checkout/chat/admin writes
   на ingress без изменения постоянных security controls; простого UI hiding
   недостаточно против старых вкладок. Дать активным операциям завершиться,
   дождаться отсутствия активных leases/in-flight DB writes. Просмотреть только
   aggregate queue counts/is_demo flags и send gates, без контактов/payload.
   Не давать старому cron/worker захватить новые receipt events между шагами.
   Предпочесть проверенный временный worker/cron maintenance control; если
   имеющихся средств нет, сначала reviewed bounded control, не выдумывать его.
   Изменения Cron/Vault/token за пределами такого окна отдельно согласовать.
6. **Schema.** После structural baseline diff и content решения применить только
   reviewed новые migrations в порядке:
   20261024081356 storefront_pending_intent;
   20261024082529 storefront_initial_outbox;
   20261024084412 storefront_chat_trust_budget;
   20261024090606 atomic_catalog_workspace.
   Сначала репетиция на восстановленной isolated схеме, затем controlled live
   application с transaction/error handling. Не считать весь набор атомарным:
   отдельно фиксировать успешно применённые steps; первая ошибка = STOP.
   Exact migration source hashes сверить с manifest, не mark-applied вслепую.
   Functional ACL delta: service-only submit/resolve/bind/chat RPCs; owner-only
   aggregate RPCs; revoke browser DML семи catalog tables и old primary-image RPC.
   Это часть reviewed приложения, не выдача новых внешних ролей. Любое иное
   расширение постоянных прав требует точного отдельного решения.
7. **Edge → frontend.** Сначала совместимый notification-worker + shared copy,
   storefront-order, storefront-chat из одного code SHA, с прежними verified
   routing/JWT/CORS settings; RPC/OPTIONS/negative smoke до открытия writes.
   Не включать NOTIFICATION_SEND_ENABLED, не запускать real provider. Отсутствие
   доказанного disabled gate/безопасности очереди блокирует worker resume.
   Затем собрать/развернуть immutable static artifact на существующий OVH Preview
   через A1 scripts с сохранением previous pair, health/image marker проверки.
   Record actual source SHA/artifact digest/Edge versions/schema applied history;
   установленный код не считать verified до smoke. Принудительные reset не нужны.
8. **Acceptance и reopen.** Проверить матрицу ниже только на synthetic demo
   entities. Сначала auth/readonly/gates, затем bounded writes и worker simulate.
   Reopen после всех обязательных passes; наблюдать queue/recovery aggregates.
   Failed обязательный gate = maintenance/fallback и recovery, не silent success.
   Не удалять реальные файлы/историю и не backfill старые initial notifications.

## Hosted acceptance: критерии и границы

| Область | Обязательный наблюдаемый результат |
|---|---|
| Deploy identity | Фактический Nginx artifact/image и marker соответствуют source; HTTPS/health 200; noindex header/meta/robots, 32 intended routes; API guard, отсутствие secrets в bytes |
| Roles/Auth/PostgREST | Existing owner может catalog CAS; manager/anon/outsider получают запрет записи; manager сохраняет разрешённую работу orders/chat; session refresh/stale tab не обходят роли |
| Intake | Canonical saved date/cart/price; reload recovery; same intent retry без дубля; changed payload conflict; TTL/close очищают capability. Timeout-after-commit через bounded client response interception, не через live нагрузку |
| Capacity/status | Bounded два синтетических competing requests не overbook; request не равен confirmed; staff transitions сохраняют snapshots и revision conflict |
| Outbox | Одна запись manager+customer на один initial saved intent; demo→simulated, реальные provider requests отсутствуют; bounded retry/lease result без дублирующего события; очередь/cron не раскрывают контакты |
| Chat | RU/EN/TH handoff, server provenance; forged fields отклоняются; staff legacy source unverified; понятный 429/cooldown. Hosted flood не делать; budget edge cases уже доказаны disposable tests |
| Catalog | Один aggregate save, две вкладки CAS, late metadata failure сохраняет старое; last variant/translation/primary-image invariants; archive→draft; старые order snapshots неизменны |
| Storage | Synthetic candidate valid MIME/size/path, реальные Auth+Storage policies, metadata commit и HTTP фото; не трогать действующие фото. Orphan retention явно допускается, автоматического delete нет |
| UX | Mobile/desktop checkout/chat/admin, keyboard focus/errors, reload/retry/expired сообщения; RU/EN/TH без выдуманной языковой приёмки Thai |
| Recovery | На Preview проверить выбранный безопасный сценарий с сохранённой парой artifact/config, без остановки других services; observed healthy marker и отсутствие двойного rollback; backend mixed-state fallback проверен отдельно |

Hosted негативные тесты выполняются только на подготовленных synthetic сущностях,
без bulk/flood и реальных email. Удаление тестовых Storage blobs, если нужно,
не входит молча: сохранить до согласованной обычной Storage cleanup. Ни один
receipt token или request key не публикуется в отчёте/логах.

## Rollback и продолжение после ошибки

- До schema: восстановить previous verified frontend/config; нет новых данных.
- После schema: не запускать старые chat/admin write paths. Оставить совместимый
  backend и read-only/maintenance frontend; forward repair предпочтительнее
  destructive down. Pending resolve/close сохраняются для неопределённых ответов.
- После Edge/frontend: A1 rollback восстанавливает artifact/config, но НЕ DB/Edge.
  Не объявлять его полным release rollback; stale old UI может быть несовместим.
  Не возвращать unsafe assistant/source или browser grants ради старого клиента.
- Restore database из backup потребует согласованной остановки writes и учёта
  всех данных после backup; без плана reconciliation это потеря данных.
  Автоматический restore live не разрешён и не выполняется.
- SIGKILL/power loss: operation-in-progress/recovery-required markers требуют
  ручного разбора; нельзя полагаться на EXIT trap.

## Минимальные оставшиеся решения

Повторное общее разрешение main/OVH Preview не требуется: оно уже дано.
Нужны результаты publisher inventory, подтверждённые backup/restore и parity,
точный maintenance/recovery механизм, content решение по двум builders.
Отдельное разрешение необходимо только для конкретного нового выхода за scope:
изменения persistent credentials/security/access, неизвестный внешний publisher,
платный backup target, неутверждённые live content changes или data-loss restore.
При запрете указать exact operation/target/reason и не обходить его.

До закрытия gates: только read-only/local preparation. Main, prototype, live
schema, Edge, Preview, Sites и другие OVH services этим документом не изменены.
