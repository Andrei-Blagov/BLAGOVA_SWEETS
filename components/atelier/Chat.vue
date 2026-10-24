<script setup lang="ts">
import { validOrderContact } from '~/supabase/functions/_shared/orderContact';
import {loadPendingIntent,createPendingIntent,clearPendingIntent,expirePendingIntent,chatPendingIntentStorageKey} from '~/utils/pendingIntent.mjs';
import type {StorefrontOrderInput,SavedReceipt} from '~/composables/usePublicIntake';
const { products, load: loadCatalog, error: catalogError } = useCatalog();
onMounted(() => loadCatalog());
import { bangkokDate } from '~/data/operations';
import type { StorefrontSlot } from '~/composables/useAvailability';
const {
  t,
  local,
  money,
  locale
} = useAtelier();
const {
  chatOpen,
  thread,
  ready,
  storageWarning,
  busy: chatBusy,
  error: chatError,
  sessionToken,
  initialise,
  sendExchange
} = useStorefrontChat();
const { submitOrder, resolveIntent } = usePublicIntake();
const { getAvailability } = useAvailability();
const route = useRoute();
const input = ref('');
const panel = ref<HTMLElement>();
const log = ref<HTMLElement>();
const launcher = ref<HTMLButtonElement>();
const orderStep = ref(0);
const productId = ref('');
watch(products, rows => { if (!rows.some(row => row.id===productId.value)) productId.value=rows[0]?.id || ''; });
const amount = ref(1);
const date = ref('');
const slot = ref('09:00–12:00');
const slots = ref<StorefrontSlot[]>([]);
const availabilityLoading = ref(false);
let availabilityRequest = 0;
const mode = ref<'pickup' | 'delivery'>('pickup');
const area = ref<'central' | 'jomtien'>('central');
const customer = ref('');
const contact = ref('');
const address = ref('');
const note = ref('');
const error = ref('');
const requestKey = ref('');
const lastOrder = ref('');
const submitting = ref(false);
const accepted = ref(false);
const pendingOrder=ref<ReturnType<typeof loadPendingIntent>>(null);
const orderRecoveryBusy=ref(false);
const orderStorageBlocked=ref(false);
const savedOrder=ref<SavedReceipt|null>(null);
let frozenOrder:StorefrontOrderInput|null=null;
let expiryTimer:ReturnType<typeof setTimeout>|undefined;
const savedOrderDate=computed(()=>savedOrder.value?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(savedOrder.value.scheduledStart)):'');
const savedOrderSlot=computed(()=>{
  if(!savedOrder.value)return '';
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false});
  return time.format(new Date(savedOrder.value.scheduledStart))+'–'+time.format(new Date(savedOrder.value.scheduledEnd));
});
function checkOrderExpiry(){
  try{
    if(!expirePendingIntent(sessionStorage,pendingOrder.value,Date.now(),chatPendingIntentStorageKey))return false;
    frozenOrder=null;
    error.value=t('Срок восстановления заявки истёк. Новая отправка заблокирована; обратитесь к менеджеру.','Request recovery expired. New submissions are blocked; contact a manager.','หมดเวลากู้คืนคำขอแล้ว ไม่สามารถส่งใหม่ได้ โปรดติดต่อผู้จัดการ');
  }catch{frozenOrder=null;orderStorageBlocked.value=true;error.value=t('Не удалось очистить состояние заявки. Обратитесь к менеджеру.','Could not clear request state. Contact a manager.','ไม่สามารถล้างสถานะคำขอได้ โปรดติดต่อผู้จัดการ');}
  return true;
}
watch(pendingOrder,p=>{if(expiryTimer)clearTimeout(expiryTimer);if(p?.token)expiryTimer=setTimeout(checkOrderExpiry,Math.max(0,p.expiresAt-Date.now()));});
onBeforeUnmount(()=>{if(expiryTimer)clearTimeout(expiryTimer);});
function acceptOrderReceipt(summary:SavedReceipt){
  if(!summary.reference||!summary.scheduledStart||!summary.scheduledEnd||!Array.isArray(summary.items))throw Error('invalid_receipt');
  savedOrder.value=summary;lastOrder.value=summary.reference;
  try{clearPendingIntent(sessionStorage,chatPendingIntentStorageKey);}catch{/* Known saved receipt must never be resubmitted. */}
  pendingOrder.value=null;frozenOrder=null;requestKey.value='';orderStep.value=0;
  customer.value='';contact.value='';address.value='';note.value='';accepted.value=false;error.value='';
}
async function recoverOrder(close=false){
  if(checkOrderExpiry()||orderStorageBlocked.value||!pendingOrder.value?.token||orderRecoveryBusy.value||submitting.value)return;
  orderRecoveryBusy.value=true;error.value='';
  try{
    const result=await resolveIntent(pendingOrder.value.key,pendingOrder.value.token,close);
    if(result.state==='saved')acceptOrderReceipt(result.summary);
    else if(result.state==='closed'){
      clearPendingIntent(sessionStorage,chatPendingIntentStorageKey);pendingOrder.value=null;frozenOrder=null;requestKey.value='';orderStep.value=1;
    }else error.value=t('Результат заявки пока неизвестен. Проверьте снова или разрешите попытку перед редактированием.','The request result is still unknown. Check again or resolve this attempt before editing.','ยังไม่ทราบผลคำขอ โปรดตรวจสอบอีกครั้งหรือปิดความพยายามนี้ก่อนแก้ไข');
  }catch{error.value=t('Не удалось разрешить прежнюю попытку. Новая отправка заблокирована.','Could not resolve the previous attempt. New submissions remain blocked.','ไม่สามารถตรวจสอบความพยายามก่อนหน้าได้ ยังไม่สามารถส่งใหม่');}
  finally{orderRecoveryBusy.value=false;}
}
onMounted(async()=>{
  try{pendingOrder.value=loadPendingIntent(sessionStorage,Date.now(),chatPendingIntentStorageKey);}
  catch{orderStorageBlocked.value=true;error.value=t('Не удалось прочитать состояние заявки. Обратитесь к менеджеру.','Could not read request state. Contact a manager.','ไม่สามารถอ่านสถานะคำขอได้ โปรดติดต่อผู้จัดการ');}
  if(pendingOrder.value)await recoverOrder();
});
async function editOrder(){
  if(checkOrderExpiry()||orderStorageBlocked.value||submitting.value||orderRecoveryBusy.value)return;
  if(pendingOrder.value){await recoverOrder();return;}
  orderStep.value=1;
}
const product = computed(() => products.value.find(p => p.id === productId.value) || products.value[0]);
const minDate = computed(() => bangkokDate(Math.max(1, product.value?.leadDays || 0)));
const delivery = computed(() => mode.value === 'pickup' ? 0 : area.value === 'central' ? 120 : 180);
const total = computed(() => (product.value?.price || 0) * amount.value + delivery.value);
const visible = computed(() => chatOpen.value && !['/admin', '/demo-admin', '/login'].includes(route.path));
const modeLabel = computed(() => thread.value.mode === 'bot'
  ? t('Помощник онлайн', 'Assistant online', 'ผู้ช่วยออนไลน์')
  : thread.value.mode === 'requested'
    ? t('Ожидаем менеджера', 'Waiting for a manager', 'กำลังรอผู้จัดการ')
    : t('Менеджер в диалоге', 'Manager in chat', 'ผู้จัดการอยู่ในแชต'));
