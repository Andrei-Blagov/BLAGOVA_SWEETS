import type { Conversation } from '~/data/operations';

type ChatSnapshot = {
  conversationId: string;
  mode: Conversation['mode'];
  messages: Conversation['messages'];
};

type Exchange = {
  customerText?: string;
  requestManager?: boolean;
};

export function useStorefrontChat() {
  const config = useRuntimeConfig();
  const { locale, t } = useAtelier();
  const chatOpen = useState('storefront-chat-open', () => false);
  const thread = useState<Conversation>('storefront-chat-thread', () => ({ id: 'pending', name: 'Website chat', mode: 'bot', messages: [] }));
  const ready = useState('storefront-chat-ready', () => false);
  const storageWarning = useState('storefront-chat-storage-warning', () => false);
  const busy = useState('storefront-chat-busy', () => false);
  const error = useState('storefront-chat-error', () => '');
  const sessionToken = useState('storefront-chat-token', () => '');
  const retryAt = useState('storefront-chat-retry-at', () => 0);
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
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ action, token: sessionToken.value, locale: locale.value, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 429) {
      const seconds = Math.min(3600, Math.max(1, Number(result.retryAfterSeconds) || 60));
      retryAt.value = Date.now() + seconds * 1000;
      throw new Error('rate_limit');
    }
    if (!response.ok || typeof result.conversationId !== 'string') throw new Error(result.error || 'service_unavailable');
    apply(result as ChatSnapshot);
  }

  function showError(failure: unknown) {
    const code = failure instanceof Error ? failure.message : '';
    error.value = code === 'rate_limit'
      ? t('Лимит чата исчерпан. Попробуйте позже; история сохранена.', 'Chat limit reached. Try later; your history is saved.', 'ถึงขีดจำกัดแชตแล้ว โปรดลองภายหลัง ประวัติถูกบันทึกไว้')
      : code === 'conversation_closed'
        ? t('Диалог закрыт сотрудником.', 'This conversation was closed by a team member.', 'พนักงานปิดการสนทนานี้แล้ว')
        : t('Не удалось получить подтверждение чата. Проверьте соединение и историю перед повтором.', 'Chat confirmation was unavailable. Check your connection and history before retrying.', 'ไม่ได้รับการยืนยันจากแชต กรุณาตรวจสอบการเชื่อมต่อและประวัติก่อนลองอีกครั้ง');
  }

  async function initialise() {
    if (!import.meta.client || ready.value || Date.now() < retryAt.value) return;
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
      error.value = '';
    } catch (failure) { showError(failure); }
  }

  async function refresh() {
    if (!ready.value || polling || Date.now() < retryAt.value) return;
    polling = true;
    try { await call('poll'); error.value = ''; }
    catch (failure) {
      if (failure instanceof Error && failure.message === 'session_expired') {
        ready.value = false;
        sessionToken.value = newUuid();
        try { localStorage.setItem('blagova_storefront_chat', sessionToken.value); } catch { storageWarning.value = true; }
        try { await call('start'); ready.value = true; }
        catch (restartFailure) { showError(restartFailure); }
      } else showError(failure);
    } finally { polling = false; }
  }

  async function sendExchange(exchange: Exchange) {
    if (!ready.value || busy.value) return false;
    if (Date.now() < retryAt.value) { showError(new Error('rate_limit')); return false; }
    const customerText = exchange.customerText?.trim() || '';
    const customerMessageId = newUuid();
    busy.value = true;
    error.value = '';
    try {
      await call('send', { customerMessageId, customerBody: customerText, requestManager: Boolean(exchange.requestManager) });
      return true;
    } catch (failure) {
      showError(failure);
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
