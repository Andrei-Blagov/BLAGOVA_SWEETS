# A2 — исправления независимого review, 24.10.2026

Review фиксированного A2 `07333963d4cc29549944a7f006e78891764a2880` воспроизвёл
две P2. Они исправлены отдельным follow-up после A3
`22001ab5436911c6dc1de9f84bce4f88c6314d3f`. Чужие review-adversarial.test.mjs и
review-dependency-loader.mjs прочитаны, не изменены. Исходный A2 snapshot и его
результаты сохранены; наличие 98/99 JS pass не означало отсутствие этих дефектов.

## 1. Каждый caller владеет pending intent

Проверены оба фактических caller submitOrder: checkout и Chat.vue. В usePublicIntake
удалена скрытая генерация memory token: recoveryToken теперь обязателен и
проверяется до fetch. Нельзя случайно переиспользовать key/token с изменённым
payload без собственной recovery-модели.

Chat перед первым submit создаёт отдельный минимальный intent в
sessionStorage `blagova-chat-order-intent-v1`: key, независимый random token,
fingerprints и createdAt/expiresAt. Имя, контакт, адрес, текст, состав и цены туда
не пишутся. Payload заморожен только в памяти до завершения попытки. Пока intent
не разрешён, confirm, Edit, review и startOrder сначала выполняют recovery.
После reload mount восстанавливает сохранённую canonical receipt по capability.
Изменённая в памяти дата не отправляется с прежним key.

Saved → UI использует server reference, Pattaya date/slot, items и totalMinor.
Номер не теряется из-за timeout после commit; дата берётся из сохранённой заявки,
не из нового draft. Unknown → новая отправка/редактирование заблокированы.
Явное resolve(close=true) возвращает saved либо атомарно ставит close fence;
только после closed можно редактировать и создавать новый key. Late submit
старого key отвергается. Ничего не отменяется в уже сохранённом заказе.

## 2. TTL в открытой вкладке

Общий expirePendingIntent сравнивает expiresAt с текущим Date.now перед
recover/close/submit; Chat также проверяет Edit/review/start. При истечении 24h
удаляются token/fingerprints из памяти и sessionStorage, остаётся только
expired identity, блокирующая молчаливое создание новой заявки. Frozen payload
освобождается. Оба UI также планируют cleanup timer до expiresAt; после фоновой
приостановки браузера обязательная проверка перед действием остаётся защитой.
Mount-only expired flag больше не является единственной проверкой.

Если storage отказывается писать, token сначала удаляется из памяти; UI
блокирует действия и сообщает об ошибке очистки. Физическую очистку отказавшего
browser storage код гарантировать не может. Существующий серверный TTL остаётся
независимой границей: исправление не продлевает capability и не меняет RLS.
После истечения срока требуется менеджер, автоматический новый key не создаётся.

## Проверка

`pending-intent-callers.test.mjs` использует реальные Chat.vue/checkout.vue scripts,
реальный usePublicIntake, Edge storefront-order и все 24 migrations в disposable
PGlite. Сценарии:

- commit → потеря ответа → изменённая дата → confirm: один submit/один заказ,
  canonical старая дата/reference/цена/состав;
- тот же saved outcome при Edit и при reload;
- до commit потеря соединения → unknown → блокировка Edit/start → close fence →
  поздний старый submit rejected → новая дата сохраняется с новым key;
- в sessionStorage нет синтетического имени/контакта/SKU/даты заказа;
- оба уже mounted UI после перевода часов за expiresAt не вызывают resolve,
  не submit, удаляют capability; storage write failure всё равно очищает память;
- usePublicIntake без recoveryToken отклоняется до сетевого обращения.

Focused A2 follow-up + F1 + A3: **10/10 PASS**. Synthetic-only, fixture.invalid,
без hosted DB, реальных сообщений, платных API или live нагрузки.
Финальный portable security прогон: **73/73 PASS**, без skips. Первый прогон дал
70/73: три старых stage2 fixtures не предоставляли pending storage и ожидали
клиентский assistant exchange. Fixtures обновлены под новый контракт; assertions
сохраняют проверку pickup/central/jomtien и серверной цены против заведомо
неверного локального каталога, запрещают подделку assistant receipt.
Build: 32 routes, exit 0. Typecheck: exit 0 (известный vue-router/volar plugin warning).
SQL: все 24 migrations + 4 suites PASS. Manifest: 34 hashes PASS. Secret scanners:
301 tracked files / 77 generated text assets PASS. git diff --check PASS.
`preview-release-execution.test.mjs` (33 сценария)
в этот повторный aggregate не входит: независимый Windows Git Bash запуск
заблокирован NtCreateDirectoryObject 0xC0000022, отказ не обходится. Исторические
44 A1 checks не заменяют текущий полный Linux CI.

Независимая повторная проверка исправлений должна использовать итоговый
follow-up SHA из git log. Дальше — A4 atomic catalog save/publication/CAS;
публикация только после fixed-SHA review и общего Linux CI, затем отдельная
координация Preview schema/Edge/frontend и recovery drill. Ничего не push/deploy.
