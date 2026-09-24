<script setup lang="ts">
import { optionConfiguration, optionTotal, selectedOptions } from '~/utils/catalogOptions.mjs';
const { products, loading, error: catalogError, load: loadCatalog } = useCatalog();
onMounted(() => loadCatalog());
const route = useRoute();
const product = computed(() => products.value.find(p => p.id === route.params.slug));
const selectedSku = ref('');
const variant = computed(() => product.value?.variants?.find(v => v.sku === selectedSku.value) || product.value?.variants?.[0]);
const { t, local, money, add } = useAtelier();
const message = ref('');
const chosenOptions = ref<Record<string,string>>({});
watch(product, p => { selectedSku.value = p?.variants?.[0]?.sku || ''; }, { immediate:true });
watch(() => route.params.slug, () => { message.value = ''; chosenOptions.value = {}; });
const price = computed(() => (variant.value?.price || 0) + optionTotal(product.value?.options, chosenOptions.value));
function addProduct() {
  const p = product.value; const v = variant.value;
  if (!p || !v) return;
  const options = optionConfiguration(chosenOptions.value);
  const detail = [local(v.name), ...selectedOptions(p.options, options).map(option => local(option.label)), message.value.trim()].filter(Boolean).join(' · ');
  add({
    key: JSON.stringify([p.id, v.sku, options, message.value.trim()]),
    productId: p.id, sku: v.sku, name: p.name, image: p.image,
    price: price.value, detail, personalization: message.value.trim(),
    configuration: { options }, leadDays: v.leadDays
  });
}
useSeoMeta({ title: () => `${product.value ? local(product.value.name) : ''} — BLAGOVA SWEETS` });
</script>
<template>
  <section v-if="!product" class="shell section"><p v-if="catalogError" role="alert">{{ catalogError }}</p><p v-else-if="loading || !products.length">{{ t('Загружаем товар…','Loading product…','กำลังโหลดสินค้า…') }}</p><p v-else>{{ t('Товар не найден','Product not found','ไม่พบสินค้า') }}</p><NuxtLink to="/menu">{{ t('В каталог','Back to collection','กลับไปที่สินค้า') }}</NuxtLink></section>
  <section v-else class="shell section">
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
        <fieldset v-if="product.variants && product.variants.length>1" class="option-field">
          <legend>{{ t('Вариант','Variant','ตัวเลือก') }}</legend>
          <div class="choice-row"><button v-for="choice in product.variants" :key="choice.sku" :class="{selected:variant?.sku===choice.sku}" :aria-pressed="variant?.sku===choice.sku" @click="selectedSku=choice.sku">{{ local(choice.name) }}<small>{{ money(choice.price) }}</small></button></div>
        </fieldset>
        <AtelierCatalogOptions v-if="product.options?.length" v-model="chosenOptions" :options="product.options" />
        <label class="field-label" for="personal-message">{{ t('Добавить ваши слова','Add your words','เพิ่มข้อความของคุณ') }}<span>{{ t('необязательно','optional','ไม่บังคับ') }}</span>
        </label>
        <input id="personal-message" v-model="message" class="form-input" maxlength="40" :placeholder="t('Например: С днём рождения, Анна','For example: Happy birthday, Anna','เช่น สุขสันต์วันเกิด แอนนา')" />
        <div class="input-meta">{{ message.length }}/40</div>
        <button class="btn btn-dark full-width" @click="addProduct">{{ t('Добавить в корзину','Add to bag','เพิ่มลงตะกร้า') }}<AtelierIcon name="bag" />
        </button>
        <div class="detail-assurances">
          <span>
            <AtelierIcon name="clock" />{{ t('Пример срока изготовления','Sample lead time','ระยะเวลาผลิตตัวอย่าง') }}: {{ variant?.leadDays || 1 }} {{ t('дн.','days','วัน') }}</span>
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
