# BLAGOVA SWEETS — текущее состояние

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
