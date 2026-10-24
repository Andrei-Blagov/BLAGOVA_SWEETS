# PostgreSQL test readiness — отдельный infrastructure fix

## Сохранённый результат source 09f6f7ce

Независимая Linux задача проверила immutable source
09f6f7ce267e112e0cc8e67088b2200e7b4214b1: **aggregate FAIL**.
Catalog PostgreSQL harness дважды принял transient initialization server за
готовый cluster; CREATE DATABASE попал в Unix-socket shutdown gap до migrations.
Четыре catalog application scenarios **NOT RUN**, не failed assertions.
Не заменять этот результат успешным локальным повтором.

Остальные gates этой попытки passed: real PG sequence ACL 7/7, security 119/119
(включая 33 Bash), SQL 26 migrations + 4 suites, worker 12/12, pending 8/8,
typecheck, static generate 32 routes, scans source321/manifest36/built77.

Evidence Library libfile_b7e32c15a7c0819187b8759a8caaa860; 87 706 bytes;
SHA-256 b32ddedaf7b9c45a178c1f97962c7f20e06ec463a586717b20c8f66778db02b9.
Это сообщение отдельного Linux verifier; raw evidence не копируется в public git.
Исторические 59c5b1f/09f6f7ce reports и archive не переписываются.

## Причина и минимальный fix

Official postgres entrypoint запускает temporary server с listen_addresses=''
для initialization, затем останавливает его и запускает final postgres.
Unix psql/pg_isready может успешно ответить именно на temporary server.
[Официальный entrypoint](https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh).

Новый test-only helper scripts/postgres-test-readiness.mjs выполняет bounded
SELECT 1 через 127.0.0.1:5432 **внутри уже проверенного disposable container**.
Socket-only init server не принимает TCP. Возврат возможен только после final
server; существующий 15s budget сохранён, per-probe connect/process timeout
ограничен. Никакого fixed stabilizing sleep или повторения failed SQL/migrations.
При timeout сохраняется probe cause.

Catalog и pending harnesses вызывают helper до первого CREATE DATABASE.
SQL/concurrency assertions, image pins, ownership/network cleanup не меняются.

Sibling inspection:

- Catalog: Unix readiness loop заменён final TCP helper.
- Pending: прежний CI pg_isready loop имел ту же гонку; убран, ожидание находится
  в самом harness и работает также вне CI.
- CI worker service healthcheck: pg_isready теперь явно -h127.0.0.1/-p5432.
- Python worker уже использует loopback TCP psycopg; код/12 scenarios не меняются.
- Standalone README readiness command также исправлен на TCP.

CI events/branch/environment/deploy/restart guards и audit thresholds неизменны.
Это не PostgreSQL/app/credentials upgrade и не изменение live readiness/network.

## Targeted regression и локальные результаты

Три deterministic tests проверяют sequence init Unix accepting → shutdown gap →
final TCP, немедленный возврат без дополнительного sleep и timeout при отсутствии
final listener. При возвращении Unix probe первый behavioral test завершится
раньше final phase и упадёт. **3/3 PASS**.

Related readiness/Preview gates/manifest/secret rules: **17/17 PASS**, без skips.
Один affected catalog run на cached PostgreSQL17.11: **4/4 PASS**, включая
независимые сеансы/CAS, late rollback, publication guard и category race.
Owned network-none container/anonymous volume удалены, containerRemoved=true.
Новых native Windows crashes не наблюдалось; старая instability не закрыта.

Application/frontend/Edge/migrations/lockfile не меняются от 09f6f7ce.
Manifest сохраняет 26 migrations / 36 backend source hashes.
Новый source SHA требует нового независимого Linux aggregate. Полный aggregate,
typecheck/build и остальные real-PG suites здесь не перезапускались.

## Остальные gates — без новых live действий

Supabase MCP работает. Поддерживаемый IAB Dashboard открылся, затем перенаправил
на Sign in; login/SSO не выполнялись. CLI backup inventory раньше остановился
с AccessTokenRequiredError до API. Минимум нужен screenshot/даты из существующего
авторизованного Dashboard Database Backups, без новых tokens.

Read-only OVH audit 40090543566 passed через existing preview SSH environment;
deploy/restart skipped. Safe restore/recovery drill proposal подготовлен вне git;
непроверенный новый operational script не запускался.
Bounded GitHub check/status/deployment inventory показал только github-actions;
полное installed Apps/provider branch binding остаётся scoped UI gate.
Нет live ACL/content/migrations, push, main merge или deployment.
