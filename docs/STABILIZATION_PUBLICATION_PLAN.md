# Публикация checkpoint стабилизации без Preview

План подготовлен 24.10.2026. **Команды push/PR/merge/dispatch не выполнялись.**
Здесь только отправка проверяемого feature-кандидата и открытие Draft PR для Linux
CI/review. Перенос backend, Preview drill и main — отдельные последующие решения.

## Проверенная исходная точка

- Repo: Andrei-Blagov/BLAGOVA_SWEETS.
- Feature: fix/preview-release-recovery (локальная; remote branch search 24.10
  09:58 UTC не вернул эту ветку).
- Base нового PR: prototype/pattaya-atelier, наблюдаемый remote HEAD
  f6327c34422060a070fe3a7bcde5ad489b1c60b6.
- Main: 31e4171359900d59a5936b57e7603a13dad52990; не трогать.
- Существующий PR #1 prototype → main: open/Draft/mergeable на той же проверке;
  не retarget/merge/close. Новый PR получит собственный номер от GitHub.
- В remote .github/workflows на prototype найден только ci.yml; получен его
  текущий source. Локальные A1/A2/A4 добавляют проверки/recovery, deployment gates
  не расширены. A5 workflow не меняет.

## Что запустится по текущему ci.yml

| Действие | CI | Preview/SSH jobs |
|---|---|---|
| Push только feature без открытого PR | push filter включает только prototype, этот push не запускает CI | Не запускаются |
| Open Draft PR feature → prototype | pull_request запускает postgres-concurrency, затем verify | audit-preview/deploy-preview/restart-preview skipped |
| Следующий push в head открытого PR | pull_request synchronize повторяет проверки | skipped |
| Будущий merge/push в prototype | CI запускается | Обычный push автоматически допускает deploy после verify; нужен отдельный контроль |
| workflow_dispatch на prototype | CI запускается | default input deploy; **не вызывать в этом шаге** |

Draft сам по себе не выключает CI. Для открытого mergeable PR github.ref имеет
вид refs/pull/N/merge, а каждый Preview job требует ровно
refs/heads/prototype/pattaya-atelier. Checkout по умолчанию тестирует merge result,
поэтому сохранить также head SHA и merge SHA из CI. Это соответствует
[GitHub event semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request).

Postgres job использует только ephemeral runner service и собственные disposable
containers. В feature workflow добавлены A2 independent sessions и A4 editor CAS.
Verify выполняет npm ci/postinstall, оба неизменённых audit gates, полные security
tests (включая 33 Linux shell сценария), SQL suites, typecheck, static build и
scanners. Live Supabase migrations/Edge deploy в этих jobs нет. SSH/Preview
environment относится к skipped jobs, не требуется для PR checks.

## Последовательность будущей публикации

1. Получить итоговый immutable SHA после A5 и всех review corrections. Сверить
   чистое дерево и отсутствие секретов; приложить package/lock diff, manifests,
   локальные test logs и границы native Windows checks. A4 review относится только
   к 610ce0c, новые зависимости/cleanup требуют проверки нового SHA.
   A5: portable 85/85, typecheck/server compile прошли; generate остановлен EPERM
   cache mkdir. Этот незакрытый blocker явно включить в Draft: публикация нужна
   для Linux проверки кандидата, не означает принятую сборку или rollout.
2. Непосредственно перед push повторить read-only проверку remote prototype/main,
   origin repository identity без вывода credentials, существования feature и
   workflow gates. При изменении base не делать auto-merge/rebase: сначала
   интеграционный diff, новый SHA и повторный review. Проверить, что GitHub Actions
   CI enabled; repository protection/webhook/provider state этим аудитом не установлен.
3. Подтвердить отсутствие внешнего deployment binding на feature/PR. ci.yml даёт
   гарантию skip только для его jobs; `.openai/hosting.json` содержит static project
   reference, внешние hosting branch filters не читались. Не включать/перенастраивать
   интеграции в рамках публикации. При неизвестном auto-deploy binding остановить push.
4. После отдельного разрешения выполнить обычный **non-force push только feature**:

   ```text
   git push origin HEAD:refs/heads/fix/preview-release-recovery
   ```

   Проверить remote feature SHA против зафиксированного local SHA. Prototype/main
   при этом не обновляются. Dry-run push здесь тоже не выполнялся.
5. Через подключённый GitHub создать Draft PR:
   base=prototype/pattaya-atelier, head=fix/preview-release-recovery,
   title=`[no-preview] Stabilize Preview recovery, intake, chat and catalog`.
   Body: [stabilization-pr-draft.md](stabilization-pr-draft.md), дополнить фактическим
   head SHA и проверками. Прикрепить созданный PR к этой задаче. Не использовать
   `[skip ci]`, не включать auto-merge, не открывать PR в main. GitHub CLI ранее
   падал нативно в этой среде, поэтому его повторный запуск не является условием.
6. По новому PR дождаться Linux postgres-concurrency и verify на актуальном SHA.
   Убедиться, что все три Preview jobs именно skipped. Сохранить jobs/artifacts,
   counts и новый audit; не считать старый A4/local pass новым aggregate CI PASS.
   Если gates не проходят — исправлять кандидат, не ослаблять gates/permissions.
7. Завершить independent review итогового SHA. Оставить PR Draft до общего
   checkpoint; ничего не merge/deploy по одному лишь зелёному CI.

## Последующая интеграция — не входит в публикацию

Схема/Edge/frontend имеют изменённые совместные контракты. До отдельного Preview
rollout нужны owner content preflight двух legacy builders, Storage acceptance,
источник/manifest parity, backup/recovery и согласованный maintenance fallback.
Если позже разрешат перенос в prototype, **реальный** merge/head commit message
должен содержать `[no-preview]`, чтобы push не развернул frontend автоматически
раньше backend. Одного PR title/body для этого недостаточно. Preview deployment
или audit/restart dispatch затем выполняются отдельным осознанным действием.
Main/production/OVH-сервисы других проектов не затрагиваются.

## Предел доступа

GET https://api.github.com/repos/Andrei-Blagov/BLAGOVA_SWEETS/actions/workflows
через GitHub Fetch был отклонён allowlist самого инструмента (400 INVALID_ARGUMENT,
URL not allowed, Response None). Список зарегистрированных/enabled workflows этим
вызовом не получен; повторов/обхода не было. Read-only repo directory/file и PR
metadata получены успешно. Branch protections, hooks и внешние providers остаются
непроверенными и включены в pre-push контроль, а не объявлены отсутствующими.
