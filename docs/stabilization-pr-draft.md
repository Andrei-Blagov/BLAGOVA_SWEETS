Checkpoint стабилизации устраняет потерю результата заявки после timeout,
клиентское происхождение assistant/source, частичные записи каталога и неполное
восстановление Preview. Checkout и chat разрешают минимальный pending intent по
независимой capability; первичные уведомления сохраняются атомарно в outbox.
Каталог сохраняется owner-only aggregate RPC с CAS и публикационными инвариантами.

Этот Draft PR предназначен для Linux aggregate CI и независимого review, база —
prototype/pattaya-atelier. Main и существующий PR #1 не меняются. Auto-merge и
Preview deployment не запрашиваются. Итоговый head SHA и результаты CI заполнить
при создании: локальные проверки не заменяют этот aggregate.

A5 local: targeted 8/8, portable serial 85/85, typecheck/server build exit 0.
Static generate exit 1 / EPERM при mkdir node_modules/.cache/nuxt/.nuxt/prerender/
chunks/build; тяжёлые проверки остановлены без смены прав/reinstall/reset.
Native Windows instability не считается закрытой. Full audit: 9 high/6 moderate/
0 critical, runtime 0. Это candidate checkpoint с обязательной Linux проверкой.

Включены A1 recovery regression tests, A2 actual UI/Edge/SQL и receipt/outbox,
A3 server provenance/limits и staff legacy warning, A4 atomic catalog/CAS с
реальными independent PostgreSQL sessions, A5 dependency triage/точечные fixes.
Подробности: docs/CURRENT_STATE.md, docs/RELEASE_MANIFEST.json и датированные
stabilization/dependency reports.

Перед rollout остаются совместимость schema/Edge/frontend, owner descriptions
двух demo builders, hosted Storage/Auth/PostgREST acceptance, release/source parity
и OVH recovery drill. Native Windows Node instability открыта. Сохраняются
оставшиеся build/dev audit findings; gates/permissions не ослаблены. Published
knowledge retrieval/evals этапа 4 пока не реализован. Бизнес — собственная
кондитерская с маленькой уютной кофейней; это demo checkpoint, не коммерческий запуск.