function avatarFor(role: string) {
  if (role === 'owner') return '/avatars/owner.webp';
  if (role === 'manager') return '/avatars/manager.webp';
  return '/avatars/bot.webp';
}
function avatarLabel(role: string) {
  if (role === 'owner') return t('Собственница', 'Owner', 'เจ้าของ');
  if (role === 'manager') return t('Менеджер', 'Manager', 'ผู้จัดการ');
  return t('Помощник', 'Assistant', 'ผู้ช่วย');
}
async function scrollBottom() {
  await nextTick();
  log.value?.scrollTo({
    top: log.value.scrollHeight,
    behavior: 'smooth'
  });
}
watch(() => thread.value.messages.length, scrollBottom);
watch(visible, async value => {
  if (value) {
    await nextTick();
    panel.value?.focus();
    scrollBottom();
  }
});
watch(() => thread.value.mode, value => {
  if (value !== 'bot') orderStep.value = 0;
});
const availabilityItems=computed(()=>product.value?.variants?.[0] ? [{sku:product.value.variants[0].sku,quantity:amount.value,configuration:{}}] : []);
watch([date,availabilityItems,locale], async ([value]) => {
  const request = ++availabilityRequest;
  slots.value = [];
  if (!value || !availabilityItems.value.length) { availabilityLoading.value=false; return; }
  availabilityLoading.value = true;
  try {
    const result = await getAvailability(value,availabilityItems.value,locale.value);
    if (request !== availabilityRequest) return;
    slots.value = result;
    if (!result.some(item => item.label === slot.value && item.available)) slot.value = result.find(item => item.available)?.label || '';
  } catch {
    if (request === availabilityRequest) error.value = t('Не удалось проверить свободное время.', 'Could not check available times.', 'ไม่สามารถตรวจสอบเวลาว่างได้');
  } finally { if (request === availabilityRequest) availabilityLoading.value = false; }
});
function close() {
  chatOpen.value = false;
  nextTick(() => launcher.value?.focus());
}
async function openChat() {
  chatOpen.value = true;
  await initialise();
}
function trap(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close();
    return;
  }
  if (event.key !== 'Tab') return;
  const nodes = Array.from(panel.value?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, a[href]') || []).filter(el => el.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0]!,
    last = nodes[nodes.length - 1]!;
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
async function startOrder() {
  if(checkOrderExpiry()||orderStorageBlocked.value||submitting.value||orderRecoveryBusy.value)return;
  if(pendingOrder.value){await recoverOrder();return;}
  if (thread.value.mode !== 'bot') return;
  await loadCatalog();
  if (!product.value) { error.value = catalogError.value || 'Каталог недоступен.'; return; }
  lastOrder.value = '';
  savedOrder.value = null;
  error.value = '';
  orderStep.value = 1;
  scrollBottom();
}
async function requestManager(customerText = '') {
  if (thread.value.mode !== 'bot') return;
  orderStep.value = 0;
  await sendExchange({
    customerText,
    requestManager: true
  });
}
async function send() {
  const text = input.value.trim();
  if (!text || !ready.value || chatBusy.value) return;
  if (await sendExchange({ customerText: text })) {
    input.value = '';
    if (thread.value.mode === 'bot' && /заказ|закаж|хочу.*торт|хочу.*капкейк|order|want.*cake|สั่ง/i.test(text)) await startOrder();
  }
}
async function review() {
  if(checkOrderExpiry()||orderStorageBlocked.value)return;
  if(pendingOrder.value){await recoverOrder();return;}
  error.value = '';
  if (!product.value || !Number.isInteger(amount.value) || amount.value < 1 || amount.value > 20 || !date.value || date.value < bangkokDate(Math.max(1, product.value?.leadDays || 0)) || !slot.value || !slots.value.some(item => item.label === slot.value && item.available) || !customer.value.trim() || mode.value === 'delivery' && !address.value.trim() || !accepted.value) {
    error.value = t('Проверьте количество, дату и обязательные поля.', 'Check quantity, date and required fields.', 'ตรวจสอบจำนวน วันที่ และข้อมูลที่จำเป็น');
    return;
  }
  if (!validOrderContact(contact.value)) {
    error.value = t('Укажите действующий телефон или email для связи.', 'Enter a valid phone number or email so we can contact you.', 'กรุณากรอกเบอร์โทรศัพท์หรืออีเมลที่ถูกต้องเพื่อติดต่อกลับ');
    return;
  }
  orderStep.value = 2;
  scrollBottom();
}
async function confirm() {
  if(checkOrderExpiry()||orderStorageBlocked.value||submitting.value||orderRecoveryBusy.value)return;
  if(pendingOrder.value){await recoverOrder();return;}
  if (orderStep.value !== 2 || submitting.value || !product.value?.variants?.[0]) return;
  const selectedProduct = product.value;
  const selectedVariant = selectedProduct.variants![0]!;
  if (date.value < bangkokDate(Math.max(1, product.value?.leadDays || 0))) {
    orderStep.value = 1;
    error.value = t('Выберите доступную дату.', 'Choose an available date.', 'เลือกวันที่ที่พร้อม');
    return;
  }
  submitting.value = true;
  try {
    const draft = {
      source: 'chat' as const,
      locale: locale.value,
      customerName: customer.value.trim(),
      customerContact: contact.value.trim(),
      date: date.value,
      slot: slot.value,
      fulfillment: mode.value,
      deliveryAddress: mode.value === 'delivery' ? address.value.trim() : '',
      deliveryZone: mode.value === 'delivery' ? area.value : 'pickup',
      note: note.value.trim(),
      items: [{
        sku: selectedVariant.sku,
        quantity: amount.value,
        personalization: '',
        description: '',
        configuration: {}
      }],
      chatSessionToken: sessionToken.value,
      messages: []
    };
    try{pendingOrder.value=await createPendingIntent(sessionStorage,draft,draft.items,chatPendingIntentStorageKey);}
    catch{orderStorageBlocked.value=true;throw Error('pending_storage_unavailable');}
    requestKey.value=pendingOrder.value.key;
    frozenOrder=JSON.parse(JSON.stringify({...draft,requestKey:pendingOrder.value.key,recoveryToken:pendingOrder.value.token}));
    const result=await submitOrder(frozenOrder!);
    acceptOrderReceipt(result);
  } catch (e) {
    const code = e instanceof Error ? e.message : '';
    error.value = code === 'pending_storage_unavailable' ? t('Не удалось сохранить состояние восстановления. Заявка не отправлена.','Could not save recovery state. The request was not sent.','ไม่สามารถบันทึกสถานะกู้คืนได้ ยังไม่ได้ส่งคำขอ')
      : code === 'rate_limit' ? t('Слишком много попыток. Подождите 15 минут.', 'Too many attempts. Try again in 15 minutes.', 'มีการส่งหลายครั้งเกินไป โปรดลองใหม่ใน 15 นาที')
      : ['slot_capacity_full','slot_unavailable'].includes(code) ? t('Этот интервал уже недоступен. Выберите другое время.', 'This time slot is no longer available. Choose another time.', 'ช่วงเวลานี้ไม่ว่างแล้ว โปรดเลือกเวลาอื่น')
      : t('Не удалось сохранить заявку. Проверьте соединение и попробуйте ещё раз.', 'We could not save the request. Check your connection and try again.', 'ไม่สามารถบันทึกคำขอได้ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง');
  } finally { submitting.value = false; }
}
</script>
<template>
  <div v-if="!['/admin', '/demo-admin', '/login'].includes(route.path)" class="concierge">
    <button v-if="!visible" ref="launcher" class="concierge-launcher" aria-haspopup="dialog" :aria-label="t('Открыть чат','Open chat','เปิดแชต')" @click="openChat">
      <img class="concierge-launcher-avatar" src="/avatars/bot.webp" alt="" width="34" height="34" />
      <span>{{ t('Помочь с выбором?','A little help?','ให้เราช่วยไหม?') }}</span>
<span class="chat-demo-dot">CHAT</span>
    </button>
    <Transition name="concierge">
      <section v-if="visible" ref="panel" class="concierge-panel" role="dialog" aria-modal="true" aria-labelledby="concierge-title" tabindex="-1" @keydown="trap">
        <header class="concierge-head">
<div class="concierge-team" :aria-label="t('Команда чата: собственница, менеджер и помощник','Chat team: owner, manager and assistant','ทีมแชต: เจ้าของ ผู้จัดการ และผู้ช่วย')">
<img src="/avatars/owner.webp" alt="" width="42" height="42" />
<img src="/avatars/manager.webp" alt="" width="42" height="42" />
<img src="/avatars/bot.webp" alt="" width="42" height="42" />
</div>
<div>
<h2 id="concierge-title">BLAGOVA concierge</h2>
<p>{{ modeLabel }}</p>
</div>
<button class="icon-button" :aria-label="t('Закрыть чат','Close chat','ปิดแชต')" @click="close">
<AtelierIcon name="close" />
</button>
</header>
        <p class="concierge-disclaimer">{{ t('Переписка сохраняется в рабочем пространстве. Помощник отвечает по опубликованным материалам; при необходимости подключится менеджер.','Messages are saved in the workspace. The assistant uses published information and a manager can join when needed.','ข้อความจะถูกบันทึกในระบบ ผู้ช่วยใช้ข้อมูลที่เผยแพร่ และผู้จัดการสามารถเข้าร่วมได้เมื่อจำเป็น') }}</p>
        <p v-if="storageWarning" class="form-error">{{ t('Не удалось сохранить часть данных в браузере.','Some data could not be saved in this browser.','บันทึกข้อมูลบางส่วนไม่ได้') }}</p>
        <p v-if="chatError" class="form-error" role="alert">{{ chatError }}</p>
        <div ref="log" class="concierge-body">
          <aside v-if="pendingOrder||orderStorageBlocked" class="chat-order" role="status">
            <p>{{pendingOrder?.expired?t('Срок восстановления истёк. Обратитесь к менеджеру.','Recovery expired. Contact a manager.','หมดเวลากู้คืนแล้ว โปรดติดต่อผู้จัดการ'):t('Предыдущая попытка ещё не разрешена. Сначала проверьте её результат.','The previous attempt is unresolved. Check its result first.','ยังไม่ทราบผลความพยายามก่อนหน้า โปรดตรวจสอบผลก่อน')}}</p>
            <template v-if="pendingOrder&&!pendingOrder.expired&&!orderStorageBlocked">
              <button class="text-link" :disabled="submitting||orderRecoveryBusy" @click="recoverOrder()">{{t('Проверить результат','Check result','ตรวจสอบผล')}}</button>
              <button class="text-link" :disabled="submitting||orderRecoveryBusy" @click="recoverOrder(true)">{{t('Разрешить попытку перед новой заявкой','Resolve attempt before a new request','ตรวจสอบความพยายามก่อนส่งใหม่')}}</button>
            </template>
            <p v-if="error" class="form-error" role="alert">{{error}}</p>
          </aside>
          <div class="chat-welcome">
<span class="eyebrow">A LITTLE HELP, A LOT OF CARE</span>
<h3>{{ t('С чего начнём?','Where shall we start?','เริ่มจากอะไรดี?') }}</h3>
<p>{{ t('Подберём сладкое, соберём заявку или ответим на вопрос о проекте.','Find a treat, build a request or ask about our little project.','เลือกขนม สร้างคำขอ หรือถามเกี่ยวกับโครงการ') }}</p>
</div>
          <div class="chat-quick">
<button :disabled="thread.mode !== 'bot'" @click="startOrder">{{ t('Собрать заказ','Build an order','ลองสั่งซื้อ') }}<AtelierIcon name="arrow" :size="14" />
</button>
<button @click="input=t('Когда открытие?','When do you open?','เปิดเมื่อไร?'); send()">{{ t('Об открытии','Opening','วันเปิด') }}</button>
<button :disabled="thread.mode !== 'bot' || !ready" @click="requestManager()">{{ t('Менеджер','Manager','ผู้จัดการ') }}</button>
</div>
          <div class="chat-log" role="log" aria-live="polite" aria-relevant="additions">
            <div v-for="m in thread.messages" :key="m.id" :class="['chat-message-row', 'chat-row-'+m.role]">
<img v-if="m.role !== 'customer'" class="chat-avatar" :src="avatarFor(m.role)" :alt="avatarLabel(m.role)" width="36" height="36" />
<article :class="['chat-bubble', 'chat-'+m.role]">
<small>{{ m.role === 'customer' ? t('Вы','You','คุณ') : m.role === 'owner' ? t('Собственница','Owner','เจ้าของ') : m.role === 'manager' ? t('Менеджер','Manager','ผู้จัดการ') : t('Помощник','Assistant','ผู้ช่วย') }}</small>
<p>{{ m.text }}</p>
<span v-if="m.unverified" class="chat-source">{{ t('История demo: ответ не проверен','Demo history: answer unverified','ประวัติสาธิต: ยังไม่ได้ตรวจสอบคำตอบ') }}</span>
<span v-if="m.source" class="chat-source">{{ t('Материал','Source','แหล่งข้อมูล') }}: {{ m.source }}</span>
</article>
</div>
          </div>
          <div v-if="thread.mode !== 'bot'" class="chat-handoff">
<strong>{{ t('Бот на паузе','Bot paused','หยุดบอตชั่วคราว') }}</strong>
<p>{{ t('Сообщения сохраняются. Ответ менеджера автоматически появится в этом окне.','Messages are saved. The manager’s reply will appear in this window automatically.','ข้อความถูกบันทึกแล้ว คำตอบของผู้จัดการจะแสดงในหน้าต่างนี้โดยอัตโนมัติ') }}</p>
</div>
          <form v-if="orderStep === 1" class="chat-order" @submit.prevent="review">
            <div class="chat-card-title">
<strong>{{ t('Ваш демо-заказ','Your demo order','ออเดอร์สาธิต') }}</strong>
<button type="button" class="icon-button" :aria-label="t('Отменить заполнение','Cancel draft','ยกเลิกแบบร่าง')" @click="orderStep=0">
<AtelierIcon name="close" :size="16"/>
</button>
</div>
            <label>{{ t('Десерт','Treat','ขนม') }}<select v-model="productId" class="form-input">
<option v-for="p in products" :key="p.id" :value="p.id">{{ local(p.name) }} · {{ money(p.price) }}</option>
</select>
</label>
            <div class="chat-form-row">
<label>{{ t('Количество','Quantity','จำนวน') }}<input v-model.number="amount" class="form-input" type="number" min="1" max="20" required />
</label>
<label>{{ t('Дата','Date','วันที่') }}<input v-model="date" class="form-input" type="date" :min="minDate" required />
</label>
</div>
            <label>{{ t('Время Паттайи','Pattaya time','เวลาพัทยา') }}<select v-model="slot" class="form-input" :disabled="!date || availabilityLoading">
<option v-if="availabilityLoading" value="">{{ t('Проверяем…','Checking…','กำลังตรวจสอบ…') }}</option>
<option v-for="item in slots" :key="item.label" :value="item.label" :disabled="!item.available">{{ item.label }} · {{ item.available ? t(`свободно ${item.capacity-item.used}`,`${item.capacity-item.used} left`,`เหลือ ${item.capacity-item.used}`) : t('мест нет','full','เต็ม') }}</option>
</select>
</label>
            <label>{{ t('Получение','Receiving','การรับสินค้า') }}<select v-model="mode" class="form-input">
<option value="pickup">{{ t('Самовывоз','Pickup','รับที่ร้าน') }}</option>
<option value="delivery">{{ t('Доставка','Delivery','จัดส่ง') }}</option>
</select>
</label>
            <template v-if="mode==='delivery'">
<label>{{ t('Зона','Area','พื้นที่') }}<select v-model="area" class="form-input">
<option value="central">Central Pattaya · 120 ฿</option>
<option value="jomtien">Jomtien / Pratumnak · 180 ฿</option>
</select>
</label>
<label>{{ t('Тестовый адрес','Sample address','ที่อยู่สมมติ') }}<input v-model="address" class="form-input" required maxlength="200" />
</label>
</template>
            <label>{{ t('Тестовое имя','Fictional name','ชื่อสมมติ') }}<input v-model="customer" class="form-input" required maxlength="80" />
</label>
            <label>{{ t('Телефон или email для связи','Phone or email to contact you','เบอร์โทรศัพท์หรืออีเมลสำหรับติดต่อ') }}<input v-model="contact" class="form-input" type="text" required maxlength="120" :aria-invalid="contact.length > 0 && !validOrderContact(contact)" placeholder="demo@example.com" />
</label>
            <label>{{ t('Пожелания','Your wishes','ความต้องการ') }}<textarea v-model="note" class="form-input" maxlength="300" rows="2">
</textarea>
</label>
            <label class="check-card"><input v-model="accepted" type="checkbox" required/><span>{{ t('Согласен на сохранение данных для обработки заявки','I agree to save these details to process the request','ฉันยินยอมให้บันทึกข้อมูลเพื่อดำเนินการตามคำขอ') }}</span></label>
            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
<button class="btn btn-dark full-width" :disabled="availabilityLoading || !slot">{{ t('Проверить заказ','Review order','ตรวจสอบออเดอร์') }} · {{ money(total) }}</button>
          </form>
          <div v-if="orderStep === 2" class="chat-order">
<span class="eyebrow">{{ t('ПРОВЕРЬТЕ ПЕРЕД СОХРАНЕНИЕМ','REVIEW BEFORE SAVING','ตรวจสอบก่อนบันทึก') }}</span>
<h3>{{ product ? local(product.name) : '' }} × {{ amount }}</h3>
<p>{{ date }} · {{ slot }}</p>
<p>{{ customer }} · {{ contact }}</p>
<p>{{ mode==='delivery' ? address : t('Самовывоз','Pickup','รับที่ร้าน') }}</p>
<p>{{ note }}</p>
<div class="chat-review-total">{{ money(total) }}</div>
<p class="demo-note">{{ t('Сохранится в рабочей базе. Это заявка на проверку, а не подтверждённый производством заказ.','Saved in the workspace for review, not as a confirmed production order.','บันทึกในระบบเพื่อรอตรวจสอบ ยังไม่ใช่ออเดอร์ที่ยืนยันการผลิต') }}</p>
<p v-if="error" class="form-error" role="alert">{{ error }}</p>
<button class="btn btn-dark full-width" :disabled="submitting||orderRecoveryBusy||!!pendingOrder||orderStorageBlocked" @click="confirm">{{ submitting ? t('Сохраняем…','Saving…','กำลังบันทึก…') : t('Отправить тестовую заявку','Send test request','ส่งคำขอทดสอบ') }}</button>
<button class="text-link" :disabled="submitting||orderRecoveryBusy" @click="editOrder">{{ t('Изменить','Edit','แก้ไข') }}</button>
</div>
          <p v-if="lastOrder && !orderStep" class="chat-admin-link">{{ t('Номер заявки','Request reference','หมายเลขคำขอ') }}: {{ lastOrder }}</p>
          <div v-if="savedOrder&&!orderStep" class="chat-order" role="status">
            <p>{{savedOrderDate}} · {{savedOrderSlot}} · {{t('время Паттайи','Pattaya time','เวลาพัทยา')}}</p>
            <strong>{{money(savedOrder.totalMinor/100)}}</strong>
            <ul><li v-for="(item,index) in savedOrder.items" :key="index">{{item.name}} × {{item.quantity}} — {{money(item.lineTotalMinor/100)}}</li></ul>
            <p>{{t('Сохранено для проверки менеджером. Производство не подтверждено.','Saved for manager review. Production is not confirmed.','บันทึกเพื่อรอผู้จัดการตรวจสอบ ยังไม่ยืนยันการผลิต')}}</p>
          </div>
        </div>
        <form class="concierge-compose" @submit.prevent="send">
<label class="sr-only" for="concierge-input">{{ t('Ваше сообщение','Your message','ข้อความของคุณ') }}</label>
<input id="concierge-input" v-model="input" maxlength="600" :placeholder="t('Напишите, чем помочь…','How can we help?','ให้เราช่วยอะไรดี?')" autocomplete="off"/>
<button :disabled="!input.trim() || !ready || chatBusy" :aria-label="t('Отправить сообщение','Send message','ส่งข้อความ')">
<AtelierIcon name="arrow" :size="20" />
</button>
</form>
      </section>
    </Transition>
    <div v-if="visible" class="concierge-backdrop" aria-hidden="true" @click="close">
</div>
  </div>
</template>
