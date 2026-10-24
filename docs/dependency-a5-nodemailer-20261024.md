# A5.1 — Nodemailer, 24.10.2026

Точечный security update: 10.0.10 → **10.1.4**, exact dependency + lockfile.
Nuxt/Vue/Prisma и серверная бизнес-логика не меняются. Из package nodes меняется
только Nodemailer (и root dependency spec). npm также сортирует devDependencies.

Три подтверждённых upstream parsing advisories исправлены в 10.1.4:
[nested comments](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-8c8m-p3m8-cjg8),
[group semicolon](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-m943-m63m-w62w),
[quoted angle address](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-85x2-q946-cp5h).
На старом установленном 10.0.10 четыре синтетических envelope tests дали **0/4**:
получатель ошибочно попадал в outside.invalid. Это подтверждение дефекта библиотеки,
не live эксплуатации BLAGOVA: static Nginx Preview не исполняет Node handlers.

На реальном 10.1.4 проверяются parser mailbox и точный stream-transport envelope,
без SMTP; net/tls connect замоканы с assert.fail. В quoted-local-part случае
mime-node намеренно заменяет <> на пробелы: тест проверяет отдельно исходный
parser mailbox и нормализованный безопасный envelope. Первое ожидание literal
envelope было уточнено по установленному _normalizeAddress; история 0/4 и 3/4
до уточнения сохранена. Финальный результат: **4/4 PASS**, реальные письма не идут.

Во время установки обнаружено расхождение hidden npm lock (10.1.4) и реальных
файлов (10.0.10). Сохранён и удалён только локальный node_modules/.package-lock.json;
целевая in-place установка без scripts/force изменила один пакет. Версия реального
package.json проверена. Node/Docker не переустанавливались; это не исправление
нативной нестабильности Windows. Чистое воспроизведение npm ci остаётся для Linux CI.

Runtime audit после обновления: 0 vulnerabilities, gate exit 0. До него была
одна moderate находка. Полный начальный audit: 12 high / 7 moderate / 1 low /
0 critical; оставшиеся build/dev зависимости не объявляются безопасными.
Prisma/GSAP/dotenv и legacy server routes пока сохранены после проверки ссылок и
build:server. Подробная A5 достижимость и план публикации следуют отдельным документом.
