# BLAGOVA SWEETS — Preview deployment

Preview публикует только демонстрационные данные из ветки `prototype/pattaya-atelier` по адресу `https://preview.blagovasweets.com`. Он не является production, не принимает оплату и не подключает LINE или другие production-интеграции.

Стенд введён в эксплуатацию 23 сентября 2026 года. DNS `A` указывает на `135.125.199.21`; автоматический HTTPS и перенаправление HTTP обслуживает существующий Caddy на VPS OVH.

## Архитектура

- GitHub Actions сначала выполняет job `verify`, затем строит Docker image с тегом commit SHA.
- Image проверяется локальным healthcheck и передаётся на VPS по SSH с обязательной проверкой `known_hosts`.
- На VPS используется отдельный каталог, отдельный Compose project и один Nginx-контейнер без публичного host port.
- Существующий Caddy подключается к контейнеру по внешней Docker-сети и завершает HTTPS. Caddy автоматически перенаправляет HTTP на HTTPS.
- Миграции Supabase не входят в deployment workflow.
- Предыдущий image и предыдущие Compose/env-файлы сохраняются. Если новый контейнер не становится healthy, deployment script автоматически возвращает предыдущую версию.

Фактическая конфигурация VPS:

| Компонент | Значение |
| --- | --- |
| ОС | Ubuntu 24.04.4 LTS |
| Docker / Compose | Docker 29.7.2 / Compose 5.5.0 |
| Каталог Preview | `/opt/blagova-sweets-preview` |
| Compose project | `blagova-sweets-preview` |
| Сервис / контейнер | `storefront` / `blagova-sweets-preview-storefront-1` |
| Proxy network | `n8n_n8n_net` |
| Caddy | существующий контейнер `n8n-caddy`, Caddy 2.11.4 |

Первый managed deployment не потребовал изменения Caddyfile: отдельный host-блок Preview и общая сеть уже существовали и прошли `caddy validate`. Поэтому Caddy, n8n, PostgreSQL и остальные проекты не перезапускались. Старый Preview-контейнер сохранён остановленным под именем `blagova-sweets-preview-legacy-20260923-153013`, его image дополнительно архивирован в `backups/20260923-153013-legacy-image.tar.gz`.

## Read-only аудит перед первым изменением VPS

Выполнить от имени пользователя с доступом к Docker. Команды ничего не меняют:

```bash
uname -a
cat /etc/os-release
df -h
docker version
docker compose version
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Networks}}'
docker network ls
docker network inspect "$PREVIEW_PROXY_NETWORK"
test -d "$PREVIEW_DEPLOY_DIR" && find "$PREVIEW_DEPLOY_DIR" -maxdepth 2 -type f -print
docker inspect "$PREVIEW_CADDY_CONTAINER" --format '{{json .Mounts}}'
docker exec "$PREVIEW_CADDY_CONTAINER" caddy version
docker exec "$PREVIEW_CADDY_CONTAINER" caddy validate --config /etc/caddy/Caddyfile
```

Отдельно проверить DNS:

```bash
dig +short A preview.blagovasweets.com
dig +short AAAA preview.blagovasweets.com
```

## GitHub Environment `preview`

Deployment job читает только environment secrets. Значения не добавляются в repository files, Docker build args или frontend:

| Secret | Назначение |
| --- | --- |
| `PREVIEW_SSH_HOST` | VPS hostname или IP |
| `PREVIEW_SSH_PORT` | SSH port |
| `PREVIEW_SSH_USER` | отдельный deploy-пользователь |
| `PREVIEW_SSH_PRIVATE_KEY` | приватный ключ только для Preview deployment |
| `PREVIEW_SSH_KNOWN_HOSTS` | заранее проверенная строка host key; workflow не использует `ssh-keyscan` |
| `PREVIEW_DEPLOY_DIR` | отдельный абсолютный каталог, рекомендуемо `/opt/blagova-sweets-preview` |
| `PREVIEW_PROXY_NETWORK` | существующая Docker-сеть Caddy |
| `PREVIEW_COMPOSE_PROJECT` | уникальное имя, рекомендуемо `blagova-sweets-preview` |

Доступ ключа следует ограничить командой/пользователем настолько, насколько допускает текущая VPS-конфигурация. Workflow не передаёт deployment secrets в job `verify` и не запускает deployment на событии `pull_request`. Deployment и служебные операции дополнительно проверяют точный ref `refs/heads/prototype/pattaya-atelier`.

Environment branch policy оставлена без отдельного ограничения по решению владельца; обязательное ограничение ветки реализовано в workflow. Переменная `PREVIEW_DEPLOY_ENABLED` больше не используется: GitHub Environment variables недоступны в job-level `if` до назначения Environment.

## Первый запуск на VPS

После read-only аудита создать резервную копию Caddyfile и отдельный каталог. Не перезапускать n8n, PostgreSQL или другие проекты:

