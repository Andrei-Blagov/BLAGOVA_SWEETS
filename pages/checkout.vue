<script setup lang="ts">
const {
  t,
  local,
  money,
  basket,
  total,
  leadDays,
  hydrated
} = useAtelier();
const mode = ref('pickup');
const date = ref('');
const slot = ref('10:00–12:00');
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
function submit() {
  error.value = '';
  if (!basket.value.length) return;
  if (!name.value.trim() || !contact.value.trim() || !date.value || date.value < earliestDate() || mode.value === 'delivery' && !address.value.trim() || mode.value === 'delivery' && surprise.value && !hotel.value.trim()) {
    error.value = t('Заполните обязательные поля и выберите доступную дату.', 'Complete the required fields and choose an available date.', 'กรอกข้อมูลที่จำเป็นและเลือกวันที่ที่พร้อมให้บริการ');
    return;
  }
  finalTotal.value = grandTotal.value;
  finalDate.value = date.value;
  reference.value = 'DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  finished.value = true;
  basket.value = [];
  // Deliberately local: no fetch, storage of contact details, payment or notification.
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
      <p>{{ t('Вы прошли весь путь заказа. Это демонстрация: мы ничего не отправили и не приняли оплату.','You have explored the full order journey. This was a demonstration: nothing was sent and no payment was taken.','คุณทดลองขั้นตอนสั่งซื้อครบแล้ว นี่เป็นการสาธิต ไม่มีการส่งข้อมูลหรือชำระเงิน') }}</p>
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
        <p>{{ t('Демонстрационное оформление. Используйте вымышленные контактные данные.','Demo checkout. Please use fictional contact details.','สาธิตการสั่งซื้อ กรุณาใช้ข้อมูลติดต่อสมมติ') }}</p>
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
                <select id="order-slot" v-model="slot" class="form-input">
                  <option>10:00–12:00</option>
                  <option>12:00–15:00</option>
                  <option>15:00–18:00</option>
                </select>
              </div>
            </div>
            <p class="demo-note">{{ t('Даты и интервалы тестовые. Они не означают, что производство уже работает.','Dates and slots are examples. They do not mean production is open.','วันและเวลาเป็นตัวอย่าง ไม่ได้หมายความว่าร้านเปิดดำเนินการแล้ว') }}</p>
          </fieldset>
          <fieldset class="option-field">
            <legend>
              <span class="step-number">03</span>{{ t('Как к вам обращаться','A little about you','ข้อมูลของคุณ') }}</legend>
            <label class="field-label" for="order-name">{{ t('Имя','Name','ชื่อ') }} *</label>
            <input id="order-name" v-model="name" class="form-input" required maxlength="80" :placeholder="t('Тестовый покупатель','Demo customer','ลูกค้าทดสอบ')" />
            <label class="field-label" for="order-contact">{{ t('Телефон, email или LINE','Phone, email or LINE','โทรศัพท์ อีเมล หรือ LINE') }} *</label>
            <input id="order-contact" v-model="contact" class="form-input" required maxlength="120" placeholder="demo@example.com" />
          </fieldset>
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
          <button type="submit" class="btn btn-dark full-width">{{ t('Завершить демо-заказ','Complete demo order','จบการสั่งซื้อสาธิต') }}<AtelierIcon name="arrow" />
          </button>
          <p class="demo-note">{{ t('Без оплаты и отправки данных. Корзина очистится после завершения демонстрации.','No payment or data submission. Your bag clears when the demo is complete.','ไม่มีการชำระเงินหรือส่งข้อมูล ตะกร้าจะถูกล้างเมื่อจบการสาธิต') }}</p>
        </aside>
      </form>
    </template>
  </section>
</template>
