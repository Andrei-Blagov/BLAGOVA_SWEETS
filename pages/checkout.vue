<script setup lang="ts">
import { validOrderContact } from '~/supabase/functions/_shared/orderContact';
import type { StorefrontSlot } from '~/composables/useAvailability';
const {
  t,
  local,
  money,
  basket,
  total,
  leadDays,
  hydrated,
  locale
} = useAtelier();
const { submitOrder } = usePublicIntake();
const { getAvailability } = useAvailability();
const requestKey = ref('');
const mode = ref('pickup');
const date = ref('');
const slot = ref('09:00–12:00');
const slots = ref<StorefrontSlot[]>([]);
const availabilityLoading = ref(false);
let availabilityRequest = 0;
const area = ref('central');
const name = ref('');
const contact = ref('');
const address = ref('');
const surprise = ref(false);
const hotel = ref('');
const finished = ref(false);
const error = ref('');
const finalTotal = ref(0);
const finalDate = ref('');
const reference = ref('');
const submitting = ref(false);
const accepted = ref(false);
function earliestDate() {
  const now = new Date(new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Bangkok'
  }));
  now.setDate(now.getDate() + Math.max(1, leadDays.value));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
const minDate = computed(earliestDate);
const delivery = computed(() => mode.value === 'pickup' ? 0 : area.value === 'central' ? 120 : 180);
const grandTotal = computed(() => total.value + delivery.value);
watch(date, async value => {
  const request = ++availabilityRequest;
  slots.value = [];
  if (!value) return;
  availabilityLoading.value = true;
  try {
    const result = await getAvailability(value);
    if (request !== availabilityRequest) return;
    slots.value = result;
    if (!result.some(item => item.label === slot.value && item.available)) slot.value = result.find(item => item.available)?.label || '';
  } catch {
    if (request === availabilityRequest) error.value = t('Не удалось проверить свободное время. Попробуйте ещё раз.', 'Could not check available times. Try again.', 'ไม่สามารถตรวจสอบเวลาว่างได้ โปรดลองอีกครั้ง');
  } finally { if (request === availabilityRequest) availabilityLoading.value = false; }
});
async function submit() {
  error.value = '';
  if (!basket.value.length) return;
  if (!name.value.trim() || !date.value || date.value < earliestDate() || !slot.value || !slots.value.some(item => item.label === slot.value && item.available) || mode.value === 'delivery' && !address.value.trim() || mode.value === 'delivery' && surprise.value && !hotel.value.trim() || !accepted.value) {
    error.value = t('Заполните обязательные поля и выберите доступную дату.', 'Complete the required fields and choose an available date.', 'กรอกข้อมูลที่จำเป็นและเลือกวันที่ที่พร้อมให้บริการ');
    return;
  }
  if (!validOrderContact(contact.value)) {
    error.value = t('Укажите действующий телефон или email для связи.', 'Enter a valid phone number or email so we can contact you.', 'กรุณากรอกเบอร์โทรศัพท์หรืออีเมลที่ถูกต้องเพื่อติดต่อกลับ');
    return;
  }
  finalDate.value = date.value;
  if (!requestKey.value) requestKey.value = newUuid();
  submitting.value = true;
  try {
    const result = await submitOrder({ requestKey: requestKey.value, source: 'website', locale: locale.value, customerName: name.value.trim(), customerContact: contact.value.trim(), date: date.value, slot: slot.value, fulfillment: mode.value === 'delivery' ? 'delivery' : 'pickup', deliveryAddress: mode.value === 'delivery' ? address.value.trim() : '', deliveryZone: mode.value === 'delivery' ? area.value as 'central' | 'jomtien' : 'pickup', note: mode.value === 'delivery' && surprise.value ? hotel.value.trim() : '', items: basket.value.map(i => ({ sku: i.sku, quantity: i.quantity, personalization: i.personalization, description: ['custom-gift','celebration-set'].includes(i.productId) ? i.detail : '', configuration: i.configuration })) });
    reference.value = result.reference;
    finalTotal.value = result.totalMinor / 100;
  } catch (e) {
    const code = e instanceof Error ? e.message : '';
    error.value = code === 'rate_limit' ? t('Слишком много попыток. Подождите 15 минут.', 'Too many attempts. Try again in 15 minutes.', 'มีการส่งหลายครั้งเกินไป โปรดลองใหม่ใน 15 นาที')
      : ['slot_capacity_full','slot_unavailable'].includes(code) ? t('Этот интервал уже недоступен. Выберите другое время.', 'This time slot is no longer available. Choose another time.', 'ช่วงเวลานี้ไม่ว่างแล้ว โปรดเลือกเวลาอื่น')
      : t('Не удалось сохранить заявку. Проверьте соединение и попробуйте ещё раз.', 'We could not save the request. Check your connection and try again.', 'ไม่สามารถบันทึกคำขอได้ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง');
    return;
  } finally { submitting.value = false; }
  finished.value = true;
  basket.value = [];
}
</script>
<template>
  <section class="shell section">
    <div v-if="finished" class="checkout-success">
      <div class="success-seal">
        <AtelierIcon name="check" :size="40" />
      </div>
      <span class="eyebrow">{{ reference }}</span>
      <h1>{{ t('Кажется, это','That was','นี่คือ') }} <em>{{ t('любовь.','lovely.','ความสุข') }}</em>
      </h1>
      <p>{{ t('Заявка сохранена в рабочей базе и ожидает проверки менеджером. Это прототип: заявка не подтверждает производство, оплата не списывалась.','Your request is in the workspace and awaits manager review. This is a prototype: production is not confirmed and no payment was taken.','บันทึกคำขอในระบบแล้วและรอผู้จัดการตรวจสอบ นี่คือต้นแบบ ยังไม่ยืนยันการผลิตและไม่มีการชำระเงิน') }}</p>
      <div class="success-details">
        <span>{{ finalDate }} · {{ slot }} · {{ t('время Паттайи','Pattaya time','เวลาพัทยา') }}</span>
        <strong>{{ money(finalTotal) }}</strong>
      </div>
      <NuxtLink to="/" class="btn btn-dark">{{ t('Вернуться на главную','Back to the little joys','กลับหน้าหลัก') }}<AtelierIcon name="arrow" />
      </NuxtLink>
    </div>
    <template v-else>
      <div class="page-intro">
        <span class="eyebrow">THE LAST LITTLE DETAILS</span>
        <h1>{{ t('Почти','Almost','เกือบ') }} <em>{{ t('готово.','there.','เสร็จแล้ว') }}</em>
        </h1>
        <p>{{ t('Тестовая заявка сохранится в рабочей базе Supabase и появится у менеджера.','The test request will be saved in the Supabase workspace for the manager.','คำขอทดสอบจะบันทึกในระบบ Supabase และแสดงให้ผู้จัดการเห็น') }}</p>
      </div>
      <div v-if="!hydrated" class="empty-state">{{ t('Загружаем…','Loading…','กำลังโหลด…') }}</div>
      <div v-else-if="!basket.length" class="empty-state">
        <h2>{{ t('Сначала выберем сладкое?','Something sweet first?','เลือกขนมก่อนดีไหม?') }}</h2>
        <NuxtLink to="/menu" class="btn btn-dark">{{ t('В каталог','Explore treats','ดูขนม') }}</NuxtLink>
      </div>
      <form v-else class="checkout-grid" @submit.prevent="submit">
        <div class="checkout-form">
          <fieldset class="option-field">
            <legend>
              <span class="step-number">01</span>{{ t('Как получить','How to receive it','วิธีรับสินค้า') }}</legend>
            <div class="choice-row">
              <button type="button" :class="{selected:mode==='pickup'}" :aria-pressed="mode==='pickup'" @click="mode='pickup'">{{ t('Самовывоз','Pickup','รับที่ร้าน') }}<small>{{ t('Из будущей кофейни','From the future café','จากคาเฟ่ในอนาคต') }}</small>
              </button>
              <button type="button" :class="{selected:mode==='delivery'}" :aria-pressed="mode==='delivery'" @click="mode='delivery'">{{ t('Доставка','Delivery','จัดส่ง') }}<small>Pattaya</small>
              </button>
            </div>
          </fieldset>
          <div v-if="mode==='delivery'">
            <label class="field-label" for="delivery-zone">{{ t('Зона доставки','Delivery area','พื้นที่จัดส่ง') }}</label>
            <select id="delivery-zone" v-model="area" class="form-input">
              <option value="central">{{ t('Центральная Паттайя · 120 ฿','Central Pattaya · ฿120','พัทยากลาง · ฿120') }}</option>
              <option value="jomtien">{{ t('Джомтьен / Пратамнак · 180 ฿','Jomtien / Pratumnak · ฿180','จอมเทียน / พระตำหนัก · ฿180') }}</option>
            </select>
            <label class="field-label" for="delivery-address">{{ t('Адрес или название отеля','Address or hotel name','ที่อยู่หรือชื่อโรงแรม') }} *</label>
            <input id="delivery-address" v-model="address" class="form-input" required maxlength="200" :placeholder="t('Тестовый адрес доставки','Sample delivery address','ที่อยู่จัดส่งตัวอย่าง')" />
            <label class="check-card">
              <input v-model="surprise" type="checkbox" />
              <span>{{ t('Это сюрприз для другого человека','It’s a surprise for someone else','เป็นเซอร์ไพรส์สำหรับคนอื่น') }}</span>
              <AtelierIcon name="gift" />
            </label>
            <template v-if="surprise">
              <label class="field-label" for="hotel-contact">{{ t('Получатель и инструкции ресепшену','Recipient & reception instructions','ผู้รับและคำแนะนำสำหรับแผนกต้อนรับ') }} *</label>
              <textarea id="hotel-contact" v-model="hotel" required class="form-input" maxlength="300" rows="2" :placeholder="t('Кому передать, когда связаться, как сохранить сюрприз','Who it is for, who to contact, how to keep the surprise','ผู้รับ ผู้ติดต่อ และวิธีรักษาเซอร์ไพรส์')">
              </textarea>
            </template>
          </div>
          <fieldset class="option-field">
            <legend>
              <span class="step-number">02</span>{{ t('Выберите момент','Choose your moment','เลือกเวลา') }}</legend>
            <div class="form-two">
              <div>
                <label class="field-label" for="order-date">{{ t('Дата','Date','วันที่') }} *</label>
                <input id="order-date" v-model="date" class="form-input" type="date" :min="minDate" required />
              </div>
              <div>
                <label class="field-label" for="order-slot">{{ t('Время Паттайи','Pattaya time','เวลาพัทยา') }}</label>
                <select id="order-slot" v-model="slot" class="form-input" :disabled="!date || availabilityLoading">
                  <option v-if="availabilityLoading" value="">{{ t('Проверяем…','Checking…','กำลังตรวจสอบ…') }}</option>
                  <option v-for="item in slots" :key="item.label" :value="item.label" :disabled="!item.available">{{ item.label }} · {{ item.available ? t(`свободно ${item.capacity-item.used}`,`${item.capacity-item.used} left`,`เหลือ ${item.capacity-item.used}`) : t('мест нет','full','เต็ม') }}</option>
                </select>
              </div>
            </div>
            <p class="demo-note">{{ t('Работаем ежедневно 09:00–18:00. На один интервал принимаем до 4 подтверждённых заказов.','Daily 09:00–18:00. Each slot accepts up to 4 confirmed orders.','เปิดทุกวัน 09:00–18:00 รับออเดอร์ที่ยืนยันแล้วสูงสุด 4 รายการต่อช่วงเวลา') }}</p>
          </fieldset>
          <fieldset class="option-field">
            <legend>
              <span class="step-number">03</span>{{ t('Как к вам обращаться','A little about you','ข้อมูลของคุณ') }}</legend>
            <label class="field-label" for="order-name">{{ t('Имя','Name','ชื่อ') }} *</label>
            <input id="order-name" v-model="name" class="form-input" required maxlength="80" :placeholder="t('Тестовый покупатель','Demo customer','ลูกค้าทดสอบ')" />
            <label class="field-label" for="order-contact">{{ t('Телефон или email','Phone or email','เบอร์โทรศัพท์หรืออีเมล') }} *</label>
            <input id="order-contact" v-model="contact" class="form-input" type="text" required maxlength="120" :aria-invalid="contact.length > 0 && !validOrderContact(contact)" placeholder="demo@example.com" />
          </fieldset>
          <label class="check-card">
            <input v-model="accepted" type="checkbox" required />
            <span>{{ t('Согласен на сохранение указанных данных для обработки этой заявки','I agree to save these details to process this request','ฉันยินยอมให้บันทึกข้อมูลเพื่อดำเนินการตามคำขอนี้') }}</span>
          </label>
        </div>
        <aside class="order-summary">
          <span class="eyebrow">YOUR SWEET SELECTION</span>
          <h3>{{ t('Всё самое любимое','All your favourites','ขนมที่คุณชอบ') }}</h3>
          <div v-for="item in basket" :key="item.key" class="checkout-mini-row">
            <img :src="item.image" :alt="local(item.name)" width="56" height="56" />
            <span>{{ local(item.name) }}<small>× {{ item.quantity }}</small>
            </span>
            <strong>{{ money(item.price*item.quantity) }}</strong>
          </div>
          <div class="summary-line">
            <span>{{ t('Подытог','Subtotal','ยอดรวมสินค้า') }}</span>
            <span>{{ money(total) }}</span>
          </div>
          <div class="summary-line">
            <span>{{ t('Доставка','Delivery','จัดส่ง') }}</span>
            <span>{{ delivery ? money(delivery) : t('Бесплатно','Free','ฟรี') }}</span>
          </div>
          <div class="summary-total">
            <span>{{ t('Итого','Total','รวม') }}</span>
            <strong>{{ money(grandTotal) }}</strong>
          </div>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <button type="submit" class="btn btn-dark full-width" :disabled="submitting || availabilityLoading || !slot">{{ submitting ? t('Сохраняем…','Saving…','กำลังบันทึก…') : t('Отправить тестовую заявку','Send test request','ส่งคำขอทดสอบ') }}<AtelierIcon name="arrow" />
          </button>
          <p class="demo-note">{{ t('Оплата не производится. Заявка не считается подтверждённым заказом до ответа менеджера.','No payment is taken. The request is not a confirmed order until a manager responds.','ไม่มีการชำระเงิน คำขอยังไม่ใช่ออเดอร์ที่ยืนยันจนกว่าผู้จัดการจะตอบกลับ') }}</p>
        </aside>
      </form>
    </template>
  </section>
</template>
