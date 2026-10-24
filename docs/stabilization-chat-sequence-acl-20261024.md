# Chat sequence ACL — локальное исправление 24.10.2026

Исходный independently tested SHA `59c5b1f685d919f75c77b336cdd527d9ee946949`
и его отчёты сохранены. Изменение добавляется отдельным commit поверх
documentation HEAD `47384d40ceeb9c3721bf290a776f38af9ec2ef4d`.
Этот новый candidate требует своего Linux fixed-SHA checkpoint.

## Минимальное изменение

Новая migration, созданная штатным offline Supabase CLI:
`20261024111725_restrict_chat_sequence_acl.sql`.

Точный объект: `public.messages_chat_sequence_seq`.
REVOKE ALL PRIVILEGES на этой sequence у PUBLIC, anon, authenticated отзывает
SELECT, USAGE, UPDATE. PUBLIC — не login-role, это неявный grant всем ролям.
service_role явно сохраняет USAGE; уже имеющиеся hosted SELECT/UPDATE этой
серверной роли не отзываются. Ownership и права владельца не меняются.

USAGE достаточно серверному nextval/currval при записи сообщений. Manager/owner
работают через существующий staff RPC с проверкой роли и SECURITY DEFINER
implementation, а не через browser sequence privileges. Регрессии проверяют их
take/reply/history, service send, RU/EN/TH, replay и порядок сообщений.

Default privileges проекта не меняются. Нет новых ролей, broad schema/table/
function grants, отключения RLS или изменения Auth. Counter не сбрасывается,
chat rows/history/provenance не переписываются. Другие sequences вне scope.
Эта migration **не применялась live**; для реального security-permission change
необходимо отдельное точное подтверждение пользователя.

## Почему новый regression отличается от прежнего scaffold

Во всех SQL-backed fixtures storefront-chat-trust.test.mjs до migrations
воспроизводятся считанные hosted defaults: SELECT/UPDATE/USAGE на public
sequences для anon/authenticated/service_role.

Новый behavioral test до исправления: **0/1**, assertion
`anon must not retain SELECT`. После новой migration: **1/1**.
Проверяет отсутствие всех трёх privileges у browser roles и inherited PUBLIC
ACL; реальные setval(bigint max) и nextval от этих SQL roles получают 42501.
Service send/retry работает, message ordering монотонен, replay не дублирует
ответ. Повторное выполнение самого ACL SQL сохраняет counter и историю.
Hosted service SELECT/UPDATE сохраняются, а USAGE гарантирован.

Это исправляет доказанное избыточное DB permission. Удалённая эксплуатация через
HTTP/PostgREST не демонстрировалась; нет заявления о live инциденте.

## Локальные проверки нового дерева

- Последовательный affected security run: **13/13 PASS**, без skips.
  storefront-chat-trust, storefront-chat-cors, staff-chat-provenance,
  release-manifest, secret-scan.
- Обычный SQL harness: **26 migrations + четыре SQL suites PASS**.
- Manifest: **36** normalized source hashes, включая новую migration.
- Source scanner и staged diff check выполняются перед commit.
- Новых native Windows crashes при этих проверках не наблюдалось. Историческая
  Windows instability и static generate EPERM не объявляются устранёнными.
- Fresh install, весь aggregate/Bash, real PostgreSQL и static build нового SHA
  должны пройти в прежней отдельной Linux задаче. Здесь они не перезапускаются.

До/после logs и raw preflight snapshots находятся вне public repository.
Никакой live Supabase SQL, mail/provider, push/main/deploy или OVH connect
в этом исправлении не выполнялся.

## Следующий bounded шаг и подтверждения

1. Передать tracked-only archive нового immutable SHA в ту же Linux проверку;
   сверить manifest/tree/ZIP comment/SHA-256. До её результата не приписывать
   старый PASS новому candidate.
2. Затем получить exact confirmation для live применения ACL migration:
   revoke SELECT/USAGE/UPDATE у PUBLIC/anon/authenticated **только** на
   public.messages_chat_sequence_seq; service_role USAGE и существующие
   server privileges сохраняются. Общая авторизация main/Preview не заменяет
   это отдельное подтверждение security-permission change.
3. До переключения всё ещё нужны: GitHub Settings inventory (Actions enabled,
   push/PR publishers/hooks/Apps, main/prototype rules, preview environment);
   Supabase Database Backups screenshot/metadata (последний completed backup,
   retention/PITR/restore availability); известный разрешённый OVH session/read
   path и artifact/config/backup inventory. Не просить токены или пароли в чате.
4. Нейтральные описания custom-gift/celebration-set готовы только локально;
   owner approval ожидается. Live content не менять до ответа.

Недавний SSH TCP connect Permission denied не повторялся, маршруты не менялись.
Без OVH доступа можно делать local regression/manifest/archive и Linux review;
нельзя доказать current deployed artifact/config/backup и recovery на сервере.
Knowledge feature не начинается.
