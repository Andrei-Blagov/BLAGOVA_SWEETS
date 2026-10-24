# A3 — серверное происхождение чата и бюджеты, 24.10.2026

Локальный кандидат от A2 `07333963d4cc29549944a7f006e78891764a2880` в
`fix/preview-release-recovery`. Отдельный Windows test commit:
`2a8ba9e8f4f4f4abafbedb4ac9a9723c3d6cd040`. Ничего не опубликовано и не развёрнуто.
Исторический аудит и результаты 59/60, затем 98/99 не переписаны.

## Контракт доверия

`storefront-chat` принимает только action/token/locale/customerMessageId/customerBody/
requestManager. Assistant text/id/source, role, conversationId и прочие поля
отклоняются с 400. Удалён старый SQL overload, принимавший assistant body/source.
Новый RPC service-only, SECURITY INVOKER, пустой search_path. Текст, случайный ID
ответа и provenance `handoff-v1` задаёт SQL. Staff permissions/RLS не расширены.
Повтор customer message ID с тем же текстом не создаёт второй ответ, другой
текст или conversation возвращает conflict. В requested/manager бот молчит;
closed отклоняет запись, poll сохраняет историю. Manager/owner роли берутся из
staff_members через существующий staff RPC.

Локальный `findKnowledge` больше не используется публичным чатом. Сейчас сервер
выдаёт RU/EN/TH сообщение об отсутствии утверждённого ответа и предлагает заявку
или менеджера; явная кнопка или слова human/manager/менеджер/человек/TH вызывают
handoff. Это детерминированная безопасная граница, **не этап 4**. Published retrieval,
проверенные источники и минимум 100 eval вопросов ещё впереди. Thai — черновик.
Legacy assistant/system ответы сохраняются, но их старый source не выдаётся;
интерфейс отмечает их как непроверенную demo-историю. Данные не удаляются.

Альтернативный импорт истории через storefront-order закрыт: messages должен
быть пустым. SQL facade submit_storefront_intent проверяет это повторно, исходная
A2 реализация перенесена в private без переписывания applied migrations.
Цены, capacity, receipt capability и атомарный outbox сохранены. Chat order
показывает canonical reference из intake в отдельном UI, а не сохраняет
придуманное браузером assistant-подтверждение.

## Ресурсы и proxy trust

Body ограничен **16384 UTF-8 bytes во время streaming**, независимо от
Content-Length; malformed JSON/types → 400, oversize → 413, body timeout 5s → 408.
DB fetch timeout 10s; browser timeout 15s. Publishable key проверяется как у
других публичных Edge APIs; это не пользовательская авторизация и не секрет.
Logs содержат только event/status/error class или SQLSTATE, без body/token/IP.

| Действие | Общий бюджет приложения | Бюджет одного token |
|---|---|---|
| start | 60 / 60s | 6 / 60s |
| poll | 1200 / 60s | 30 / 60s |
| send | 240 / 60s | 60 / 3600s |

Фиксированные DB counters общие для всех Edge instances, origin и token.
Ротация token, Origin и IP headers не обходит общий бюджет. Счётчики атомарны;
ошибки missing/closed/conflict возвращаются JSON-значениями, поэтому их расход
не откатывается транзакцией. Истёкшее окно возобновляется по серверному времени.
Удаляется максимум 200 старых budget rows при создании сессии, не на каждом poll.
UI показывает локализованный limit error, уважает retryAfterSeconds и прекращает
poll/send на время cooldown; 429 не приводит к ротации token. Draft сообщения
сохраняется до server acknowledgement, фиктивные assistant replies не рисуются.

**Не используется доверие к X-Forwarded-For/CF-Connecting-IP:** доступного
проверенного контракта ingress/header rewriting нет. Новый код их игнорирует.
Поэтому это общий предохранитель демонстрации, не доказанная per-person/IP
защита и не DDoS mitigation. Один нарушитель способен исчерпать общий бюджет и
временно затронуть других посетителей. Некорректные HTTP payload не создают
сессий и не идут в SQL, но расход invocation на gateway всё равно существует.
Перед коммерческим запуском нужны проверенный ingress и его abuse protection,
нагрузочный профиль, retention/архивирование истории и наблюдение за бюджетами.
Сейчас нет live-нагрузки и не меняются proxy/network settings.

Supabase отдельно описывает, что platform function-to-function limit не
покрывает входящие запросы: [официальная документация](https://supabase.com/docs/guides/functions/recursive-functions).

## Проверки и пределы

- `shell-quote.test.mjs`: 2/2 Windows. Реальный launch-editor parser и его Windows
  exec branch перехвачены; проверяется точная command string/options, остальные
  process APIs запрещены. Linux spawn assertion и advisory assertions сохранены.
- `storefront-chat-trust.test.mjs` + CORS: 7/7. Реальный Edge + 24 migrations в
  disposable PGlite, RU/EN/TH, повтор/conflict, handoff, manager/owner/outsider/
  anon boundaries, legacy provenance, malformed/UTF-8 oversize/stalled body,
  61 synthetic starts, token/header/origin rotation и seeded poll/send boundaries.
  Объёмные 1200/240 вызовы не генерируются: проверяются точные границы счётчиков.
- Pending intent + outbox + chat focused snapshot: 9/9; повторный final aggregate
  будет записан после двух отдельно запрошенных review corrections A2.
- Typecheck exit 0; известное предупреждение vue-router/volar plugin остаётся.
- Нормальный SQL harness: 24 migrations + 4 suites PASS до final test additions.

Все данные синтетические, fetch привязан к fixture.invalid/локальной SQL.
Live migration, hosted SQL, mail, платные API, deployment, push/main не выполнялись.
Независимый исполняемый Git Bash review A1 заблокирован NtCreateDirectoryObject
0xC0000022; отказ не обходится. Исторический локальный A1 pass не заменяет Linux CI.
Независимый review фиксированного итогового SHA и общий Linux CI ещё требуются.

## Будущая публикация

Код меняет сигнатуру RPC и строгий payload. Понадобится согласованное окно
schema → Edge → frontend с обслуживанием ошибки устаревшему клиенту и проверкой
кеша/reload. Прежний frontend с assistantBody будет отклонён новым Edge, старый
Edge не совместим с новым SQL overload. Старые pending receipt можно разрешить
через unchanged resolve RPC. При откате нельзя возвращать client-authoritative
чат: безопасный fallback — временная недоступность чата и ссылка на менеджера.
План/проверка backend rollback должны предшествовать публикации. Manifest хранит
24 local migrations/34 source hashes, а live history 21 и parity not_verified
остаются историческими наблюдениями.
