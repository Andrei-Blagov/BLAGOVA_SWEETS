<script setup lang="ts">
import { atelierProducts } from '~/data/atelier';
import { bangkokDate } from '~/data/operations';
const {
  t,
  local,
  money,
  locale
} = useAtelier();
const {
  chatOpen,
  thread,
  message,
  createOrder,
  findKnowledge,
  ready,
  storageWarning
} = useOperations();
const route = useRoute();
const input = ref('');
const panel = ref<HTMLElement>();
const log = ref<HTMLElement>();
const launcher = ref<HTMLButtonElement>();
const orderStep = ref(0);
const productId = ref(atelierProducts[0]!.id);
const amount = ref(1);
const date = ref('');
const slot = ref('10:00–12:00');
const mode = ref<'pickup' | 'delivery'>('pickup');
const area = ref('central');
const customer = ref('');
const contact = ref('');
const address = ref('');
const note = ref('');
const error = ref('');
const requestKey = ref('');
const lastOrder = ref('');
const product = computed(() => atelierProducts.find(p => p.id === productId.value)!);
const minDate = computed(() => bangkokDate(Math.max(1, product.value.leadDays)));
const delivery = computed(() => mode.value === 'pickup' ? 0 : area.value === 'central' ? 120 : 180);
const total = computed(() => product.value.price * amount.value + delivery.value);
const visible = computed(() => chatOpen.value && route.path !== '/admin');
const modeLabel = computed(() => thread.value.mode === 'bot' ? t('Демо-помощник', 'Demo assistant', 'ผู้ช่วยสาธิต') : t('Режим менеджера · демо', 'Manager mode · demo', 'โหมดผู้จัดการ · เดโม'));
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
function close() {
  chatOpen.value = false;
  nextTick(() => launcher.value?.focus());
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
function startOrder() {
  if (thread.value.mode !== 'bot') return;
  requestKey.value = demoId();
  lastOrder.value = '';
  error.value = '';
  orderStep.value = 1;
  scrollBottom();
}
function requestManager() {
  if (thread.value.mode !== 'bot') return;
  orderStep.value = 0;
  thread.value.mode = 'requested';
  message('assistant', t('Демо-запрос создан. Откройте «Диалоги» в демо-админке, чтобы попробовать ответ менеджера. Уведомления в LINE ещё не подключены.', 'Demo handoff created. Open Conversations in the demo admin to try a manager reply. LINE notifications are not connected.', 'สร้างคำขอสาธิตแล้ว เปิดหน้าผู้ดูแลเพื่อทดลองตอบ การแจ้งเตือน LINE ยังไม่เชื่อมต่อ'));
}
function send() {
  const text = input.value.trim();
  if (!text || !ready.value) return;
  message('customer', text);
  input.value = '';
  if (thread.value.mode !== 'bot') return;
  if (/менеджер|человек|manager|human|พนักงาน|ผู้จัดการ/i.test(text)) {
    requestManager();
    return;
  }
  // Deliberately deterministic preview. No model or vector search is called.
  const answer = findKnowledge(text);
  if (answer) {
    message('assistant', answer.answers[locale.value], answer.title);
    return;
  }
  if (/заказ|закаж|хочу.*торт|хочу.*капкейк|order|want.*cake|สั่ง/i.test(text)) {
    message('assistant', t('Давайте соберём демо-заказ. Выберите десерт и дату ниже. Все цены примерные, используйте вымышленные контакты.', 'Let’s build a demo order. Choose a treat and date below. Prices are illustrative; use fictional contact details.', 'มาลองสั่งซื้อ เลือกขนมและวันที่ด้านล่าง ราคาเป็นตัวอย่าง กรุณาใช้ข้อมูลสมมติ'));
    startOrder();
    return;
  }
  message('assistant', t('В опубликованных материалах пока нет утверждённого ответа. Я могу помочь собрать демо-заказ или переключить диалог в режим менеджера.', 'There is no approved answer in the published material yet. I can help build a demo order or switch this conversation to manager mode.', 'ยังไม่มีคำตอบที่ยืนยันในข้อมูลที่เผยแพร่ ฉันช่วยสร้างออเดอร์สาธิตหรือเปลี่ยนเป็นโหมดผู้จัดการได้'));
}
function review() {
  error.value = '';
  if (!Number.isInteger(amount.value) || amount.value < 1 || amount.value > 20 || !date.value || date.value < bangkokDate(Math.max(1, product.value.leadDays)) || !customer.value.trim() || !contact.value.trim() || mode.value === 'delivery' && !address.value.trim()) {
    error.value = t('Проверьте количество, дату и обязательные поля.', 'Check quantity, date and required fields.', 'ตรวจสอบจำนวน วันที่ และข้อมูลที่จำเป็น');
    return;
  }
  orderStep.value = 2;
  scrollBottom();
}
function confirm() {
  if (orderStep.value !== 2) return;
  if (date.value < bangkokDate(Math.max(1, product.value.leadDays))) {
    orderStep.value = 1;
    error.value = t('Выберите доступную дату.', 'Choose an available date.', 'เลือกวันที่ที่พร้อม');
    return;
  }
  try {
    const o = createOrder({
      requestKey: requestKey.value,
      source: 'chat',
      conversationId: thread.value.id,
      customer: customer.value.trim(),
      contact: contact.value.trim(),
      date: date.value,
      slot: slot.value,
      mode: mode.value,
      address: mode.value === 'delivery' ? address.value.trim() : '',
      note: note.value.trim(),
      delivery: delivery.value,
      items: [{
        name: local(product.value.name),
        price: product.value.price,
        quantity: amount.value,
        detail: local(product.value.unit)
      }]
    });
    message('customer', `${local(product.value.name)} × ${amount.value} · ${date.value} · ${money(total.value)}`);
    message('assistant', t(`Демо-заявка ${o.id} сохранена в этом браузере со статусом «На проверке». Она появилась в демо-админке и локальном календаре. В LINE и Google Calendar ничего не отправлено.`, `Demo request ${o.id} is saved in this browser, awaiting review. Find it in the demo admin and local calendar. Nothing was sent to LINE or Google Calendar.`, `บันทึกคำขอสาธิต ${o.id} ในเบราว์เซอร์นี้แล้ว รอการตรวจสอบ ดูได้ในหน้าผู้ดูแลและปฏิทินสาธิต ไม่มีการส่งไป LINE หรือ Google Calendar`));
    lastOrder.value = o.id;
    orderStep.value = 0;
    customer.value = '';
    contact.value = '';
    address.value = '';
    note.value = '';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Demo error';
  }
}
</script>
<template>
  <div v-if="route.path !== '/admin'" class="concierge">
    <button v-if="!visible" ref="launcher" class="concierge-launcher" :disabled="!ready" aria-haspopup="dialog" :aria-label="t('Открыть чат','Open chat','เปิดแชต')" @click="chatOpen = true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
<path d="M20 11.5a8 8 0 0 1-8 8H5l-4 3 2-6a8 8 0 1 1 17-5Z"/>
<path d="M7 10h8M7 14h5"/>
</svg>
      <span>{{ t('Помочь с выбором?','A little help?','ให้เราช่วยไหม?') }}</span>
<span class="chat-demo-dot">DEMO</span>
    </button>
    <Transition name="concierge">
      <section v-if="visible" ref="panel" class="concierge-panel" role="dialog" aria-modal="true" aria-labelledby="concierge-title" tabindex="-1" @keydown="trap">
        <header class="concierge-head">
<div class="concierge-avatar">B</div>
<div>
<h2 id="concierge-title">BLAGOVA concierge</h2>
<p>{{ modeLabel }}</p>
</div>
<button class="icon-button" :aria-label="t('Закрыть чат','Close chat','ปิดแชต')" @click="close">
<AtelierIcon name="close" />
</button>
</header>
        <p class="concierge-disclaimer">{{ t('Демо в этом браузере. Используйте вымышленные данные. AI, LINE и Google ещё не подключены.','Local browser demo. Use fictional details. AI, LINE and Google are not connected yet.','เดโมในเบราว์เซอร์นี้ ใช้ข้อมูลสมมติ AI, LINE และ Google ยังไม่เชื่อมต่อ') }}</p>
        <p v-if="storageWarning" class="form-error">{{ t('Не удалось сохранить часть данных в браузере.','Some data could not be saved in this browser.','บันทึกข้อมูลบางส่วนไม่ได้') }}</p>
        <div ref="log" class="concierge-body">
          <div class="chat-welcome">
<span class="eyebrow">A LITTLE HELP, A LOT OF CARE</span>
<h3>{{ t('С чего начнём?','Where shall we start?','เริ่มจากอะไรดี?') }}</h3>
<p>{{ t('Подберём сладкое, соберём заявку или ответим на вопрос о проекте.','Find a treat, build a request or ask about our little project.','เลือกขนม สร้างคำขอ หรือถามเกี่ยวกับโครงการ') }}</p>
</div>
          <div class="chat-quick">
<button :disabled="thread.mode !== 'bot'" @click="startOrder">{{ t('Собрать заказ','Build an order','ลองสั่งซื้อ') }}<AtelierIcon name="arrow" :size="14" />
</button>
<button @click="input=t('Когда открытие?','When do you open?','เปิดเมื่อไร?'); send()">{{ t('Об открытии','Opening','วันเปิด') }}</button>
<button :disabled="thread.mode !== 'bot'" @click="requestManager">{{ t('Менеджер','Manager','ผู้จัดการ') }}</button>
</div>
          <div class="chat-log" role="log" aria-live="polite" aria-relevant="additions">
            <article v-for="m in thread.messages" :key="m.id" :class="['chat-bubble', 'chat-'+m.role]">
<small>{{ m.role === 'customer' ? t('Вы','You','คุณ') : m.role === 'manager' ? t('Менеджер · демо','Manager · demo','ผู้จัดการ · เดโม') : t('Помощник · демо','Assistant · demo','ผู้ช่วย · เดโม') }}</small>
<p>{{ m.text }}</p>
<span v-if="m.source" class="chat-source">{{ t('Материал','Source','แหล่งข้อมูล') }}: {{ m.source }}</span>
</article>
          </div>
          <div v-if="thread.mode !== 'bot'" class="chat-handoff">
<strong>{{ t('Бот на паузе','Bot paused','หยุดบอตชั่วคราว') }}</strong>
<p>{{ t('Попробуйте ответ менеджера в демо-админке. Реальный менеджер не уведомлён.','Try a manager reply in the demo admin. No real manager was notified.','ทดลองตอบในหน้าผู้ดูแล ไม่มีการแจ้งผู้จัดการจริง') }}</p>
<NuxtLink to="/admin?tab=conversations" @click="chatOpen=false">{{ t('Открыть диалог в админке','Open admin conversation','เปิดแชตในหน้าผู้ดูแล') }} →</NuxtLink>
</div>
          <form v-if="orderStep === 1" class="chat-order" @submit.prevent="review">
            <div class="chat-card-title">
<strong>{{ t('Ваш демо-заказ','Your demo order','ออเดอร์สาธิต') }}</strong>
<button type="button" class="icon-button" :aria-label="t('Отменить заполнение','Cancel draft','ยกเลิกแบบร่าง')" @click="orderStep=0">
<AtelierIcon name="close" :size="16"/>
</button>
</div>
            <label>{{ t('Десерт','Treat','ขนม') }}<select v-model="productId" class="form-input">
<option v-for="p in atelierProducts" :key="p.id" :value="p.id">{{ local(p.name) }} · {{ money(p.price) }}</option>
</select>
</label>
            <div class="chat-form-row">
<label>{{ t('Количество','Quantity','จำนวน') }}<input v-model.number="amount" class="form-input" type="number" min="1" max="20" required />
</label>
<label>{{ t('Дата','Date','วันที่') }}<input v-model="date" class="form-input" type="date" :min="minDate" required />
</label>
</div>
            <label>{{ t('Время Паттайи','Pattaya time','เวลาพัทยา') }}<select v-model="slot" class="form-input">
<option>10:00–12:00</option>
<option>12:00–15:00</option>
<option>15:00–18:00</option>
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
            <label>{{ t('Тестовый контакт','Fictional contact','ข้อมูลติดต่อสมมติ') }}<input v-model="contact" class="form-input" required maxlength="120" placeholder="demo@example.com" />
</label>
            <label>{{ t('Пожелания','Your wishes','ความต้องการ') }}<textarea v-model="note" class="form-input" maxlength="300" rows="2">
</textarea>
</label>
            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
<button class="btn btn-dark full-width">{{ t('Проверить заказ','Review order','ตรวจสอบออเดอร์') }} · {{ money(total) }}</button>
          </form>
          <div v-if="orderStep === 2" class="chat-order">
<span class="eyebrow">{{ t('ПРОВЕРЬТЕ ПЕРЕД СОХРАНЕНИЕМ','REVIEW BEFORE SAVING','ตรวจสอบก่อนบันทึก') }}</span>
<h3>{{ local(product.name) }} × {{ amount }}</h3>
<p>{{ date }} · {{ slot }}</p>
<p>{{ customer }} · {{ contact }}</p>
<p>{{ mode==='delivery' ? address : t('Самовывоз','Pickup','รับที่ร้าน') }}</p>
<p>{{ note }}</p>
<div class="chat-review-total">{{ money(total) }}</div>
<p class="demo-note">{{ t('Сохранится только в этом браузере и демо-админке. Это не принятый производством заказ.','Saved only in this browser and demo admin. This is not an accepted production order.','บันทึกเฉพาะเบราว์เซอร์และหน้าผู้ดูแลสาธิต ไม่ใช่ออเดอร์จริง') }}</p>
<p v-if="error" class="form-error" role="alert">{{ error }}</p>
<button class="btn btn-dark full-width" @click="confirm">{{ t('Сохранить демо-заявку','Save demo request','บันทึกคำขอสาธิต') }}</button>
<button class="text-link" @click="orderStep=1">{{ t('Изменить','Edit','แก้ไข') }}</button>
</div>
          <NuxtLink v-if="lastOrder && !orderStep" class="chat-admin-link" to="/admin" @click="chatOpen=false">{{ t('Посмотреть заявку в админке','View request in admin','ดูคำขอในหน้าผู้ดูแล') }} →</NuxtLink>
        </div>
        <form class="concierge-compose" @submit.prevent="send">
<label class="sr-only" for="concierge-input">{{ t('Ваше сообщение','Your message','ข้อความของคุณ') }}</label>
<input id="concierge-input" v-model="input" maxlength="600" :placeholder="t('Напишите, чем помочь…','How can we help?','ให้เราช่วยอะไรดี?')" autocomplete="off"/>
<button :disabled="!input.trim() || !ready" :aria-label="t('Отправить сообщение','Send message','ส่งข้อความ')">
<AtelierIcon name="arrow" :size="20" />
</button>
</form>
      </section>
    </Transition>
    <div v-if="visible" class="concierge-backdrop" aria-hidden="true" @click="close">
</div>
  </div>
</template>