```bash
sudo install -d -o "$USER" -g "$USER" -m 750 "$PREVIEW_DEPLOY_DIR"
sudo cp -p "$PREVIEW_CADDY_CONFIG" "$PREVIEW_CADDY_CONFIG.backup-before-blagova-preview"
```

Добавить отдельный блок из `deploy/Caddyfile.preview` в host-local Caddyfile, затем сначала проверить и только потом reload:

```bash
docker exec "$PREVIEW_CADDY_CONTAINER" caddy validate --config /etc/caddy/Caddyfile
docker exec "$PREVIEW_CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile
```

Первый managed deployment выполнен через push после успешного `verify`. GitHub Actions создаёт каталог с узким `sudo install -d`, после чего все файлы и Docker-команды выполняются пользователем deployment.

## Автоматический и ручной повторный деплой

- Каждый `push` в `prototype/pattaya-atelier` после успешного `verify` автоматически запускает `deploy-preview`.
- Для ручного повтора без нового commit открыть успешный push-run в GitHub Actions и выбрать `Re-run all jobs`: `verify` выполнится заново, после него — deployment того же SHA.
- Workflow содержит `workflow_dispatch` с операциями `deploy`, `audit` и `restart`. GitHub показывает этот запуск из UI только когда соответствующий workflow присутствует в default branch; до отдельного решения о merge безопасным ручным способом остаётся повтор push-run.
- Для read-only проверки VPS можно отправить commit с маркером `[preview-audit]`: после `verify` запустится только audit job, deployment будет пропущен.
- Для контролируемой проверки перезапуска можно отправить commit с маркером `[preview-restart]`: после `verify` и deployment перезапускается только сервис `storefront`, затем повторно проверяются health и anti-indexing headers.
- Pull request, другая ветка и `main` не получают доступ к environment secrets и не выполняют deployment job.

## Логи и состояние

```bash
cd "$PREVIEW_DEPLOY_DIR"
docker compose --project-name "$PREVIEW_COMPOSE_PROJECT" --env-file .env -f docker-compose.preview.yml ps
docker compose --project-name "$PREVIEW_COMPOSE_PROJECT" --env-file .env -f docker-compose.preview.yml logs --tail 200 storefront
docker inspect "$(docker compose --project-name "$PREVIEW_COMPOSE_PROJECT" --env-file .env -f docker-compose.preview.yml ps -q storefront)" --format '{{json .State.Health}}'
cat state/current-release
```

Логи Caddy нужны только для диагностики proxy/TLS и читаются без перезапуска контейнера:

```bash
docker logs --tail 200 n8n-caddy
```

Не публиковать полный `.env`, `docker inspect` всего окружения или GitHub secret values в тикетах и чатах.

## Откат

Автоматический откат выполняется при неуспешном healthcheck новой версии. Для ручного отката:

```bash
current_release=$(cat "$PREVIEW_DEPLOY_DIR/state/current-release")
bash "$PREVIEW_DEPLOY_DIR/releases/$current_release/rollback-preview.sh" "$PREVIEW_DEPLOY_DIR"
```

Скрипт меняет текущую и предыдущую версии местами, запускает Compose без build и завершает работу только после healthy-состояния. Docker images автоматически не удаляются.

## Проверка после deployment

1. `http://preview.blagovasweets.com` перенаправляет на HTTPS.
2. `https://preview.blagovasweets.com/health` возвращает `200` и `ok`.
3. Ответы содержат `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`.
4. Главная, каталог, карточка товара, корзина и тестовый checkout открываются без ошибок.
5. Demo-заказ создаётся с `is_demo`; оплата не запрашивается.
6. Чат создаёт тестовую переписку/заявку и не получает CORS-ошибок.
7. `/login` открывается, валидный тестовый сотрудник может войти в `/admin`.
8. После `docker compose restart storefront` healthcheck снова становится healthy и сайт отвечает.
9. Сгенерированные файлы и логи не содержат server-side secret names или credential patterns.
10. Проверены `OPTIONS` для всех пяти Edge Functions с origin Preview и отказ неизвестному origin.

Для проверки форм использовать только вымышленные контакты. Реальные клиентские данные в Preview не вводить.

## Проверка первого managed deployment

- GitHub Actions push-run `35881828062`: первый успешный managed deployment.
- GitHub Actions push-run `35885362750`: успешные `verify`, повторный deployment и изолированный restart-тест.
- После restart контейнер `blagova-sweets-preview-storefront-1` вернулся в состояние `running/healthy`, `/health` ответил `200`.
- Создан demo-заказ `BLG-C50A23A7` (`is_demo=true`, без оплаты) и тестовая заявка чата; обе записи подтверждены в тестовом Supabase.
- Проверены главная, каталог, карточка товара, корзина, checkout, доступность интервалов, чат, `/login`, защищённый `/admin` и локальная `/demo-admin`.
- Во всех пяти browser-facing Edge Functions развёрнутый код содержит `https://preview.blagovasweets.com` и пустой `204` для разрешённого preflight.
- В логах GitHub secrets замаскированы; repository и built-assets scanners не нашли credential patterns.
