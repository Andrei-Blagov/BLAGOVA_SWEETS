<script setup lang="ts">
import { atelierProducts } from '~/data/atelier';
const route = useRoute();
const product = computed(() => atelierProducts.find(p => p.id === route.params.slug));
if (!product.value) throw createError({
  statusCode: 404,
  statusMessage: 'Dessert not found'
});
const {
  t,
  local,
  money,
  add
} = useAtelier();
const size = ref(1);
const message = ref('');
watch(() => route.params.slug, () => {
  size.value = 1;
  message.value = '';
});
const price = computed(() => Math.round((product.value?.price || 0) * size.value));
function addProduct() {
  const p = product.value;
  if (!p) return;
  const detail = [p.category === 'cakes' ? `${size.value} ${t('кг', 'kg', 'กก.')}` : local(p.unit), message.value.trim()].filter(Boolean).join(' · ');
  add({
    key: JSON.stringify([p.id, size.value, message.value.trim()]),
    productId: p.id,
    sku: p.category === 'cakes' ? `${p.id}-${String(size.value).replace('.', '_')}kg` : `${p.id}-standard`,
    name: p.name,
    image: p.image,
    price: price.value,
    detail,
    personalization: message.value.trim(),
    configuration: {},
    leadDays: p.leadDays
  });
}
useSeoMeta({
  title: () => `${product.value ? local(product.value.name) : ''} — BLAGOVA SWEETS`
});
</script>
<template>
  <section v-if="product" class="shell section">
    <NuxtLink to="/menu" class="breadcrumb">← {{ t('Вся коллекция','Back to collection','กลับไปคอลเลกชัน') }}</NuxtLink>
    <div class="product-detail">
      <div class="detail-photo">
        <img :src="product.image" :alt="local(product.name)" width="1000" height="1000" />
        <span class="photo-label">{{ t('ФОТО ДЛЯ ПРОТОТИПА','PROTOTYPE IMAGE','ภาพสำหรับต้นแบบ') }}</span>
      </div>
      <div class="detail-copy">
        <span class="eyebrow">HANDMADE, HEARTFELT</span>
        <h1>{{ local(product.name) }}</h1>
        <p class="detail-subtitle">{{ local(product.subtitle) }}</p>
        <p>{{ local(product.description) }}</p>
        <div class="detail-price">{{ money(price) }}<span>{{ t('тестовая цена','sample price','ราคาตัวอย่าง') }}</span>
        </div>
        <fieldset v-if="product.category==='cakes'" class="option-field">
          <legend>{{ t('Размер торта','Cake size','ขนาดเค้ก') }}</legend>
          <div class="choice-row">
            <button v-for="weight in [1,1.5,2]" :key="weight" :class="{selected:size===weight}" :aria-pressed="size===weight" @click="size=weight">{{ weight }} {{ t('кг','kg','กก.') }}<small>{{ Math.round(weight*6) }}–{{ Math.round(weight*8) }} {{ t('порций','servings','ที่') }}</small>
            </button>
          </div>
        </fieldset>
        <label class="field-label" for="personal-message">{{ t('Добавить ваши слова','Add your words','เพิ่มข้อความของคุณ') }}<span>{{ t('необязательно','optional','ไม่บังคับ') }}</span>
        </label>
        <input id="personal-message" v-model="message" class="form-input" maxlength="40" :placeholder="t('Например: С днём рождения, Анна','For example: Happy birthday, Anna','เช่น สุขสันต์วันเกิด แอนนา')" />
        <div class="input-meta">{{ message.length }}/40</div>
        <button class="btn btn-dark full-width" @click="addProduct">{{ t('Добавить в корзину','Add to bag','เพิ่มลงตะกร้า') }}<AtelierIcon name="bag" />
        </button>
        <div class="detail-assurances">
          <span>
            <AtelierIcon name="clock" />{{ t('Пример срока изготовления','Sample lead time','ระยะเวลาผลิตตัวอย่าง') }}: {{ product.leadDays || 1 }} {{ t('дн.','days','วัน') }}</span>
          <span>
            <AtelierIcon name="pin" />{{ t('Самовывоз или доставка по Паттайе','Pickup or delivery in Pattaya','รับที่ร้านหรือจัดส่งในพัทยา') }}</span>
        </div>
        <details class="info-disclosure">
          <summary>{{ t('Состав и аллергены','Ingredients & allergens','ส่วนผสมและสารก่อภูมิแพ้') }}<AtelierIcon name="plus" :size="16" />
          </summary>
          <p>{{ local(product.allergens) }}</p>
          <p>{{ t('Состав демонстрационный. Перед запуском каждая рецептура будет проверена.','Sample ingredients. Every recipe must be verified before launch.','ส่วนผสมตัวอย่าง ต้องตรวจสอบทุกสูตรก่อนเปิดขายจริง') }}</p>
        </details>
        <details class="info-disclosure">
          <summary>{{ t('О прототипе и заказе','About this prototype','เกี่ยวกับต้นแบบ') }}<AtelierIcon name="plus" :size="16" />
          </summary>
          <p>{{ t('Вы можете пройти весь путь и отправить тестовую заявку в рабочую базу. Оплата не списывается; фото и оформление — примеры.','Explore the full journey and submit a test request to the workspace. No payment is taken; images and designs are examples.','ทดลองขั้นตอนทั้งหมดและส่งคำขอทดสอบเข้าระบบได้ ไม่มีการชำระเงิน ภาพและรูปแบบเป็นตัวอย่าง') }}</p>
        </details>
      </div>
    </div>
  </section>
</template>
