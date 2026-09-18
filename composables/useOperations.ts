import { bangkokDate, seedOperations, statuses, transitions } from '~/data/operations';
import type { DemoOrder, OrderStatus, ChatMessage, KnowledgeArticle, OperationsState } from '~/data/operations';
export function useOperations() {
  const state = useState<OperationsState>('atelier-operations', seedOperations);
  const ready = useState('operations-ready', () => false);
  const storageWarning = useState('operations-storage-warning', () => false);
  const chatOpen = useState('operations-chat-open', () => false);
  const thread = computed(() => state.value.conversations.find(c => c.id === 'web-demo')!);
  const statusLabel = (status: OrderStatus) => statuses.find(s => s.id === status)?.label || status;
  function message(role: ChatMessage['role'], text: string, source?: string, id = 'web-demo') {
    const conversation = state.value.conversations.find(c => c.id === id);
    if (!conversation || !text.trim()) return;
    conversation.messages.push({
      id: demoId(),
      role,
      text: text.trim().slice(0, 2500),
      at: new Date().toISOString(),
      source
    });
    conversation.messages = conversation.messages.slice(-120);
  }
  function createOrder(input: Omit<DemoOrder, 'id' | 'createdAt' | 'history' | 'status' | 'total'>) {
    const found = state.value.orders.find(o => o.requestKey === input.requestKey);
    if (found) return found;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < bangkokDate() || !input.customer.trim() || !input.contact.trim() || !input.items.length || !Number.isFinite(input.delivery) || input.delivery < 0 || input.items.some(i => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 20 || !Number.isFinite(i.price) || i.price < 0)) throw new Error('Проверьте данные демо-заказа.');
    if (state.value.orders.length >= 100) throw new Error('Лимит демо: 100 заказов.');
    const now = new Date().toISOString();
    const order: DemoOrder = {
      ...input,
      items: input.items.map(i => ({
        ...i
      })),
      id: 'DEMO-' + demoId().slice(0, 8).toUpperCase(),
      total: input.items.reduce((s, i) => s + i.price * i.quantity, input.delivery),
      status: 'pending',
      createdAt: now,
      history: [{
        at: now,
        text: 'Заявка записана в локальную демо-админку. Внешние сервисы не подключены.'
      }]
    };
    state.value.orders.unshift(order);
    return order;
  }
  function changeStatus(id: string, next: OrderStatus) {
    const order = state.value.orders.find(o => o.id === id);
    if (!order || !transitions[order.status].includes(next)) return;
    order.status = next;
    order.history.push({
      at: new Date().toISOString(),
      text: statusLabel(next)
    });
  }
  function reschedule(id: string, date: string, slot: string) {
    const order = state.value.orders.find(o => o.id === id);
    if (!order || ['completed', 'cancelled'].includes(order.status) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < bangkokDate() || !['10:00–12:00', '12:00–15:00', '15:00–18:00'].includes(slot)) return false;
    order.date = date;
    order.slot = slot;
    order.history.push({
      at: new Date().toISOString(),
      text: `Перенос: ${date}, ${slot}. Только локальный календарь.`
    });
    return true;
  }
  function findKnowledge(query: string): KnowledgeArticle | undefined {
    const q = query.toLocaleLowerCase().trim();
    return state.value.knowledge.filter(k => k.status === 'published').map(k => ({
      k,
      score: k.keywords.split(',').filter(w => w.trim() && q.includes(w.trim().toLocaleLowerCase())).length
    })).filter(x => x.score > 0).sort((a, b) => b.score - a.score)[0]?.k;
  }
  return {
    state,
    ready,
    storageWarning,
    chatOpen,
    thread,
    statusLabel,
    message,
    createOrder,
    changeStatus,
    reschedule,
    findKnowledge
  };
}
