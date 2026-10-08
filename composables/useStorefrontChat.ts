import type { Conversation } from '~/data/operations';

type ChatSnapshot = {
  conversationId: string;
  mode: Conversation['mode'];
  messages: Conversation['messages'];
};

type Exchange = {
  customerText?: string;
  assistantText?: string;
  assistantSource?: string;
  requestManager?: boolean;
};

export function useStorefrontChat() {
  const config = useRuntimeConfig();
  const { locale } = useAtelier();
  const chatOpen = useState('storefront-chat-open', () => false);
  const thread = useState<Conversation>('storefront-chat-thread', () => ({ id: 'pending', name: 'Website chat', mode: 'bot', messages: [] }));
  const ready = useState('storefront-chat-ready', () => false);
  const storageWarning = useState('storefront-chat-storage-warning', () => false);
  const busy = useState('storefront-chat-busy', () => false);
  const error = useState('storefront-chat-error', () => '');
  const sessionToken = useState('storefront-chat-token', () => '');
  let timer: ReturnType<typeof setInterval> | undefined;
  let polling = false;

  function apply(snapshot: ChatSnapshot) {
    thread.value = {
      id: snapshot.conversationId,
      name: 'Website chat',
      mode: snapshot.mode,
      messages: Array.isArray(snapshot.messages) ? snapshot.messages : [],
    };
  }

  async function call(action: 'start' | 'poll' | 'send', payload: Record<string, unknown> = {}) {
    const response = await fetch(`${config.public.supabaseUrl}/functions/v1/storefront-chat`, {
      method: 'POST',
      headers: { apikey: config.public.supabasePublishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, token: sessionToken.value, locale: locale.value, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.conversationId !== 'string') throw new Error(response.status === 429 ? 'rate_limit' : result.error || 'service_unavailable');
    apply(result as ChatSnapshot);
  }

  async function initialise() {
    if (!import.meta.client || ready.value) return;
    try {
      const stored = localStorage.getItem('blagova_storefront_chat');
      sessionToken.value = stored && /^[0-9a-f-]{36}$/i.test(stored) ? stored : newUuid();
      localStorage.setItem('blagova_storefront_chat', sessionToken.value);
    } catch {
      sessionToken.value = newUuid();
      storageWarning.value = true;
    }
    try {
      await call('start');
      ready.value = true;
    } catch {
      error.value = 'Чат временно недоступен. Обновите страницу и попробуйте ещё раз.';
    }
  }

  async function refresh() {
    if (!ready.value || polling) return;
    polling = true;
    try { await call('poll'); error.value = ''; }
    catch (failure) {
      if (failure instanceof Error && failure.message === 'session_expired') {
        ready.value = false;
        sessionToken.value = newUuid();
        try { localStorage.setItem('blagova_storefront_chat', sessionToken.value); } catch { storageWarning.value = true; }
        await call('start');
        ready.value = true;
      }
    } finally { polling = false; }
  }

  async function sendExchange(exchange: Exchange) {
    if (!ready.value || busy.value) return false;
    const customerText = exchange.customerText?.trim() || '';
    const assistantText = exchange.assistantText?.trim() || '';
    const customerMessageId = customerText ? newUuid() : '';
    const assistantMessageId = assistantText ? newUuid() : '';
    const now = new Date().toISOString();
    if (customerText) thread.value.messages.push({ id: customerMessageId, role: 'customer', text: customerText, at: now });
    if (assistantText) thread.value.messages.push({ id: assistantMessageId, role: 'assistant', text: assistantText, at: now, source: exchange.assistantSource });
    if (exchange.requestManager) thread.value.mode = 'requested';
    busy.value = true;
    error.value = '';
    try {
      await call('send', { customerMessageId, customerBody: customerText, assistantMessageId, assistantBody: assistantText, assistantSource: exchange.assistantSource || '', requestManager: Boolean(exchange.requestManager) });
      return true;
    } catch (failure) {
      error.value = failure instanceof Error && failure.message === 'rate_limit'
        ? 'Слишком много сообщений. Попробуйте снова через час.'
        : 'Сообщение осталось на экране, но не сохранилось. Проверьте соединение.';
      return false;
    } finally { busy.value = false; }
  }

  onMounted(() => {
    if (chatOpen.value) initialise();
    timer = setInterval(() => { if (chatOpen.value) refresh(); }, 4000);
    window.addEventListener('focus', refresh);
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    window.removeEventListener('focus', refresh);
  });

  return { chatOpen, thread, ready, storageWarning, busy, error, sessionToken, initialise, sendExchange, refresh };
}
