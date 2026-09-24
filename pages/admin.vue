<script setup lang="ts">
import { bangkokDate, statuses, transitions } from '~/data/operations';
import type { OrderStatus } from '~/data/operations';
import type { StoredOrder, StoredConversation, StoredMessage, StoredKnowledge } from '~/types/studio';
import { allowedStaffTabs } from '~/utils/staffAccess.mjs';
definePageMeta({ layout: false });
useHead({ title: 'Рабочее пространство · BLAGOVA', htmlAttrs: { lang: 'ru' } });
const { staff, verify, logout } = useStaffAuth();
const api = () => useNuxtApp().$supabase;
const tabs = [{ id: 'orders', name: 'Заказы', icon: 'bag' }, { id: 'conversations', name: 'Диалоги', icon: 'heart' }, { id: 'calendar', name: 'Календарь', icon: 'clock' }, { id: 'knowledge', name: 'Знания', icon: 'leaf' }, { id: 'integrations', name: 'Подключения', icon: 'diagonal' }];
const visibleTabs = computed(() => tabs.filter(item => allowedStaffTabs(staff.value?.role).includes(item.id)));
const tab = ref('orders');
const authorized = ref(false);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const orders = ref<StoredOrder[]>([]);
const conversations = ref<StoredConversation[]>([]);
const knowledge = ref<StoredKnowledge[]>([]);
const messages = ref<StoredMessage[]>([]);
const orderPage = ref(0);
const orderCount = ref(0);
const selectedId = ref('');
const selected = computed(() => orders.value.find(o => o.id === selectedId.value));
const confirmationDelivery = computed(() => selected.value?.order_notification_deliveries?.find(delivery => delivery.event === 'order_confirmed'));
const threadId = ref('');
const thread = computed(() => conversations.value.find(c => c.id === threadId.value));
const reply = ref('');
const replyId = ref('');
const search = ref('');
const filter = ref('all');
const calendarDate = ref(bangkokDate());
const moveDate = ref('');
const moveSlot = ref('09:00–12:00');
const editing = ref<StoredKnowledge | null>(null);
const newDocument = ref(false);
let epoch = 0;
let messageEpoch = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let chatTimer: ReturnType<typeof setInterval> | undefined;
const label = (status: string) => statuses.find(s => s.id === status)?.label || status;
const money = (minor: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'THB' }).format(minor / 100);
const orderTotal = (order: StoredOrder) => order.order_items.reduce((sum, item) => sum + Number(item.line_total_minor), order.delivery_minor);
const localDay = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const dateTime = (value: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const chatAvatar = (sender: string) => sender === 'manager' ? '/avatars/manager.webp' : sender === 'owner' ? '/avatars/owner.webp' : '/avatars/bot.webp';
const senderLabel = (sender: string) => sender === 'customer' ? 'Посетитель' : sender === 'manager' ? 'Менеджер' : sender === 'owner' ? 'Собственница' : 'Помощник';
const filtered = computed(() => orders.value.filter(o => (filter.value === 'all' || o.status === filter.value) && `${o.id} ${o.customer_name} ${o.order_items.map(i => i.product_name).join(' ')}`.toLowerCase().includes(search.value.trim().toLowerCase())));
const scheduled = computed(() => orders.value.filter(o => !['completed', 'cancelled'].includes(o.status) && localDay(o.scheduled_start) === calendarDate.value).sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start)));
watch(selected, value => { if (value) moveDate.value = localDay(value.scheduled_start); });
watch(reply, () => { replyId.value = ''; });
function clearData() { epoch++; messageEpoch++; authorized.value = false; orders.value = []; conversations.value = []; knowledge.value = []; messages.value = []; editing.value = null; reply.value = ''; selectedId.value = ''; threadId.value = ''; }
watch(staff, value => { if (!value && authorized.value) { clearData(); navigateTo('/login', { replace: true }); } });

