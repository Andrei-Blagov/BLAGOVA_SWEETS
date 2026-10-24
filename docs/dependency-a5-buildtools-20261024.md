# A5.2 — targeted build dependencies, 24.10.2026

Продолжение после Nodemailer 4e58d7d. `npm update` применён только к четырём
названным транзитивным пакетам, сначала lock-only с просмотром полного diff:

| Пакет | Было | Стало | Потребитель |
|---|---|---|---|
| launch-editor | 2.14.1 | 2.14.2 | @nuxt/devtools 3.4.2 |
| serialize-javascript | 7.1.2 | 7.1.4 | @rollup/plugin-terser |
| undici | 8.11.0 | 8.12.3 | nuxt ^8.10.0 dependency range |
| vite | 8.3.0 | 8.3.5 | @nuxt/vite-builder / vite-node |

Нет обновления Nuxt (4.5.2), Vue, Vue Router, Prisma или DevTools adapter. Никаких
audit fix/force/новых overrides. Существующий scoped simple-git override сохранён.
Vite security patch требует более нового Rolldown: 1.2.9 → 1.2.15, его 15 optional
platform bindings и @oxc-project/types; также patch updates postcss/nanoid.
Всего 24 изменённых package records (одна запись magicast меняет metadata без
смены версии). In-place npm install без scripts изменил 9 реально установленных
пакетов Windows. Обе lockfile snapshots сохранены; это не framework major bump и
не утверждение об исправлении native Node crashes.

Проверены upstream sources:
[Windows editor expansion](https://github.com/vitejs/launch-editor/security/advisories/GHSA-698v-4r3x-3vcv),
[Vite custom middleware](https://github.com/vitejs/vite/security/advisories/GHSA-9jrq-w75r-8gcw),
[serializer script ending](https://github.com/yahoo/serialize-javascript/security/advisories/GHSA-m5mm-p8h7-m29v),
[Undici EventSource](https://github.com/nodejs/undici/security/advisories/GHSA-4qv8-2p9j-2685).
Audit также включает остальные editor/Vite и Undici advisories; обновляются и
standalone editor, и встроенная в Vite копия. Одного standalone update недостаточно.

Targeted actual-consumer tests: **8/8 PASS** (включая четыре Nodemailer).
Старые assertions launch-editor argv/Windows command и shell-quote advisory
сохранены. Добавлены отказ CMD percent/linebreak, превращение flag-like filename
в абсолютный путь и actual @rollup/plugin-terser serializer с HTML parse:
adversarial <b> остаётся script text, закрывающий script не появляется.
Serializer сохраняет остальной function source verbatim; он не универсальный
HTML sanitizer. Первый слишком широкий <b>-assert уточнён до его настоящей
границы script + проверки HTML дерева; исходный failed log сохранён.
Никакая команда редактора, SMTP или браузерный script не исполняется.

Свежий full audit: **9 high / 6 moderate / 0 low / 0 critical**, всего 15 package
entries; было 20 (12 high / 7 moderate / 1 low). Critical gate exit 0. Runtime
gate после Nodemailer чист; финальный повтор и integration checks — в A5 отчёте.
Оставшиеся Nuxt/Nitro/node-forge, Tailwind/PostCSS, Prisma/deepmerge-ts не скрываются
и не считаются безопасными. Следующий выбор требует отдельного проверяемого
upstream изменения; major auto-fix Prisma/Tailwind не применяется.

Чистое npm ci, полный Linux aggregate и повторный fixed-SHA review остаются
обязательными. Локальный actual installed state проверен, но clean reinstall на
нестабильном Windows здесь не выполнялся. При новом native crash тяжёлые проверки
будут остановлены, не заменены другим успешным режимом.
