# A4 — атомарный каталог и публикация, 24.10.2026

Локальное продолжение от `2a4ceed1489787e2d53890455cdb6b347f33e966`, отдельный
staff provenance follow-up `6e8926e855867c171b54b9f47947e8233074586d`, затем A4.
Новая миграция: `20261024090606_atomic_catalog_workspace.sql` (25-я локальная).
Ни live SQL/Storage, ни push/deploy/main не выполнялись. Исторические наблюдения
live schema/Edge в manifest не меняются; локальный inventory — 35 hashes.

## Контракт

`save_catalog_product(product_id, expected_version, document, status)` — один
owner-only RPC для полного агрегата: product, variants, options, production
profiles и image metadata. Полные массивы обязаны сохранять существующие child
IDs. Варианты/опции отключаются, не удаляются; существующие ID/SKU и slug не
переименовываются. Снимки заказов, цены, правила вместимости миграция не меняет.
Глобальные builder price rules и категории имеют отдельный маленький CAS RPC
`save_catalog_setting`, их не нужно переписывать при сохранении товара.

Новый товар получает клиентский UUID до загрузки фото и expected_version=0.
Существующий товар сохраняется только при совпадении catalog_version. Advisory
lock + row lock сериализуют редакторов; stale save возвращает SQLSTATE 40001 /
catalog_conflict. UI сохраняет локальный draft, объясняет конфликт и предлагает
явно загрузить текущую карточку с предупреждением о замене draft. Silent overwrite
нет. Неизвестный результат записи также требует reload/CAS, не нового UUID.

Version — непрозрачная возрастающая ревизия: связанные записи тоже touch parent,
поэтому целый save может увеличить её больше чем на 1. Нужна именно версия,
возвращённая сервером. Service-side изменение child также инвалидирует stale
редактор. Полные arrays ограничены 50 variants / 100 options / 20 photos; metadata
document — 150000 bytes. Все шаги и audit откатываются при любой поздней ошибке.

Private SECURITY DEFINER implementation проверяет auth.uid() + active owner
membership, имеет пустой search_path, фиксированные таблицы/поля. Public wrapper
SECURITY INVOKER. Выполнение от anon запрещено, manager получает Owner access
required. Прямые authenticated INSERT/UPDATE/DELETE для агрегата и настроек
отозваны; старый set_primary_product_image больше не доступен браузеру. Новых
прав Storage нет. Existing RLS и staff read policies сохранены.

## Единый validator

RPC проверяет финальную карточку; deferred constraint triggers вызывают тот же
validator после root/variant/option/image/profile/category изменений, включая
привилегированные service-side writes. Опубликованная карточка требует:

- name + description RU/EN/TH как непустые строки (отсутствующий ключ тоже ошибка);
- активную, переведённую категорию, хотя бы один активный вариант;
- RU/EN/TH активных вариантов и опций, корректный production profile/counts;
- главное изображение и переведённый alt для metadata photos, существование
  объекта catalog-demo по пути именно этого товара;
- legacy image_path допустим только как прежний fallback, когда metadata photos
  отсутствуют. RPC не принимает произвольный новый image_path от клиента.

Пустые draft переводы EN/TH разрешены; RU и структурные поля всё равно валидны.
Published editing сразу обновляет карточку целиком; для незавершённых правок UI
предлагает сначала снять её с публикации. Archive сохраняет данные/ID; restore
возвращает в draft, повторная публикация снова проходит validator.
Metadata primary selection теперь локальная часть draft, применяется только save.

Publication берёт category FOR SHARE: concurrent category disable не может
проскочить между validation и commit. Категории и цены используют собственный
expected_version. Устаревший foundation CHECK на шесть имён категорий удалён;
существующий catalog_categories FK остаётся источником допустимых категорий.
Новые категории/товары миграцией не создаются.

## Storage и orphan policy

Upload и SQL **не одна транзакция**. Owner сначала загружает WebP/PNG/JPEG до 5 MiB
по уникальному products/productUUID/imageUUID path с upsert=false. Проверяются
MIME/size и alt; серверная bucket policy/лимиты уже существовали. Затем один RPC
сохраняет все metadata. SQL проверяет объект в Storage metadata, а не содержимое
blob/его фактическую HTTP-доступность — это не live file acceptance.

Если поздний шаг падает, прежняя карточка/фото остаются. Кандидат сохраняется в
локальном draft, повторный save не загружает его второй раз. При timeout после
commit файл уже может быть связан: никакого автоматического remove нет, включая
error path. Старые фото не удаляются и не перезаписываются. Права на удаление не
добавляются. При закрытии/reload неиспользованный кандидат может стать orphan.
Это сознательный retention до отдельной безопасной сверки, не готовый GC.
Потеря подтверждения самого upload тоже может оставить orphan; этот шаг не
обещает exactly-once загрузку bytes. До подтверждённого upload metadata не
публикуются, действующие фото сохраняются. Quota/retention требуют отдельной
операторской приёмки, а не автоматического удаления по одному сетевому ответу.

