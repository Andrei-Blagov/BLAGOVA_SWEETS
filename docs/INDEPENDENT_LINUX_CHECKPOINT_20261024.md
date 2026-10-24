# Независимая проверка стабилизации в Linux — 24.10.2026

## Фиксированный объект проверки

- Code SHA: `59c5b1f685d919f75c77b336cdd527d9ee946949`.
- Source archive: `BLAGOVA_SWEETS-59c5b1f-source.zip`, 39 922 077 bytes.
- Archive SHA-256: `5d9005200c4dd1221d5264c1510d4285a849f05e56ff7bd5768063ad50f62c6c`.
- Все 316 файлов совпали с архивом; при подготовке также проверены Git blob hashes
  каждого файла, ZIP comment с полным SHA, отсутствие .git/env/credentials/evidence/
  node_modules. Тестируемые исходники не изменялись.
- Independent task: `01a16d7d-20e2-7686-bf6f-3b0d43cee008`.
- Private evidence Library: `libfile_1718031ace3c81918f5f451fd40b185a`,
  67 573 bytes; SHA-256
  `5d7912f0d00e82aa8f56df9b366de43c2b3b10dfea635394e45280bad9240ba9`.
  Raw evidence/runner logs не копируются в этот public repository.

Результаты ниже переданы управляющим чатом из отдельной задачи проверки.
Этот documentation commit фиксирует свидетельство, не выдаёт его за повторный
прогон на Windows и не amend-ит проверенный source commit.

## Результат: PASS с документированными предупреждениями

| Проверка | Результат |
|---|---|
| Fresh npm ci и postinstall | PASS |
| Runtime dependency audit | 0 vulnerabilities |
| Full dependency audit | 9 high / 6 moderate / 0 critical |
| Security suite | 118/118, включая 33 исполняемых Bash recovery tests |
| SQL/PGlite | 25 migrations + четыре SQL suites |
| Pinned PostgreSQL 16.15 worker/notes | 12/12 |
| PostgreSQL pending intent | 8/8 |
| PostgreSQL catalog | 4/4 |
| Typecheck | PASS |
| Static generate | PASS, 32 routes |
| Secret scans | 316 source files / 77 built text assets |
| Release manifest | 35 source hashes PASS |

Один install retry использовал уже существующую CA variable runner.
TLS verification не отключалась. Это не изменение trust/credentials проекта.
Оставшиеся advisories не объявляются устранёнными. Native Windows instability
и локальный A5 generate EPERM остаются исторически открытыми; Linux PASS
снимает отсутствие Linux aggregate на этом SHA, но не исправляет Windows.

Отдельный limited A5 fixed-SHA review не нашёл новых подтверждённых P1/P2
в проверенном scope. Это не blanket security PASS и не hosted acceptance.

## Что это разрешает оценивать дальше

Код готов к следующей ограниченной стадии координации rollout и hosted проверки.
Это не доказательство live schema/Edge parity, Storage/Auth/PostgREST/Cron,
доставки provider, пригодности backup/restore либо исправленного OVH recovery.
Никаких push/merge/deploy/live migrations этим свидетельством не выполнено.

Пользователь позднее явно разрешил normal history-preserving перенос проверенной
версии в main и deployment на **существующий OVH Preview** после gates.
Коммерческий запуск, другой домен, реальные письма/платежи и изменения постоянных
credentials/security/access вне функционального scope не входят в разрешение.
Main и prototype нельзя подменять новым непроверенным HEAD.

Следующий порядок и NO-GO gates:
[HOSTED_ACCEPTANCE_ROLLOUT_20261024.md](HOSTED_ACCEPTANCE_ROLLOUT_20261024.md).
Knowledge stage 4 пока не начинается.
