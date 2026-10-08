# Shell-quote: устранение critical blocker и актуализация приёмки — 07.10.2026

Исходный remote/local HEAD: `8e81c036e444adb0fafd374048fbd9eef2b7517f`; ветка `prototype/pattaya-atelier`, PR №1 открыт/Draft, дерево чистое. Отдельный checkout не меняет чужие рабочие копии. Предыдущий опубликованный Preview: `f61632b3974bba2385ed0f9f536ed37842eacf8e`; исходный конкурентный тестовый SHA: `382566598f3290f9962e93344ab246ed9fefba81`.

## Причина, первичные источники и совместимость

[GitHub advisory GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv) проверен 07.10: critical, affected >=1.8.4,<1.11.0, patched 1.11.0. В GitHub Advisory Database добавлен 06.10; вчерашний успешный audit и сегодняшний failure объясняются обновлением базы, не изменением lockfile.

Npm registry (`npm view shell-quote version dist-tags --json`) фактически сообщил стабильный latest **1.12.0**, уже включающий исправление 1.11.0. Проверены metadata/integrity и исходный `quote.js` опубликованного [npm artifact](https://registry.npmjs.org/shell-quote/-/shell-quote-1.12.0.tgz). Поэтому узкое `npm update shell-quote --package-lock-only --ignore-scripts` выбрало актуальную стабильную 1.12.0. `npm audit fix --force` не применялся.

Реальный consumer launch-editor 2.14.1 требует shell-quote **^1.8.4**: исправленная версия входит в диапазон, дополнительного override нет. Consumer использует `parse(specifiedEditor)` в guess.js, не advisory-путь quote после comment. Это ограничивает конкретный путь воздействия, но полный critical audit всё равно должен проходить.

Установленное дерево:

```text
nuxt 4.5.2
  @nuxt/devtools 3.4.2 (прежний override)
    launch-editor 2.14.1
      shell-quote 1.12.0
    simple-git 4.0.2 (прежний scoped override)
      @simple-git/argv-parser 2.0.1
      @simple-git/args-pathspec 1.0.4
```

Vue 3.5.43 и source-map-js 1.2.2 сохранены. Машинное сравнение lockfile подтвердило: изменена **только** запись node_modules/shell-quote. Package.json и metadata всех остальных пакетов неизменны. Фактический package diff отсутствует; lock diff:

```diff
-      "version": "1.10.0",
-      "resolved": "https://registry.npmjs.org/shell-quote/-/shell-quote-1.10.0.tgz",
-      "integrity": "sha512-w1aiOKwKuRgtwAReIIj89puqg+I7GvX4IbLrvmhXbzQsj1+Zwi4VO3+fa6ZF91TWSjIxoEkKnMeHcLEODK5ZXA==",
+      "version": "1.12.0",
+      "resolved": "https://registry.npmjs.org/shell-quote/-/shell-quote-1.12.0.tgz",
+      "integrity": "sha512-PcByqNyT/38F2kDNi006HAMRJaULuBzq/FOsw3qdZvX/GA9W/jamDaRskgHjubHiftXK5sIFxLNkvrXUwcof6Q==",
```

## Локальные проверки

- Чистый npm ci до/после: passed; DevTools adapter/postinstall сохранён.
- Исходный audit: runtime 0; full 4 moderate / 16 high / 1 critical.
- `npm audit --omit=dev --omit=optional --audit-level=high`: 0 vulnerabilities, exit 0.
- `npm audit --audit-level=critical`: 4 moderate / 16 high / **0 critical**, exit 0. Audit не полностью чист; thresholds/workflow не ослаблены.
- 57 security/regression tests: прежние 55 + 2 новые. Shell-quote разрешается относительно реального launch-editor. Его фактический parser и полный launchEditor сохраняют quoted editor path/аргументы; process API перехвачены, editor/shell не запускаются. Quote отвергает LF, CR, U+2028/U+2029 после comment, включая parse → append → quote; безопасные аргументы round-trip сохранены. Потенциально опасная строка в shell не исполнялась. Отдельное сравнение старой 1.10.0 и новой 1.12.0 подтвердило: прежняя версия принимает все четыре comment-tail разделителя, исправленная отвергает их.
- Реальный lazy DevTools chunk, branch/revparse/status и отказы unsafe VISUAL/trailer/include: passed в прежних регрессиях. Отдельно проверена идемпотентность адаптера на реальной установке; временные package scaffolds подтвердили fail-closed для неизвестных DevTools/Git versions и import structure. Скрипт адаптера не менялся.
- SQL: все 21 неизменённая application migration и 4 PGlite suites passed. Первый параллельный локальный лог завершился до всех suites и не использован как доказательство; отдельный повтор явно вывел все 21 OK и 4 SQL TESTS PASS. Настоящий PostgreSQL concurrency подтверждается отдельно в CI.
- Typecheck exit 0 с прежним upstream vue-router/volar/sfc-route-blocks warning.
- Static build passed, 32 маршрута; built-assets scanner passed, 77 text assets. Repository scanner passed по всем 277 staged/tracked файлам перед source commit.

## CI, release и итоговые SHA

Проверенный source/новый Preview release: `5c2adba255c4382fce52efe5c9f6eadc3c963510`. [Push CI 37573154973](https://github.com/Andrei-Blagov/BLAGOVA_SWEETS/actions/runs/37573154973) и [PR CI 37573158673](https://github.com/Andrei-Blagov/BLAGOVA_SWEETS/actions/runs/37573158673) целиком **success**. В обоих postgres-concurrency success (12 сценариев с независимыми соединениями), verify success: оба неизменённых audit, 57 регрессий, 21 миграция/4 SQL suites, typecheck, static build и scanners. PR выполняет штатный merge ref; source HEAD тот же 5c2adba.

Push прошёл штатный verified path postgres-concurrency → verify → Deploy verified preview; fix без [skip ci]/[no-preview]. Deployment job 112636474338 success: Docker build/smoke-test, upload, activate с rollback и public verification прошли. VPS log: `Preview release 5c2adba255c4382fce52efe5c9f6eadc3c963510 is healthy.` PR deployment skipped по штатному условию. Предыдущий здоровый release f61632b сохранён в rollback-контуре штатного deployment script.

Обычный git push не получил credentials и ничего не отправил. Выбранный GitHub plugin опубликовал дерево атомарно с ожидаемым исходным HEAD; tree SHA a0ec6c96610bdf1ef14e8bae4bc2e591ef615347 точно совпал с локально проверенным. Неотправленный локальный commit f7155ee был заменён ссылкой на эквивалентный remote commit только после проверки одинаковых trees и чистого дерева; файловые изменения не потеряны.

Итоговый документационный commit фиксирует результаты и публикуется с [no-preview], без [skip ci]: обязательный PostgreSQL/verify/PR CI выполняются повторно, deployment пропускается. Его точный итоговый SHA и CI отражаются в PR/handoff после завершения; source/Preview остаётся 5c2adba255c4382fce52efe5c9f6eadc3c963510. Это исключает самоссылочный SHA внутри собственного commit. Рабочее дерево после отправки сверяется с remote, должно быть чистым.

Предыдущие [push 37571548021](https://github.com/Andrei-Blagov/BLAGOVA_SWEETS/actions/runs/37571548021) и [PR 37571552272](https://github.com/Andrei-Blagov/BLAGOVA_SWEETS/actions/runs/37571552272) относятся к 3825665: PG success, verify failure на полном critical audit, deploy skipped. Эти исторические результаты не переписываются.

## Независимая проверка опубликованного Preview

После успешной активации 07.10 в 04:52:45 UTC HTTPS `/health` вернул 200/ok, главная 200; X-Robots-Tag содержит noindex/nofollow/noarchive/nosnippet. Meta robots noindex/nofollow и robots.txt Disallow: / сохранены. Все **42 JS/CSS assets** из проверенной локальной сборки получены с публичного Preview, HTTP 200; размеры и SHA-256 совпали для каждого. [Полный публичный manifest](preview-assets-shellquote-20261007.json) содержит source/release/tree SHA и каждый hash; приватных данных нет.

| Asset | Bytes | SHA-256 локально и на новом Preview |
| --- | ---: | --- |
| DMc1FfJu.js, entry | 332770 | a069592aace9844ae2ab91d74434bd68b0ba402e0eddb424014a28483105f3b8 |
| DJbSMP5f.js, staff/CSV | 89503 | 9b3c0b0e11b307b7e22a62579c4a773fc68f919ee3788e13ae045250deb39abe |

Assets совпадают также с предыдущим release: изменение исключительно dev/build shell-quote не меняет приложение. Новый release SHA подтверждён server activation log, а не выводится из одинаковых JS hashes. Браузерная UI-приёмка повторно не выполнялась.

## Актуальные статусы приёмки и границы

CSV **принят по переданному подтверждению координационного чата**: два фактически скачанных владельцем файла, 29 одинаковых уникальных ID отменённых demo-заказов, 13/16 колонок, owner opt-in и совпадение общих 13 полей. SHA-256, BOM/CRLF/quoting/formula protection/no internal notes и ситуация промежуточного 85-строчного файла отражены в датированном дополнении acceptance-20261007.md. Этот агент исходные CSV не читал/повторно не скачивал, независимую проверку не заявляет. Контакты/исходные CSV/приватные снимки не публикуются.

Конкуренция worker/заметок **принята отдельно**: два исходных PostgreSQL 16.15 прогона по 12 сценариев/16 доказанных перекрытий на 3825665. Исходные JSON и concurrency-acceptance-20261007.md не изменены. Real-provider acceptance остаётся до production: использован mock. Post-claim отмена может оставить замороженное уведомление для передачи provider; открытый предел, не найденный дефект конкурентности.

Staff UI отказа начавшегося интервала на новой собственной паре demo-заявок после естественного начала **открыт**. Серверный запрет проверен; UI в этом блоке не выполнялся. Этапы 2/3 не объявлены полностью закрытыми, этап 4 не начат.

Бизнес-логика, миграции/БД, Auth/права, Cron/Vault, worker/Edge Functions и чужие данные не менялись. Production/main, реальные письма/платежи и платные проекты не затронуты. PR остаётся Draft.
