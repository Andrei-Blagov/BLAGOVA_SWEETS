# Совместимое исправление зависимостей CI — 06.10.2026

Исходный HEAD: `565fae692c1da0f8011eb0229304db368ebfe540`, ветка `prototype/pattaya-atelier`, Draft PR №1. Remote HEAD и чистое рабочее дерево сверены перед изменениями. Push `37475078035` и PR `37475086164` завершились failure на полном critical audit; deployment был пропущен. Последний успешный Preview до исправления — `66c0f5052261105627636116c0cb9f5019feb814`.

## Причина и решение

Nuxt 4.5.2 устанавливал DevTools 3.4.2 → simple-git 3.36.0 → argv-parser 1.1.1. Полный audit воспроизвёл 6 critical с учётом родительских пакетов. Обновить только parser недостаточно: simple-git имеет собственные advisory, включая trailer command, configuration includes и сокращённые флаги Git.

Проверены актуальные npm releases: DevTools stable 3.4.2; latest-tag указывает на 4.0.0-beta.4. Документация DevTools описывает переход к архитектуре v4/Vite DevTools, но стабильный v4 в реестре на момент проверки отсутствует. Beta/смена архитектуры не применены.

Применён scoped npm override: DevTools закреплён на 3.4.2, только его simple-git — на стабильной 4.0.2. Lockfile меняет ровно три записи: simple-git 3.36.0 → 4.0.2, argv-parser 1.1.1 → 2.0.1, args-pathspec 1.0.3 → 1.0.4. Source-map-js 1.2.2 сохранён. Nuxt, Vue, Tailwind и Prisma не обновлялись.

Simple-git 4 удалил default export, используемый DevTools. `scripts/patch-devtools-git.mjs` перед `nuxt prepare` заменяет одну строку в установленном chunk: `import Git` → `import { simpleGit as Git }`. Скрипт идемпотентен, проверяет версии обоих пакетов и ожидаемый импорт, при неизвестном upstream останавливает установку. Он не меняет metadata пакетов или audit-результаты. Docker копирует скрипт до npm ci. Все три вызова DevTools (branch/revparse/status) проверены с реальной Git-библиотекой.

## Проверки

- Чистый `npm ci` с postinstall: passed.
- `npm audit --omit=dev --omit=optional --audit-level=high`: 0 vulnerabilities, exit 0.
- `npm audit --audit-level=critical`: 4 moderate, 16 high, 0 critical, exit 0. Рост числа high объясняется переходом родительских Nuxt-пакетов из critical в high после удаления critical-цепочки; audit не стал полностью чистым.
- `npm run test:security`: 55 passed, включая реальный lazy DevTools chunk (его загрузку иначе скрывает enabled=false), branch/revparse/status и отказы unsafe VISUAL/trailer command/include.path.
- `npm run test:database`: 21 application migration и четыре SQL suites passed в PGlite. Новых миграций нет; живая БД не изменялась.
- `npm run typecheck`: exit 0; прежний upstream warning vue-router/volar/sfc-route-blocks сохранён.
- `npm run build`: passed, 32 prerendered routes. `npm run check:secrets` и `npm run check:built-assets`: passed, 266 tracked files и 77 generated text assets. Фактический статус CI и deployment SHA — [PR №1](https://github.com/Andrei-Blagov/BLAGOVA_SWEETS/pull/1).

## Границы и дальнейшее обслуживание

Audit gates и workflow permissions сохранены. Оставшиеся dev/build high и moderate не объявлены безопасными; прежние ограничения статического Nginx Preview сохраняются. Before Node production/build:server пересмотреть весь сборочный стек. При совместимом stable upstream DevTools удалить локальную адаптацию и override только после повторной проверки реального chunk, чистого npm ci и обоих audit.

PR остаётся Draft; main, production, платежи, worker/Cron, Auth, Edge Functions, миграции и правила нагрузки не менялись. Оставшиеся UI/CSV-пункты и настоящая конкуренция worker/заметок не выполнялись и не закрыты.

Первичные источники: [argv-parser advisory](https://github.com/steveukx/git-js/security/advisories/GHSA-v5rq-49vh-5v5c), [trailer command advisory](https://github.com/advisories/GHSA-x6jw-m9v5-85vh), [configuration includes advisory](https://github.com/advisories/GHSA-g4wm-2vf7-vfgr), [DevTools v4 migration](https://devtools.nuxt.com/guide/upgrading-to-v4). Решение проверено по фактическим npm artifacts и установленному коду, а не только по описанию releases.
