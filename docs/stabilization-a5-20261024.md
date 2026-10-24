# A5 — dependency/legacy checkpoint, 24.10.2026

Локальный пакет поверх A4 `610ce0c8b9bb024529cbf84a01ee8a0ce99825fc`.
Push/PR/deploy/main, live SQL/Storage, письма/платные API не выполнялись. Этап 4
knowledge не начинался. Права, CI gates, Node/Docker и network/credentials не менялись.

## Независимый review A4

По сообщению координирующего чата 24.10, limited fixed-SHA review **610ce0c**
завершён: staff provenance P2 закрыта, новых подтверждённых P1/P2 не найдено.
Прошли 6/6 авторских targeted и 4 независимых сценария на 25 migrations/PGlite:
late image rollback, CAS/publication, owner/direct-write запреты, archive→draft,
historical snapshots. Hosted Storage/Auth/PostgREST, реальная PG concurrency,
build/typecheck и Linux aggregate независимо не повторялись. Этот результат не
распространяется автоматически на A5 commits. Windows native instability открыта.

## Audit и изменения

| Registry snapshot 24.10 | High | Moderate | Low | Critical | Package entries |
|---|---:|---:|---:|---:|---:|
| Full до | 12 | 7 | 1 | 0 | 20 |
| Full после | 9 | 6 | 0 | 0 | 15 |
| Runtime до | 0 | 1 | 0 | 0 | 1 |
| Runtime после | 0 | 0 | 0 | 0 | 0 |

Оба неизменённых gate exit 0: runtime omit dev/optional блокирует high, full —
critical. Это package findings, не доказательство live exploitation или полной
безопасности приложения. npm audit не сканирует Nginx/OS/hosted Supabase.

- **4e58d7d:** exact Nodemailer 10.1.4, [package proof/тесты](dependency-a5-nodemailer-20261024.md).
  Старый 10.0.10 давал 0/4 на синтетических recipient cases, новый 4/4. Нет SMTP.
- **7528e42:** editor 2.14.2, serializer 7.1.4, Undici 8.12.3, Vite 8.3.5;
  [граф, sources и проверки](dependency-a5-buildtools-20261024.md).
  Vite требует patch семейства Rolldown 1.2.15: 24 lock records, 9 реально
  установленных Windows packages. Nuxt 4.5.2/Vue/Router/Prisma версии сохранены.
- Старый auto cart plugin перенесён в legacy/nuxt/cart.client.ts. Current Atelier
  store/persistence не меняются; browser storage не очищается. Generated
  plugins.d.ts содержит atelier/catalog/operations/supabase, без старого cart.

Lockfile v3/integrity сохранены, npm согласовал root specs. Stale hidden npm lock
10.1.4 при реальных файлах 10.0.10 был сохранён и удалён только как metadata;
in-place updates без scripts/force проверены по реальным package.json. Не было
clean reinstall среды или объявления этого лечением Node crashes. Fresh npm ci
с штатным postinstall должен подтвердить Linux CI.

## Достижимость и что оставлено

| Элемент | Фактическая роль и решение |
|---|---|
| Supabase JS / Vue / Router | Atelier client/Auth UI, сохранены; runtime audit 0 |
| Nuxt/Vite/Tailwind/PostCSS | Build/dev graph; финальный static image содержит Nginx + .output/public |
| Nodemailer | server/utils/notifications.ts → два legacy Node handlers; Edge outbox его не использует. Сохранён для build:server |
| Prisma/@prisma/client | MySQL schema/config/generator, исполняемого PrismaClient import в app/server нет. CLI сценарий сохраняется, пакеты не удалены |
| dotenv | Явный import в prisma.config.ts; оставлен вместе с config |
| GSAP | AboutCarousel/ProductCard imports остаются; classic chain не используется актуальными Atelier pages/layout, пакет не удаляется без проверки/архивации этой цепочки |
| legacy/contact.php | Вне public; в Nginx image нет PHP runtime |
| useCart / classic UI | Сохранены; лишний auto bootstrap перемещён, текущий useAtelier независим |

[Карта файлов](../legacy/README.md). README теперь отделяет актуальную кондитерскую
со своей маленькой кофейней и Supabase/static архитектуру от исторического
PHP/SMTP/MySQL описания. История/возможные CLI modes не удаляются вслепую.

При generate/Nginx Node API не исполняются. В dev/build:server они входят в graph;
обычный /api блокируется prototype middleware. Case variants/полная HTTP acceptance
не проверялись — абсолютная недостижимость и Node production не утверждаются.
Server artifact только компилировался, сервер не запускался, HTTP/SMTP/Telegram
не вызывались. Старые orders.json/contacts.json не читались и не менялись.

Осталось: Nuxt/Nitro/listhen/node-forge — 6 high entries; Prisma/config/deepmerge-ts
— 3 high; Tailwind/PostCSS и @nuxt/vite-builder — 6 moderate. Major Prisma 7.10.1,
Tailwind 4 или cross-major parser override не применяются. Nuxt 4.6.2 виден в
registry, но framework/router update отложен до проверяемого Linux checkpoint.
Untrusted build/config threats сохраняются; config recursion не объявляется
доказанной публичной уязвимостью сайта. Root Router 4.x / Nuxt Router 5.x и volar
warning — открытый технический долг. Hosted/source parity здесь не проверялся.

## Проверки и blocker

Тяжёлые фазы шли строго по очереди, guard остановил цепочку при первом nonzero.
Новых native signatures A5 не дал; прежняя Windows Node v24.19.0/npm 11.17.0
нестабильность не считается устранённой.

| Проверка | Результат |
|---|---|
| Targeted actual-consumer package tests | 8/8 PASS, network/process calls запрещены |
| Portable security --test-concurrency=1 | **85/85 PASS**, без skips; 33 Git Bash release scenarios явно исключены |
| Typecheck | exit 0, прежний vue-router/volar warning |
| build:server | exit 0, 3.31 MB; сервер не запущен |
| static build / generate | **exit 1 / EPERM mkdir**; свежий static release не принят |
| Full critical / runtime high audit gates | exit 0, counts выше |

Точная заблокированная операция: `npm run build` → async mkdir
`C:\Users\Andrei\Documents\Codex\2026-10-24\task\audit-checkout\node_modules\.cache\nuxt\.nuxt\prerender\chunks\build`.
Лог: EPERM operation not permitted. Корневая причина не установлена; после отказа
путь существует как обычная Directory без link/reparse target. Это не native
stack. Не было retry/elevated generate, ACL changes, cache wipe, Node reinstall
или Docker reset. Тяжёлая часть остановлена. Partial .output не является
проверенным release; built-assets scanner не выдаётся за полную static acceptance.

Предыдущие A4 32-route build и 25 migrations/4 suites не заменяют этот A5 failure.
Backend source inventory 35 hashes/25 migrations неизменен; PG drill ради
dependency-only cleanup не повторялся. Repository scanner: 316 tracked files
PASS, manifest 35 hashes PASS, git diff --cached --check PASS. Built-assets check
как acceptance нового static release не выполнялся после failed generate.

[План публикации](STABILIZATION_PUBLICATION_PLAN.md) и [Draft body](stabilization-pr-draft.md)
готовы, но действий публикации нет. Feature→prototype Draft предназначен для
Linux aggregate: fresh npm ci, generate, shell/security/SQL/concurrency и scanners.
До этого кандидат не принят к rollout. A4 content preflight/hosted acceptance/
recovery drill остаются. Knowledge этап 4 ждёт общего checkpoint; main и другие
OVH-сервисы сохраняются.
