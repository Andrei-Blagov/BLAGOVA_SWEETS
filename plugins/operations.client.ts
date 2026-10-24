import { statuses } from '~/data/operations';
import type { OperationsState } from '~/data/operations';
export default defineNuxtPlugin(() => {
  const {
    state,
    ready,
    storageWarning
  } = useOperations();
  const key = 'blagova-operations-demo-v1';
  const string = (x: unknown) => typeof x === 'string';
  const valid = (s: any): s is OperationsState => s?.version === 1 && Array.isArray(s.orders) && s.orders.length <= 100 && s.orders.every((o: any) => o && ['id', 'requestKey', 'customer', 'contact', 'date', 'slot', 'address', 'note', 'createdAt'].every(k => string(o[k])) && ['website', 'chat'].includes(o.source) && ['pickup', 'delivery'].includes(o.mode) && statuses.some(s => s.id === o.status) && Number.isFinite(o.total) && Number.isFinite(o.delivery) && Array.isArray(o.items) && o.items.length > 0 && o.items.every((i: any) => string(i.name) && string(i.detail) && Number.isFinite(i.price) && i.price >= 0 && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 20) && Array.isArray(o.history) && o.history.every((h: any) => string(h.at) && string(h.text))) && Array.isArray(s.conversations) && s.conversations.some((c: any) => c.id === 'web-demo') && s.conversations.every((c: any) => string(c.id) && string(c.name) && ['bot', 'requested', 'manager'].includes(c.mode) && Array.isArray(c.messages) && c.messages.length <= 120 && c.messages.every((m: any) => string(m.id) && string(m.text) && string(m.at) && ['customer', 'assistant', 'manager'].includes(m.role))) && Array.isArray(s.knowledge) && s.knowledge.every((k: any) => string(k.id) && string(k.title) && string(k.keywords) && string(k.updatedAt) && ['draft', 'published'].includes(k.status) && k.answers && ['ru', 'en', 'th'].every(l => string(k.answers[l])));
  onNuxtReady(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        if (valid(saved)) state.value = saved;else storageWarning.value = true;
      }
    } catch {
      storageWarning.value = true;
    }
    window.addEventListener('storage', event => {
      if (event.key !== key || !event.newValue) return;
      try {
        const saved = JSON.parse(event.newValue);
        if (valid(saved)) state.value = saved;
      } catch {/* Ignore invalid data from another tab. */}
    });
    ready.value = true;
    watch(state, value => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        storageWarning.value = true;
      }
    }, {
      deep: true
    });
  });
});