async function load() {
  const current = ++epoch;
  loading.value = true; error.value = '';
  try {
    const identity = await verify();
    if (current !== epoch) return;
    if (!identity) { clearData(); await navigateTo('/login', { replace: true }); return; }
    authorized.value = true;
    const results = await Promise.all([
      api().from('orders').select('*,order_items(*),order_events(*),order_notification_deliveries(*),order_change_deliveries(*)', { count: 'exact' }).order('created_at', { ascending: false }).range(orderPage.value * 100, orderPage.value * 100 + 99),
      api().from('conversations').select('*,customers(display_name)').order('updated_at', { ascending: false }).limit(100),
      identity.role === 'owner' ? api().from('knowledge_documents').select('*').order('updated_at', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    ]);
    if (current !== epoch || !staff.value) return;
    if (results.some(r => r.error)) throw new Error('load');
    orders.value = results[0].data as unknown as StoredOrder[];
    orderCount.value = results[0].count || 0;
    conversations.value = results[1].data as unknown as StoredConversation[];
    knowledge.value = results[2].data as unknown as StoredKnowledge[];
  } catch {
    if (current === epoch) {
      orders.value = []; conversations.value = []; knowledge.value = []; messages.value = [];
      error.value = 'Не удалось загрузить данные или подтвердить доступ. Проверьте соединение и нажмите «Обновить».';
    }
  } finally { if (current === epoch) loading.value = false; }
}
async function checkAccess() {
  if (!authorized.value || saving.value) return;
  try { if (!await verify()) { clearData(); await navigateTo('/login', { replace: true }); } }
  catch { clearData(); await navigateTo('/login', { replace: true }); }
}
async function refreshConversations() {
  if (!authorized.value || saving.value || tab.value !== 'conversations') return;
  const { data, error: failure } = await api().from('conversations').select('*,customers(display_name)').order('updated_at', { ascending: false }).limit(100);
  if (failure || !staff.value) return;
  conversations.value = data as unknown as StoredConversation[];
  if (threadId.value) await readMessages(false);
}
onMounted(() => {
  load();
  timer = setInterval(checkAccess, 60000);
  chatTimer = setInterval(refreshConversations, 4000);
  window.addEventListener('focus', checkAccess);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  if (chatTimer) clearInterval(chatTimer);
  window.removeEventListener('focus', checkAccess);
  clearData();
});
async function signOut() { clearData(); await logout(); }
async function confirmOrder() {
  if (!selected.value || saving.value) return;
  const order = selected.value;
  if (order.status === 'pending' && !window.confirm(`Подтвердить заказ ${order.id.slice(0, 8).toUpperCase()} на ${dateTime(order.scheduled_start)}\n\nИтого: ${money(orderTotal(order))}\n\nПосле подтверждения клиенту будет отправлено письмо.`)) return;
  saving.value = true; error.value = ''; notice.value = '';
  try {
    const { data, error: failure } = await api().functions.invoke('confirm-order', {
      body: { orderId: order.id, revision: order.revision },
    });
    if (failure) throw failure;
    await load();
    notice.value = data?.status === 'sent'
      ? `Заказ ${data.reference} подтверждён. Письмо клиенту отправлено.`
      : data?.status === 'manual_required'
        ? `Заказ ${data.reference} подтверждён. Email клиента не указан — требуется связаться вручную.`
        : `Заказ ${data?.reference || ''} подтверждён. Отправка письма ещё выполняется.`;
  } catch {
    await load();
    const current = orders.value.find(item => item.id === order.id);
    error.value = current?.status === 'confirmed'
      ? 'Заказ подтверждён, но письмо не отправлено. Нажмите «Повторить отправку».'
      : 'Заказ не подтверждён. Интервал мог заполниться или данные заказа изменились — выберите другое время и повторите.';
  } finally { saving.value = false; }
}
async function changeOrder(action: string, status?: OrderStatus) {
  if (!selected.value || saving.value) return;
  if (action === 'status' && status === 'confirmed') { await confirmOrder(); return; }
  if (action === 'status' && status === 'cancelled' && !window.confirm(`Отменить заказ ${selected.value.id.slice(0, 8).toUpperCase()}?\n\nКлиенту будет отправлено уведомление.`)) return;
  if (action === 'reschedule' && !window.confirm(`Перенести заказ ${selected.value.id.slice(0, 8).toUpperCase()} на ${moveDate.value}, ${moveSlot.value}?\n\nКлиенту будет отправлено уведомление.`)) return;
  saving.value = true; error.value = ''; notice.value = '';
  try {
    const [start, end] = moveSlot.value.split('–');
    if (action === 'reschedule' || status === 'cancelled') {
      const { data, error: failure } = await api().functions.invoke('order-change', { body: {
        orderId: selected.value.id, revision: selected.value.revision,
        action: action === 'reschedule' ? 'reschedule' : 'cancel',
        start: action === 'reschedule' ? new Date(`${moveDate.value}T${start}:00+07:00`).toISOString() : null,
        end: action === 'reschedule' ? new Date(`${moveDate.value}T${end}:00+07:00`).toISOString() : null,
      }});
      if (failure) throw failure;
      await load();
      notice.value = data?.status === 'sent'
        ? `Заказ ${data.reference} изменён. Письмо клиенту отправлено.`
        : data?.status === 'manual_required'
          ? `Заказ ${data.reference} изменён. Email не указан — свяжитесь с клиентом вручную.`
          : `Заказ ${data?.reference || ''} изменён. Письмо отправляется.`;
    } else {
      const { error: failure } = await api().rpc('staff_order_action', { p_order_id: selected.value.id, p_revision: selected.value.revision, p_action: action, p_status: status || null, p_start: null, p_end: null });
      if (failure) throw failure;
      await load(); notice.value = 'Статус заказа сохранён.';
    }
  } catch { await load(); error.value = 'Не удалось изменить заказ или отправить уведомление. Проверьте выбранный интервал и состояние заказа.'; }
  finally { saving.value = false; }
}
async function readMessages(clear = true) {
  const current = ++messageEpoch; const id = threadId.value;
  if (clear) messages.value = [];
  if (!id || !staff.value) return;
  const { data, error: failure } = await api().from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: false }).limit(100);
  if (current !== messageEpoch || !staff.value) return;
  if (failure) { error.value = 'Не удалось загрузить переписку.'; return; }
  messages.value = (data as StoredMessage[]).reverse();
}
watch(threadId, () => { reply.value = ''; readMessages(); });
async function conversationAction(action: string) {
  if (!thread.value || saving.value) return;
  saving.value = true; error.value = ''; notice.value = '';
  if (action === 'reply' && !replyId.value) replyId.value = newUuid();
  try {
    const { error: failure } = await api().rpc('staff_conversation_action', { p_conversation_id: thread.value.id, p_action: action, p_body: action === 'reply' ? reply.value.trim() : null, p_message_id: action === 'reply' ? replyId.value : null });
    if (failure) throw failure;
    reply.value = ''; await load(); await readMessages();
    notice.value = action === 'reply' ? 'Ответ сохранён и появится в чате посетителя.' : 'Режим диалога сохранён.';
  } catch { error.value = 'Не удалось изменить диалог. Обновите данные: его мог принять другой сотрудник.'; }
  finally { saving.value = false; }
}
function editDocument(document?: StoredKnowledge) {
  newDocument.value = !document;
  editing.value = document ? { ...document } : { id: newUuid(), slug: `note-${newUuid()}`, title: '', body: '', locale: 'ru', visibility: 'internal', status: 'draft', version: 1, updated_at: '' };
  notice.value = ''; error.value = '';
}
async function saveDocument() {
  const doc = editing.value; if (!doc || staff.value?.role !== 'owner' || saving.value) return;
  saving.value = true; error.value = '';
  try {
    const content = { title: doc.title.trim(), body: doc.body.trim(), locale: doc.locale, visibility: doc.visibility, status: 'draft', approved_by: null, approved_at: null };
    const result = newDocument.value
      ? await api().from('knowledge_documents').insert({ ...content, id: doc.id, slug: doc.slug }).select('id').single()
      : await api().from('knowledge_documents').update(content).eq('id', doc.id).eq('updated_at', doc.updated_at).select('id').single();
    if (result.error) throw result.error;
    editing.value = null; await load(); notice.value = 'Черновик сохранён. После проверки его можно опубликовать.';
  } catch { error.value = 'Не удалось сохранить материал. Проверьте поля и обновите данные: материал мог измениться.'; }
  finally { saving.value = false; }
}
async function publishDocument(doc: StoredKnowledge) {
  if (staff.value?.role !== 'owner' || saving.value) return;
  saving.value = true; error.value = '';
  try {
    const { error: failure } = await api().from('knowledge_documents').update({ status: 'published', approved_by: staff.value.id, approved_at: new Date().toISOString() }).eq('id', doc.id).eq('updated_at', doc.updated_at).select('id').single();
    if (failure) throw failure;
    editing.value = null; await load(); notice.value = 'Материал опубликован в базе. AI-помощник ещё не подключён.';
  } catch { error.value = 'Не удалось опубликовать. Обновите данные и повторно проверьте материал.'; }
  finally { saving.value = false; }
}
async function nextPage(delta: number) { orderPage.value += delta; selectedId.value = ''; await load(); }
</script>
<template>
  <main v-if="!authorized" class="staff-gate">
    <NuxtLink class="wordmark" to="/">BLAGOVA<span>ATELIER · WORKSPACE</span></NuxtLink>
    <p role="status">{{ loading ? 'Проверяем доступ…' : 'Войдите, чтобы открыть рабочее пространство.' }}</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <NuxtLink class="btn btn-dark" to="/login">Перейти ко входу</NuxtLink>
  </main>
  <div v-else class="studio">
    <aside class="studio-sidebar">
      <NuxtLink to="/" class="wordmark">BLAGOVA<span>ATELIER · WORKSPACE</span></NuxtLink>
      <div class="studio-location"><span class="studio-dot"></span>Pattaya, Thailand</div>
      <nav aria-label="Разделы админки"><button v-for="item in visibleTabs" :key="item.id" :class="{active:tab===item.id}" :aria-current="tab===item.id ? 'page' : undefined" @click="tab=item.id; notice=''">
        <AtelierIcon :name="item.icon" :size="19"/><span>{{ item.name }}</span>
      </button></nav>
      <div class="studio-sidebar-bottom"><p>Маленькие детали.<br>Большая забота.</p><NuxtLink to="/demo-admin">Локальная демо-версия ↗</NuxtLink><button class="staff-signout" @click="signOut">Выйти из аккаунта</button></div>
    </aside>
    <main class="studio-main">
      <header class="studio-topbar"><span>BLAGOVA / {{ tabs.find(t=>t.id===tab)?.name }}</span><div class="staff-account"><span>{{ staff?.email }}</span><strong>{{ staff?.role==='owner' ? 'Владелец' : 'Менеджер' }}</strong><button class="staff-signout" @click="signOut">Выйти</button></div></header>
      <div class="studio-content">
        <div class="studio-intro"><div><span class="eyebrow">YOUR LITTLE BUSINESS, BEAUTIFULLY ORGANISED</span><h1>{{ tab==='orders' ? 'Всё под контролем.' : tab==='conversations' ? 'Ближе к каждому.' : tab==='calendar' ? 'Ритм ваших дней.' : tab==='knowledge' ? 'Знания с заботой.' : 'Всё на своих местах.' }}</h1><p>Общее рабочее пространство · время Паттайи</p></div><button class="btn btn-outline" :disabled="loading || saving" @click="load">{{ loading ? 'Загружаем…' : 'Обновить' }}</button></div>
        <div class="studio-banner"><AtelierIcon name="leaf"/><p><strong>Подключено к Supabase.</strong> Заявки и переписка с сайта появляются здесь. Ответы сотрудников доставляются обратно в чат посетителя.</p></div>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p><p v-if="notice" class="studio-notice" role="status">{{ notice }}</p>
        <p v-if="loading" role="status" class="studio-empty">Обновляем рабочее пространство…</p>
        <template v-else>
          <template v-if="tab==='orders'">
            <div class="studio-stats"><article><span>Всего в базе</span><strong>{{ orderCount }}</strong><small>Все заказы</small></article><article><span>На проверке</span><strong>{{ orders.filter(o=>o.status==='pending').length }}</strong><small>На текущей странице</small></article><article><span>Готовим</span><strong>{{ orders.filter(o=>['confirmed','production'].includes(o.status)).length }}</strong><small>На текущей странице</small></article><article><span>К выдаче</span><strong>{{ orders.filter(o=>o.status==='ready').length }}</strong><small>На текущей странице</small></article></div>
            <div class="studio-orders-layout"><section class="studio-card">
              <div class="studio-card-heading"><h2>Заказы</h2><span class="integration-off">Supabase</span></div>
              <div class="studio-filters"><input v-model="search" class="form-input" aria-label="Поиск заказов" placeholder="Имя, номер или десерт"/><select v-model="filter" aria-label="Статус заказа"><option value="all">Все статусы</option><option v-for="s in statuses" :key="s.id" :value="s.id">{{ s.label }}</option></select></div>
              <div class="studio-order-list"><button v-for="o in filtered" :key="o.id" :class="['studio-order-row',{selected:selectedId===o.id}]" @click="selectedId=o.id"><div><small>{{ o.id.slice(0,8).toUpperCase() }} · {{ o.is_demo ? 'Тестовый' : 'Заказ' }}</small><strong>{{ o.customer_name }}</strong><span>{{ o.order_items.map(i=>`${i.product_name} × ${i.quantity}`).join(', ') }}</span></div><div class="studio-order-meta"><span :class="['status-chip','status-'+o.status]">{{ label(o.status) }}</span><strong>{{ money(orderTotal(o)) }}</strong><small>{{ dateTime(o.scheduled_start) }}</small></div></button>
                <div v-if="!filtered.length" class="studio-empty"><h3>{{ orderCount ? 'Ничего не найдено' : 'Первая заявка ещё впереди.' }}</h3><p>{{ orderCount ? 'Попробуйте другой фильтр.' : 'База подключена и готова принимать тестовые заявки с витрины.' }}</p></div>
              </div>
              <div class="staff-pagination"><button :disabled="orderPage===0 || loading" @click="nextPage(-1)">← Назад</button><span>Страница {{ orderPage+1 }} · до 100 заказов</span><button :disabled="(orderPage+1)*100>=orderCount || loading" @click="nextPage(1)">Далее →</button></div>
            </section>
            <aside class="studio-card order-inspector"><template v-if="selected"><div class="studio-card-heading"><h2>Детали заказа</h2><button class="icon-button" aria-label="Закрыть детали" @click="selectedId=''">×</button></div><span class="eyebrow">{{ selected.id.slice(0,8) }}</span><h3>{{ selected.customer_name }}</h3><p>{{ selected.customer_contact }}</p><div class="inspector-section"><p>{{ selected.fulfillment==='delivery' ? selected.delivery_address : 'Самовывоз' }}</p><p>{{ selected.note || 'Без дополнительных пожеланий' }}</p></div>
              <div v-for="i in selected.order_items" :key="i.id" class="inspector-item"><span>{{ i.product_name }} × {{ i.quantity }}<small>{{ i.variant_description }}</small></span><strong>{{ money(Number(i.line_total_minor)) }}</strong></div>
              <div class="inspector-item"><span>Доставка</span><strong>{{ money(selected.delivery_minor) }}</strong></div><div class="inspector-total"><span>Итого</span><strong>{{ money(orderTotal(selected)) }}</strong></div>
              <div v-if="selected.status==='confirmed' && !confirmationDelivery" class="inspector-section"><p><strong>Уведомление клиенту:</strong> подтверждение ещё не отправлялось</p><button class="text-link" :disabled="saving" @click="confirmOrder">Отправить подтверждение →</button></div>
              <div v-if="confirmationDelivery" class="inspector-section"><p><strong>Уведомление клиенту:</strong> {{ confirmationDelivery.status==='sent' ? 'письмо отправлено' : confirmationDelivery.status==='manual_required' ? 'нужно связаться вручную' : confirmationDelivery.status==='failed' ? 'ошибка отправки' : 'отправляется' }}</p><button v-if="confirmationDelivery.status==='failed'" class="text-link" :disabled="saving" @click="confirmOrder">Повторить отправку →</button></div>
              <div class="inspector-actions"><button v-for="s in transitions[selected.status]" :key="s" :disabled="saving" :class="['btn', s==='cancelled' ? 'btn-outline' : 'btn-dark']" @click="changeOrder('status',s)">{{ s==='confirmed' ? 'Подтвердить заявку' : s==='production' ? 'Взять в работу' : s==='ready' ? 'Готов к выдаче' : s==='completed' ? 'Завершить' : 'Отменить заказ' }}</button></div>
              <form v-if="!['completed','cancelled'].includes(selected.status)" class="inspector-section" @submit.prevent="changeOrder('reschedule')"><label>Перенести на дату<input v-model="moveDate" type="date" class="form-input" :min="bangkokDate()" required/></label><label>Интервал<select v-model="moveSlot" class="form-input"><option>09:00–12:00</option><option>12:00–15:00</option><option>15:00–18:00</option></select></label><button class="text-link" :disabled="saving">Сохранить дату →</button></form>
              <div class="inspector-history"><h4>История</h4><p v-for="e in [...selected.order_events].sort((a,b)=>a.created_at.localeCompare(b.created_at))" :key="e.id"><small>{{ dateTime(e.created_at) }}</small>{{ e.kind==='created' ? 'Заявка создана' : 'Заказ обновлён' }} · {{ label(e.new_status) }}</p></div>
            </template><div v-else class="inspector-placeholder"><AtelierIcon name="bag" :size="32"/><h3>История одного заказа</h3><p>Выберите заявку, чтобы посмотреть детали и изменить статус.</p></div></aside></div>
          </template>
          <section v-if="tab==='calendar'" class="studio-card calendar-workspace"><div class="studio-card-heading"><div><h2>Выдача и доставка</h2><p>Asia/Bangkok · заказы с текущей страницы списка</p></div><span class="integration-off">Google не подключён</span></div><label class="calendar-date-label">Дата<input v-model="calendarDate" type="date" class="form-input"/></label><div class="calendar-events"><button v-for="o in scheduled" :key="o.id" class="calendar-event" @click="selectedId=o.id;tab='orders'"><span>{{ dateTime(o.scheduled_start) }}</span><div><strong>{{ o.customer_name }}</strong><p>{{ o.order_items.map(i=>i.product_name).join(', ') }}</p></div><span :class="['status-chip','status-'+o.status]">{{ label(o.status) }}</span></button><p v-if="!scheduled.length" class="studio-empty">На выбранную дату в загруженных заказах нет активных заявок.</p></div></section>
          <section v-if="tab==='conversations'" class="studio-card conversations-workspace"><aside class="conversation-list"><span class="eyebrow">ДИАЛОГИ ИЗ БАЗЫ</span><p>До 100 последних диалогов · автообновление</p><button v-for="c in conversations" :key="c.id" class="staff-thread" :class="{selected:c.id===threadId}" @click="threadId=c.id"><strong>{{ c.customers?.display_name || 'Посетитель' }}</strong><small>{{ c.channel }} · {{ c.mode }}</small></button><p v-if="!conversations.length">Диалоги появятся после первого сообщения с сайта.</p></aside><div class="manager-workspace"><template v-if="thread"><div class="manager-toolbar"><strong>{{ thread.mode==='manager' ? 'Отвечает менеджер' : thread.mode==='requested' ? 'Посетитель ждёт менеджера' : 'Режим помощника' }}</strong><button v-if="thread.mode!=='manager'" class="btn btn-dark" :disabled="saving || thread.channel!=='website'" @click="conversationAction('take')">Принять диалог</button><button v-else class="btn btn-outline" :disabled="saving || thread.assigned_to!==staff?.id" @click="conversationAction('release')">Вернуть боту</button></div><div class="manager-log" role="log"><div v-for="m in messages" :key="m.id" :class="['chat-message-row','chat-row-'+m.sender]"><img v-if="m.sender!=='customer'" class="chat-avatar" :src="chatAvatar(m.sender)" alt="" width="36" height="36"/><article :class="['chat-bubble','chat-'+m.sender]"><small>{{ senderLabel(m.sender) }} · {{ dateTime(m.created_at) }}</small><p>{{ m.body }}</p><span v-if="m.source" class="chat-source">Материал: {{ m.source }}</span></article></div><p v-if="!messages.length" class="studio-empty">Сообщений пока нет.</p></div><form class="manager-compose" @submit.prevent="conversationAction('reply')"><label for="staff-reply">Ответ менеджера</label><textarea id="staff-reply" v-model="reply" class="form-input" rows="3" maxlength="5000" :disabled="thread.mode!=='manager' || thread.assigned_to!==staff?.id || saving" required></textarea><p class="demo-note">Ответ сохранится в базе и появится у посетителя в течение нескольких секунд.</p><button class="btn btn-dark" :disabled="saving || !reply.trim() || thread.mode!=='manager' || thread.assigned_to!==staff?.id">Отправить ответ</button></form></template><p v-else class="studio-empty">Выберите диалог слева.</p></div></section>
          <section v-if="tab==='knowledge' && staff?.role==='owner'" class="knowledge-workspace"><div class="studio-card"><div class="studio-card-heading"><h2>Материалы помощника</h2><button v-if="staff?.role==='owner'" class="btn btn-dark" @click="editDocument()">Добавить материал +</button></div><p class="knowledge-explanation">До 100 последних материалов. Публикация сохраняет утверждённый текст в базе; AI и векторный поиск пока не подключены.</p><button v-for="k in knowledge" :key="k.id" class="knowledge-row" @click="editDocument(k)"><div><strong>{{ k.title }}</strong><p>{{ k.locale.toUpperCase() }} · {{ k.visibility==='internal' ? 'Внутренний' : 'Для клиентов' }} · версия {{ k.version }}</p></div><span class="status-chip">{{ k.status==='published' ? 'Опубликован' : k.status==='draft' ? 'Черновик' : 'Архив' }}</span></button><p v-if="!knowledge.length" class="studio-empty">Добавьте первый проверенный материал.</p></div>
            <form v-if="editing" class="studio-card knowledge-editor" @submit.prevent="saveDocument"><div class="studio-card-heading"><h2>{{ staff?.role==='owner' ? 'Редактор материала' : 'Просмотр материала' }}</h2><button type="button" class="icon-button" aria-label="Закрыть редактор" @click="editing=null">×</button></div><label>Название<input v-model="editing.title" class="form-input" required maxlength="250" :disabled="staff?.role!=='owner' || saving"/></label><label>Язык<select v-model="editing.locale" class="form-input" :disabled="staff?.role!=='owner' || saving"><option value="ru">Русский</option><option value="en">English</option><option value="th">ไทย</option></select></label><label>Доступность<select v-model="editing.visibility" class="form-input" :disabled="staff?.role!=='owner' || saving"><option value="internal">Внутренний материал</option><option value="public">Для клиентов</option></select></label><label>Текст<textarea v-model="editing.body" class="form-input" rows="8" maxlength="100000" required :disabled="staff?.role!=='owner' || saving"></textarea></label><p class="demo-note">Изменение текста сохраняется черновиком. Для публикации сначала сохраните, затем откройте и проверьте материал.</p><div v-if="staff?.role==='owner'" class="button-row"><button class="btn btn-outline" :disabled="saving">Сохранить черновик</button><button v-if="!newDocument && editing.status==='draft' && knowledge.some(k=>k.id===editing?.id && k.body===editing?.body && k.title===editing?.title && k.locale===editing?.locale && k.visibility===editing?.visibility)" type="button" class="btn btn-dark" :disabled="saving" @click="publishDocument(editing)">Проверено · опубликовать</button></div></form>
          </section>
          <section v-if="tab==='integrations' && staff?.role==='owner'" class="integration-grid"><article class="studio-card integration-card"><span class="status-chip status-confirmed">Подключено</span><h2>Supabase</h2><p>Вход сотрудников, роли, заказы, переписка и материалы. База во Франкфурте.</p></article><article v-for="name in ['Google Calendar','LINE','AI / RAG']" :key="name" class="studio-card integration-card"><span class="integration-off">Не подключено</span><h2>{{ name }}</h2><p>Следующий этап подключения. Автоматические отправки сейчас отключены.</p></article></section>
        </template>
        <footer class="studio-footer"><span>BLAGOVA SWEETS · Рабочее пространство</span><NuxtLink to="/">Вернуться на сайт ↗</NuxtLink></footer>
      </div>
    </main>
  </div>
</template>
