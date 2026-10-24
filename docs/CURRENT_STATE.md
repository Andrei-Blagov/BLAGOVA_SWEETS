# BLAGOVA SWEETS — текущее состояние

## Выпуск на существующий Preview завершён — 24.10.2026

Приложение `58209191d20dee16b22a5d2a1a753c36080860ed` перенесено обычным merge PR №5. Проверенный source/deployed SHA: `ee35d6a84c47f8630dab6c4cf4e8981f7825ca04`; main и prototype совпали на этом release до последующего документационного commit. Исходный tree приложения `c6be4aa0ba4489cfbd90633e8339700e9bd41002`; merge tree отличается только уже существовавшим в main manual-only workflow. Ops HEAD 24d827e и незавершённый activation-only маршрут не включались.

[Actions 40109074274](https://github.com/Andrei-Blagov/BLAGOVA_SWEETS/actions/runs/40109074274) success: PostgreSQL/verify и **один** deployment через environment preview → существующий OVH Compose. HTTPS /health=200/ok; header/meta/robots noindex; 10 маршрутов и все 42 JS/CSS совпали с проверенной сборкой. 122 security tests, 26 portable migrations/4 SQL suites, typecheck/build/scanners прошли. Runtime audit 0; full 9 high/6 moderate/0 critical.

Применены пять reviewed application migrations и все шесть Edge bundles/shared imports с сохранёнными JWT/env. Нейтральные RU/EN/TH descriptions добавлены только двум demo builders; цены не менялись. Worker восстановлен active */2, временная защита полностью удалена, pending/failed/sending и незавершённых попыток 0.

Свежая приватная application copy снята 15:43:30 UTC после 206 секунд подтверждённой паузы; старые hosted bundles сохранены приватно, image/config — штатным deployment script. Restore/rollback drill сознательно пропущен по решению владельца. Auth rows и Storage bytes не покрыты application snapshot.

20 HTTP API проверок: один demo intake/duplicate/recovery/conflict/close-fence, RU/EN/TH chat/replay/handoff/forged-field rejection. Два initial receipt и отмена обработаны actual worker как simulated, по одной attempt, без provider ID/sent_at. QA BLG-10412D97 отменён, резерв освобождён; три QA thread возвращены в bot, история сохранена. Отмена/release — native staff RPC в серверном SQL-контексте существующего owner; это не повторная browser/Auth приёмка staff UI. Исходные данные 15 проверенных business relations и Storage metadata сохранены по hashes. Временные raw backup/контакты/capabilities не публикуются.

[Полный отчёт выпуска](PREVIEW_RELEASE_20261024.md). Подробный итог и документационный SHA — [PR №5](https://github.com/Andrei-Blagov/BLAGOVA_SWEETS/pull/5). Записи «кандидат ещё не опубликован» ниже исторические. Этап 4/retrieval/RAG этим выпуском не разрабатывался. Production-домен, другие OVH приложения, реальные платежи/почта и платный AI не включались.


## PostgreSQL harness readiness follow-up — 24.10.2026

Independent source 09f6f7ce aggregate **FAIL**: catalog readiness accepted init
Unix server; четыре scenarios NOT RUN, все остальные gates passed (ACL7/7,
security119/119, SQL26+4, worker12/12, pending8/8, static32, scans321/36/77).
[Evidence и новый test-only fix](postgres-readiness-followup-20261024.md).
Final TCP probe общий для catalog/pending, CI worker health тоже TCP.
Targeted3/3 + related17/17 и один cachedPG17 catalog4/4 PASS. Application/migrations
не менялись; новый fixed-SHA Linux aggregate ожидается. Старый FAIL сохранён.

## Локальный sequence ACL fix — 24.10.2026

[Новый candidate](stabilization-chat-sequence-acl-20261024.md): отдельная migration
20261024111725, revoke SELECT/USAGE/UPDATE у PUBLIC/anon/authenticated только на
public.messages_chat_sequence_seq; service USAGE и прежние service privileges
сохранены. Hosted-default regression red→green, affected 13/13 и SQL26+4 PASS.
Manifest 36 hashes. Новый fixed-SHA Linux checkpoint ожидается; старый 59c5b1f
PASS сохранён исторически. Live application ACL требует отдельного exact approval.
No push/deploy/live content/auth changes; OVH denial не повторяется.

## Read-only parity/rehearsal follow-up — 24.10.2026

[Concrete результаты](ROLLOUT_PREFLIGHT_RESULTS_20261024.md): совпали 33 tables /
270 columns / 177 constraints / 83 indexes / 74 policies / 27 triggers / hashes
74 functions. С live extra ACL/defaults воспроизведены четыре новые migrations
и семь smoke checks в disposable PGlite18. **Новый gate:** default public sequence
grants дают anon/authenticated UPDATE новой chat sequence; SQL-role counter
tampering ломает server send. HTTP exploitation не доказан. Минимальный revoke
проверен только disposable; source SHA не менялся, live ACL не менялись.
6 Edge bundles/11 source files сохранены вне git; env/data backup не получен.
Publisher inventory завершена unresolved. SSH TCP22 Permission denied до auth;
не повторялся. Нужны новый reviewed sequence-ACL candidate и законный ручной
read path/backup metadata. Контент builders ожидает ответа, live не менялся.

## Независимый Linux checkpoint и rollout — 24.10.2026

Code SHA `59c5b1f685d919f75c77b336cdd527d9ee946949`:
[independent aggregate PASS](INDEPENDENT_LINUX_CHECKPOINT_20261024.md), 118/118,
25 migrations + 4 suites, реальный pinned PG 16.15 12/12 + 8/8 + 4/4,
typecheck/static generate 32 routes/scanners/35 hashes PASS. Limited A5 review
без новых подтверждённых P1/P2. Windows native/EPERM остаются открытыми.
Пользователь разрешил normal history-preserving main update и deployment именно
на существующий OVH Preview после gates. **Сейчас NO-GO**:
[hosted acceptance/compatibility plan](HOSTED_ACCEPTANCE_ROLLOUT_20261024.md).
Read-only live 10:50 UTC: оба published demo builders custom-gift/celebration-set
без description RU/EN/TH; старые Edge/RPC, parity и backup не подтверждены.
Контент/схема/Edge/ветки/Preview не менялись. External publishers остаются
unresolved; knowledge не начат. Исторические checkpoints ниже не переписываются.

## A5 — локальный checkpoint 24.10.2026

[Dependency/legacy отчёт](stabilization-a5-20261024.md): full audit 20→15 entries
(9 high / 6 moderate / 0 critical), runtime 0. Nuxt/Vue/Prisma не обновляются.
Portable serial 85/85, typecheck 0, build:server 0. **Generate failed EPERM cache
mkdir**; тяжёлая часть остановлена, повторов/прав/reinstall/reset нет. Native
Windows instability открыта. Полный актуальный static release не объявляется.
Limited A4 review 610ce0c завершён без новых подтверждённых P1/P2; A5 review и Linux
aggregate впереди. [План feature Draft PR](STABILIZATION_PUBLICATION_PLAN.md) готов,
push/PR/deploy/live SQL не было. Этап 4 knowledge не начат.

## A4 — локальный кандидат 24.10.2026

Owner-only aggregate save/publish RPC с CAS, единый validator опубликованных
карточек и связанных сущностей, атомарные metadata, отдельный upload candidate
без удаления blob. Категории и builder price rules тоже используют CAS.
[Контракт, проверки и rollout ограничения](stabilization-a4-20261024.md).
25 local migrations / 35 source hashes, live parity остаётся непроверенной.
PostgreSQL 17.11: 4 synthetic независимых concurrency/rollback сценария PASS,
собственный network-none container удалён. Fixed-SHA review / Linux CI впереди.
Final portable serial security 79/79, SQL 25 + 4 suites, build 32 routes, typecheck
0; native parallel Windows crash отдельно сохранён, не считается aggregate PASS.
Seed custom-gift/celebration-set требуют owner content preflight описаний;
live контент не проверялся и не исправлялся. Цены/старые order snapshots не менялись.
Отдельный A3 staff provenance fix: 6e8926e, manager/owner regression PASS;
[подробности](stabilization-a3-staff-provenance-20261024.md).

## A3 — локальный кандидат 24.10.2026

Сервер определяет assistant body/source; новый service-only RPC и Edge закрывают
клиентскую подделку роли/источника и импорт истории через intake. Добавлены byte
body limit/timeouts, DB budgets start/poll/send, общие для token/origin/header
rotation, и понятный UI cooldown. Старый keyword demo не считается этапом 4.
Windows launch-editor mock исправлен отдельным 2a8ba9e (2/2). Контракт, тесты,
proxy trust и rollout limits: [stabilization-a3-20261024.md](stabilization-a3-20261024.md).
24 local migrations / 34 backend source hashes; live observations не обновлялись.
Два воспроизведённых review замечания A2 (chat recovery и in-memory TTL) исправлены
отдельным follow-up: [stabilization-a2-review-20261024.md](stabilization-a2-review-20261024.md).
Focused реальные UI/Edge/SQL + A3: 10/10. Обязательны fixed-SHA re-review и Linux CI;
33 A1 Git Bash сценария не перезапускаются после зафиксированной блокировки review.

## Пакет A2/F1 — локальный кандидат 24.10.2026

Продолжение от A1, без публикации/deployment/live SQL. Добавлены private pending
receipt/close fence, независимый recovery token, конфликт key/payload и минимальное
sessionStorage без контактов/адреса/текста заказа. Успех checkout использует серверные
дату/состав/цену; reload разрешает прежнюю попытку до новой отправки. Контракт и результаты:
[pending-intent-contract.md](pending-intent-contract.md), [stabilization-a2-20261024.md](stabilization-a2-20261024.md).
Первичный outbox реализован следующим локальным коммитом: две транзакционные receipt
записи, общий worker/lease/retry/demo gate, timeout, стабильный provider body/key;
синхронная best-effort почта удалена из intake. Без backfill и реальных отправок.
Portability SQL harness исправлена отдельно
в fa1ce1b; прежний launch-editor Windows failure исправлен в 2a8ba9e (2/2).
История A1 ниже сохранена.

Обновление 24.10.2026, пакет A1/F6. Этот краткий документ и [RELEASE_MANIFEST.json](RELEASE_MANIFEST.json) — актуальный указатель; подробные датированные доказательства в PROJECT_STATE/acceptance/concurrency сохранены как история.

## Концепция и цель

В первую очередь это **кондитерская собственного производства со своей маленькой уютной кофейней** в Паттайе. Приоритет сайта: торты, капкейки, имбирные пряники, handmade-шоколад, подарки и заказы. Кофейня на 5–6 столиков дополняет кондитерскую: атмосфера, знакомство с десертами, напитки и выдача. Это не ресторан и не обычная пекарня; хлеб, булки и блюда не добавляются. В A1 дизайн и ассортимент не переделываются.

Текущая цель — демонстрационный продукт на постоянном Preview, не коммерческий запуск. RU/EN/TH сохраняются; Thai требует проверки носителем. Demo budget 32 и интервалы выдачи не объявляются измеренной мощностью производства. Серверный lead_days уже есть; склад готовых изделий и посменное планирование пока вне модели.

## Где находится код и что развёрнуто

| Слой | Что известно | Предел доказательства |
|---|---|---|
| Git baseline | prototype/PR #1: f6327c34422060a070fe3a7bcde5ad489b1c60b6, fetched 24.10, PR Draft/open | перед будущей публикацией сверить снова |
| Main | 31e4171359900d59a5936b57e7603a13dad52990, устарела | не меняется в A1 |
| Локальный кандидат | fix/preview-release-recovery; commit определяется git rev-parse HEAD после коммита | не опубликован, не развёрнут |
| Frontend Preview | исторически принятый 054e694398aa52330734adc027eba2dab8d3142d | 24.10 health/главная 200/noindex; новый полный asset hash comparison не выполнялся |
| Edge | наблюдались 24.10: order v12, chat v5, confirm v3, availability v3, change v2, worker v1 | только metadata; deployed source parity не доказана |
| Schema | 21 local application migrations; 21 live history records, включая ops schedule | версии частично различаются; количество не доказывает schema parity |
| Cron | metadata 24.10: active */2 | не доказательство реальной доставки |

Новых live-запросов ради A1 manifest не делалось: он явно ссылается на наблюдения аудита. Локальные SHA-256 31 backend/ops source файла проверяются `node scripts/check-release-manifest.mjs`. Это инвентаризация исходников, не attestation работающего backend.

## A1/F6 — локальная реализация

Исправлены единый EXIT recovery path (включая explicit unhealthy exit, timeout, command failure), раннее включение восстановления перед записью config, проверка health/image после восстановления и marker после успешной проверки. Recovery вызывается один раз; его ошибка не вызывает рекурсию. При неудачном recovery удаляется healthy SHA marker и записывается recovery-required. Previous config pair сохраняется до мутации и восстанавливается при частичной rotation failure. Успешный manual rollback обновляет SHA marker из target image; legacy не получает вымышленный Git SHA.

Общая библиотека preview-release-lib.sh передаётся вместе с двумя скриптами; branch/event/deploy gates workflow не расширены. Shell-файлы закреплены LF. Изолированные regression tests используют fake Docker и временные synthetic файлы; реальные Docker, SSH, OVH, Supabase, mail provider не вызываются. На Windows только Unix permission operations в fixture подменяются; Linux использует штатные install/chmod. Итоговые результаты — [stabilization-a1-20261024.md](stabilization-a1-20261024.md).

**Это исправление в коде, а не доказанный исправленный Preview.** До согласованной публикации и отдельного deployment на сервере остаются прежние скрипты. SIGKILL/потеря питания не вызывают EXIT trap: operation-in-progress и приватные transaction snapshots требуют ручного разбора. Исторический аудит и его вывод о F6 на f6327c3 не переписываются.

## Следующие пакеты

1. Завершить review A1, согласовать публикацию ветки/PR и отдельно Preview drill. Main/production не трогать.
2. A2: pending checkout intent/fingerprint/canonical response и durable initial notification; не потерять idempotency после неопределённого ответа.
3. A3/A4: server-owned chat/source и limits; atomic catalog save/publication/CAS.
4. A5: Windows baseline tooling и dependency triage. Прежняя проверка аудита: 59/60 JS на Windows, штатный SQL harness failed до миграций; portable-копия SQL passed отдельно. Эти исторические результаты не заменяются новыми A1 tests.
5. Этап 4: deterministic public/published knowledge retrieval RU/EN/TH, источники/handoff, минимум 100 eval questions. Генеративных ответов и платных API здесь нет.
6. Общая demo-приёмка; production readiness — отдельный будущий план.

Для следующего server шага остаются staging recovery drill, актуальный release/source parity и проверка фактической упаковки. Для main/promote — внешние deployment triggers, production baseline, backup/restore и совместимость frontend/Edge/schema. До коммерческой почты — real-provider/idempotency и post-claim политика. Нет общего blocker доступа Supabase; secrets передавать в чат не требуется.
