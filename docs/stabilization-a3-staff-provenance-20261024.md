# A3 — staff provenance follow-up, 24.10.2026

Независимый review `2a4ceed` закрыл обе A2 P2, но воспроизвёл отдельную P2:
staff readMessages возвращал старый browser-controlled assistant source как
«Материал», хотя public RPC уже скрывал его и помечал ответ непроверенным.

Добавлена проекция projectStaffMessage в реальный staff reader: source не
считается доказательством, assistant/system без распознанного server policy
`handoff-v1` получают unverified. Unknown future policy тоже не считается
проверенной. Шаблон явно показывает предупреждение для demo-истории.
Тела сообщений и роли manager/owner сохраняются; записи БД не переписываются.
Новые server handoff ответы не получают ложное legacy-предупреждение.
Published retrieval и источники остаются отдельным этапом 4.

Regression staff-chat-provenance.test.mjs использует настоящий readMessages из
admin.vue, RLS-чтение под manager и owner, actual Vue template/SSR render.
Проверяются legacy assistant/system, server handoff, staff replies, скрытие
поддельного source и сохранность исходных исторических записей.
Synthetic disposable-only, без live SQL/deploy. Результат: 1/1 PASS.
Этот follow-up коммит отдельный от незавершённого A4.
