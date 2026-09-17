<script setup lang="ts">
const {
  t,
  local,
  money,
  basket,
  total,
  quantity,
  hydrated
} = useAtelier();
</script>
<template>
  <section class="shell section cart-section">
    <div class="page-intro">
      <span class="eyebrow">YOUR LITTLE JOYS</span>
      <h1>{{ t('Ваша','Your','ตะกร้า') }} <em>{{ t('корзина.','sweet bag.','ของคุณ') }}</em>
      </h1>
    </div>
    <div v-if="!hydrated" class="empty-state" aria-busy="true">{{ t('Загружаем корзину…','Loading your bag…','กำลังโหลดตะกร้า…') }}</div>
    <div v-else-if="!basket.length" class="empty-state">
      <AtelierIcon name="bag" :size="42" />
      <h2>{{ t('Здесь пока тихо.','A little empty, for now.','ยังไม่มีขนมในตะกร้า') }}</h2>
      <p>{{ t('Ваша следующая маленькая радость ждёт в коллекции.','Your next little joy is waiting in our collection.','ความสุขเล็ก ๆ รอคุณอยู่ในคอลเลกชัน') }}</p>
      <NuxtLink to="/menu" class="btn btn-dark">{{ t('Выбрать десерты','Explore the collection','เลือกขนม') }}<AtelierIcon name="arrow" />
      </NuxtLink>
    </div>
    <div v-else class="checkout-grid">
      <div>
        <article v-for="item in basket" :key="item.key" class="basket-row">
          <img :src="item.image" :alt="local(item.name)" width="160" height="160" />
          <div class="basket-row-copy">
            <h3>{{ local(item.name) }}</h3>
            <p>{{ item.detail }}</p>
            <div class="quantity-control">
              <button :aria-label="t('Уменьшить количество','Decrease quantity','ลดจำนวน')+' '+local(item.name)" @click="quantity(item.key,item.quantity-1)">−</button>
              <span>{{ item.quantity }}</span>
              <button :disabled="item.quantity>=20" :aria-label="t('Увеличить количество','Increase quantity','เพิ่มจำนวน')+' '+local(item.name)" @click="quantity(item.key,item.quantity+1)">+</button>
            </div>
          </div>
          <div class="basket-row-price">
            <strong>{{ money(item.price*item.quantity) }}</strong>
            <button :aria-label="t('Удалить','Remove','ลบ')+' '+local(item.name)" @click="quantity(item.key,0)">
              <AtelierIcon name="close" :size="17" />
            </button>
          </div>
        </article>
        <NuxtLink to="/menu" class="text-link continue-link">← {{ t('Продолжить выбирать','Keep exploring','เลือกขนมต่อ') }}</NuxtLink>
      </div>
      <aside class="order-summary">
        <span class="eyebrow">A LITTLE SOMETHING LOVELY</span>
        <h3>{{ t('Ваш заказ','Your order','คำสั่งซื้อของคุณ') }}</h3>
        <div class="summary-line">
          <span>{{ t('Десерты и подарки','Treats & gifts','ขนมและของขวัญ') }}</span>
          <strong>{{ money(total) }}</strong>
        </div>
        <div class="summary-line">
          <span>{{ t('Доставка','Delivery','การจัดส่ง') }}</span>
          <span>{{ t('На следующем шаге','At the next step','ในขั้นตอนถัดไป') }}</span>
        </div>
        <div class="summary-total">
          <span>{{ t('Подытог','Subtotal','ยอดรวมสินค้า') }}</span>
          <strong>{{ money(total) }}</strong>
        </div>
        <NuxtLink to="/checkout" class="btn btn-dark full-width">{{ t('Попробовать оформление','Try demo checkout','ทดลองสั่งซื้อ') }}<AtelierIcon name="arrow" />
        </NuxtLink>
        <p class="demo-note">{{ t('Это прототип. Заказ не будет отправлен, оплата не требуется.','This is a prototype. No order is sent and no payment is required.','นี่คือต้นแบบ ไม่มีการส่งออเดอร์หรือชำระเงิน') }}</p>
      </aside>
    </div>
  </section>
</template>