Для будущей **read-only** инвентаризации оператор может сравнить Storage objects
catalog-demo с product_images.storage_path. Unreferenced объект ещё может быть
in-flight кандидатом: нужен достаточный age grace, отсутствие незавершённых
редакторов/операций, повторная проверка ссылок непосредственно перед согласованной
очисткой. Здесь нет delete script/job и не запускалась live инвентаризация.
Нельзя удалять blob прямым SQL по storage.objects; любые будущие удаления — через
Storage API после отдельного решения. До Preview drill остаётся hosted Storage
acceptance и наблюдение за orphan/quota. Полную согласованность с внешним
привилегированным удалением blob этот RPC обещать не может.

## Проверки

`atomic-catalog.test.mjs`: actual SQL + actual CatalogWorkspace script в PGlite.
Поздний option failure и отсутствующий photo object откатывают root/children/
profiles/version/audit; CAS stale save, новые категории и category/price CAS;
disable last variant; пустые и отсутствующие EN/TH; primary/alt/profile;
owner/manager/anon + запрет обходных writes; archive/restore; неизменность старого
order snapshot и capacity при изменении цены для нового заказа; upload once,
ошибка, timeout-after-commit, конфликт и explicit reload без удаления blob.

`test-catalog-postgres.mjs`: cached PostgreSQL 17.11, новый собственный container
--network none, без портов/host mounts, synthetic Auth/Storage scaffold. **4 PASS**:
два реальных psql сеанса с одинаковой expected_version; поздний rollback;
deferred guard для service disabling last variant; concurrent category disable
против publication. Наблюдались idle transaction и pg_blocking_pids — это не
эмуляция очередью PGlite. Только собственный exact container ID с label/name/
network проверяется и удаляется, включая anonymous volumes. containerRemoved=true.
CI добавлен такой же тест с уже используемым pinned PostgreSQL 16.15 image;
новый CI ещё не запускался. Branch/event/deploy gates не расширены.

Финальный portable прогон с `node --test --test-concurrency=1` (все security files,
кроме preview-release-execution): **79/79 PASS**, без skips. Штатный SQL harness:
**25 migrations + 4 suites PASS**. Build: **32 routes / exit 0**. Typecheck при
отдельном последовательном запуске: **exit 0**, известный vue-router/volar warning.
Scanners: **308 tracked files / 77 built text assets PASS**, manifest 35 hashes
PASS, git diff --cached --check PASS.

Предыдущий parallel portable snapshot не скрывается: **76/77, exit 1** — worker
secret-scan.test.mjs упал на native bootstrap с `Cannot find native builtin:
internal/heap_utils`, до запуска трёх его test cases. Отдельный concurrent
typecheck завершился native exit -2147483645 без TS diagnostics. Причина runtime
crash здесь не доказана. После завершения других процессов serial прогон тех же
assertions дал 79/79 и typecheck 0; harness/assertions ради этого не ослаблялись.
Default parallel Windows aggregate на финальном состоянии не объявляется PASS.
33 Git Bash release scenarios A1 не перезапускаются после зафиксированной
блокировки независимого review; общий Linux CI остаётся обязательным.

## Оставшиеся границы

Read-only проверка **локального migration fixture** обнаружила published
`custom-gift` и `celebration-set` без полных description RU/EN/TH. Это состояние
seed, не результат live проверки. Контент автоматически не сочиняется и цены не
меняются. Validator не переписывает старые строки при установке, но отклоняет
новое сохранение неполной published карточки. Для её исправления можно заполнить
переводы или снять в draft. Category save может потребовать сначала исправить
такие связанные published карточки. Перед rollout нужен owner content preflight;
отсутствие новых дефектов SQL не равно полной готовности текущего каталога.

Полный fixed-SHA review и Linux aggregate CI впереди. Старый admin, пишущий
таблицы напрямую, после миграции получит permission denied: нужно согласовать
frontend/schema rollout и кеш/reload. Не откатывать права обратно ради старого UI;
безопасный fallback — временно закрыть редактор, оставить read-only storefront.
RLS/service parity и реальные Storage операции требуют отдельного Preview drill.
Далее — отдельный dependency triage/cleanup без npm audit fix --force, затем этап
4 published retrieval/evals и общая demo-приёмка. Это не коммерческий запуск.
