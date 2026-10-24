# Read-only parity, rehearsal и recovery inventory — 24.10.2026

Code candidate остаётся `59c5b1f685d919f75c77b336cdd527d9ee946949`.
Documentation checkpoint `4c702d879fa80301c53894756bc17b1b8ea69300`
не менял source. Этот follow-up тоже документационный. Независимый Linux PASS
сохраняется как результат именно исходного candidate; новое наблюдение ниже
не скрывается за этим PASS. Live migrations/ACL/content/deploy не выполнялись.

## Закрытая часть structural parity

Read-only pg_catalog/information_schema SELECT сравнен с 21 локальной baseline
migration в disposable PGlite, без live user/customer/order rows и function bodies.
С live экспортированы только metadata и hashes определений/тел функций.

| Объекты public/private | Live | Baseline | Различия |
|---|---:|---:|---|
| Tables и RLS flags | 33 | 33 | нет |
| Columns/types/defaults/nullability | 270 | 270 | нет |
| Check/PK/FK/unique/exclusion constraints | 177 | 177 | нет |
| Indexes | 83 | 83 | нет |
| Policies, включая application Storage policies | 74 | 74 | нет |
| Application triggers, включая Auth owner trigger | 27 | 27 | нет |
| Application functions, identity/config/definer и body/definition hashes | 74 | 74 | нет |

PGlite сообщает PostgreSQL 18, live — 17.6.1.166. Его отдельные NOT NULL catalog
constraint rows нормализованы отдельно: nullable flags колонок сравниваются
полностью. Synthetic public.gen_random_bytes stub исключён из сравнения;
live pgcrypto не заменялся. Это не сравнение всей managed Auth/Storage internal
схемы, ownership/default privileges либо реальных данных/remote services.

Для app roles live добавляет к baseline:

- service_role REFERENCES/TRIGGER/TRUNCATE на production_slots и
  production_blackout_dates: шесть grants;
- service_role EXECUTE на 16 существующих staff/catalog public functions.

Их presence не объявляется уязвимостью; это backend role. Они воспроизведены
только в disposable DB, а не отозваны/добавлены live. Новые миграции не нужно
сводить к четырём по разнице history counts или reapply-ить baseline.

## Репетиция четырёх новых миграций

На synthetic baseline применены существующие дополнительные 22 live ACL entries,
затем отдельно считанные live default privileges public для migration owner
postgres и существующие sequence grants app roles. Никаких password hashes,
Vault values, токенов или реальных Auth/customer rows в fixture нет.

Четыре candidate migrations применились последовательно, каждая в собственной
transaction. Прошли семь post-migration checks:

1. Новые шесть public RPC существуют, unsafe ten-argument chat overload удалён.
2. anon/authenticated не имеют direct INSERT/UPDATE/DELETE на products.
3. Два legacy published builders остаются без переписывания; новый validator
   отклоняет неполные descriptions.
4. structured_order_capacity.sql.
5. stage2_acceptance.sql.
6. staff_order_workspace.sql.
7. staff_operations.sql.

Это rehearsal на структурно сопоставленном synthetic app baseline, не restore
реального backup и не hosted PostgREST/Auth/Cron/Storage acceptance.
Cross-session PostgreSQL16.15 сценарии уже независимо passed на исходном SHA;
этот дополнительный default-ACL сценарий в тот aggregate не входил.
Новых native crashes в этой последовательной подготовке не наблюдалось.

## Новый gate: implicit ACL новой chat sequence

У hosted проекта default privileges дают anon/authenticated SELECT/UPDATE/USAGE
на новые public sequences. При A3 создании messages_chat_sequence_seq эти права
сохраняются: явного revoke в candidate нет. Обычный прежний scaffold таких
default privileges не содержал.

В disposable DB подтверждено:

- has_sequence_privilege для anon/authenticated UPDATE = true;
- SQL-роль anon может setval новой sequence;
- после установки counter в bigint maximum следующий обычный server chat send
  падает с nextval reached maximum value.

Это **доказанное избыточное DB permission и влияние при SQL-вызове от этой роли**.
Возможность выполнить setval через публичный HTTP/PostgREST endpoint не
демонстрировалась. Не называть это доказанной удалённой уязвимостью или
произошедшим live incident. В live самой новой sequence ещё нет.

Минимальный proposed fix: отозвать все sequence privileges у PUBLIC/anon/
authenticated, сохранить service_role USAGE. В той же disposable DB проверены
отказ anon setval, отсутствие authenticated UPDATE и успешный server chat send
после исправления synthetic counter. Это **не live fix и не новая migration
в repository**. Предложение сохранено локально вне git.

До deployment требуется отдельный reviewed migration/commit и regression с
hosted-style default privileges; после изменения source нужен новый SHA и
соответствующий fixed-SHA review/checkpoint. Старый aggregate нельзя приписывать
новому source. Persistent default privileges проекта не нужно менять для этого.

## Existing backup/recovery inventory

| Слой | Проверено доступным read-only путём | Точно отсутствующая возможность/предел |
|---|---|---|
| App DB schema/ACL | Metadata snapshots + matching source definitions; synthetic rebuild/rehearsal | Это не data backup; не подтверждены managed backup timestamps/PITR/restore |
| Managed Auth | auth.users exists; application owner trigger совпал | User rows/password hashes/tokens не экспортировались; Auth provider/redirect/JWT config не снимался |
| Storage | Один public catalog-demo bucket, 6 objects, 5MiB limit, webp/png/jpeg; policies сравнились | Bytes/checksums и пригодная backup-копия не подтверждены; DB metadata не заменяют files |
| Edge source | Все 6 deployed bundles штатно получены, 11 source files прошли действующий scanner и сохранены вне git с hashes | Нет снимка env/secret values, provider config и подтверждённого восстановления deployment |
| Edge source parity | 10/11 files совпали с f6327c3; три неизменяемые функции совпали | storefront-order v12 отличается одним повреждённым Thai fragment старого email HTML; полный candidate преднамеренно другой |
| Cron/Vault | blagova-notification-worker active */2; Vault entries present=true | Values и job command не читались; безопасный pause/drain/resume ещё не подтверждён |
| OVH Preview | Существуют локальный SSH alias, client и reference recovery scripts/docs | Единственный strict BatchMode connect получил Permission denied на TCP22 до auth; remote script не стартовал |

Edge metadata verify_jwt получена; env NOTIFICATION_SEND_ENABLED и реальные
pending job payloads не читались. Нельзя resume worker на предположении, что
боевые отправки выключены. Исходники Edge не заменяют env/Vault recovery.

Официальная Supabase документация подтверждает, что DB backup/restore и Storage
bytes/Edge/config — разные части; поддерживаемый management endpoint inventory
backups существует, но доступный connector не предоставляет его.
[Backup scope](https://supabase.com/docs/guides/self-hosting/restore-from-platform),
[backup inventory API](https://supabase.com/docs/reference/api/v1-list-all-backups).
Наличие endpoint не доказывает, что у проекта уже есть пригодный backup.
Management tokens не запрашиваются и произвольный HTTP auth не изобретается.

## Минимальное восстановление законного read path

Publisher inventory завершена с unresolved settings; никто не считается
продолжающим её автоматически. GitHub connector не имеет поддерживаемого
settings inventory, gh existing account Andrei-Blagov сообщает invalid token,
CUA остановлен из-за невозможности уверенно определить browser URL. Не повторять
unsupported Fetch URL и не обходить CUA/network deny.

Наименьший путь без новых credentials/grants — пользователь вручную в своём
уже авторизованном браузере читает GitHub repo settings (Actions enabled,
Webhooks, Rulesets/Branches, Environments и Installed Apps/deployment bindings)
и Supabase Database Backups (последний completed backup, retention/PITR и
доступность restore), не передавая токены/секреты.

Если нужен именно CLI read path, пользователь должен сам законно восстановить
существующую gh authentication для GitHub account Andrei-Blagov и подтвердить
цель: только read-only inventory этого repository. Автоматический auth login,
новые scopes/grants и токен в чате не требуются для ручного пути и не выполнялись.
После восстановления сначала harmless auth/read check, без push/dispatch.

Для OVH: пользователь может выполнить подготовленный узкий read-only inventory
в уже разрешённом server-сеансе/контексте и передать только metadata. Альтернатива —
явно разрешить один новый strict-host-key read-only SSH connect к прежнему alias
после выяснения local TCP denial. Ни другой порт, ни proxy/tunnel, ни новая key/
known_hosts запись не пробовались. Это отдельный network execution blocker,
не invalid GitHub credential и не remote SSH publickey rejection.

На уровне tools нет HTTP403/required-scope результата settings API: до него
запрос не дошёл. Не выдумывать недостающий scope или обещать, что renew token
автоматически решит все права.

## Следующий ограниченный шаг

До main merge/Preview: исправить локальный sequence ACL в новом reviewed
candidate, получить указанную ручную metadata инвентаризацию, затем проверить
backup/recovery и maintenance control. Content решение двух builders ожидается;
нейтральные RU/EN/TH предложения сохранены локально без изменения live.
Нового общего разрешения main/Preview не нужно. Не применять live migrations,
не менять permanent auth/security, не создавать платные ресурсы, не запускать
mail/provider и не удалять данные для закрытия этих gates.
