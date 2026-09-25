<script setup lang="ts">
const {
  t,
  money
} = useAtelier();
const active = ref('coffee');
const items = computed(() => active.value === 'coffee' ? [{
  name: 'Espresso',
  detail: t('Насыщенный и короткий', 'Short and full-bodied', 'เข้มข้น กลมกล่อม'),
  price: 75
}, {
  name: 'Cappuccino',
  detail: t('Эспрессо и бархатное молоко', 'Espresso & silky milk', 'เอสเปรสโซและนมเนียนนุ่ม'),
  price: 95
}, {
  name: 'Iced latte',
  detail: t('Небольшая прохлада в тёплый день', 'A little cool on a warm day', 'ความเย็นในวันที่อากาศอบอุ่น'),
  price: 110
}] : [{
  name: t('Кусочек счастья', 'A slice of happiness', 'เค้กแห่งความสุข'),
  detail: t('Ягодный торт, порция', 'A slice of berry cake', 'เค้กเบอร์รีหนึ่งชิ้น'),
  price: 190
}, {
  name: t('Капкейк дня', 'Cupcake of the day', 'คัพเค้กประจำวัน'),
  detail: t('Ваниль и малина', 'Vanilla & raspberry', 'วานิลลาและราสป์เบอร์รี'),
  price: 105
}, {
  name: t('Шоколадная пауза', 'Chocolate pause', 'พักกับช็อกโกแลต'),
  detail: t('Две конфеты ручной работы', 'Two handmade bonbons', 'บงบงทำมือสองชิ้น'),
  price: 160
}]);
</script>
<template>
  <section class="shell section">
    <div class="page-intro">
      <span class="eyebrow">OUR NEXT LITTLE CHAPTER</span>
      <h1>{{ t('Место, где','A place to','พื้นที่ที่คุณ') }} <em>{{ t('можно замедлиться.','slow down.','พักได้อย่างสบายใจ') }}</em>
      </h1>
      <p>{{ t('Будущая кофейня BLAGOVA SWEETS в Паттайе. Несколько столиков, аромат кофе и десерты из собственной кондитерской.','The future BLAGOVA SWEETS café in Pattaya. A few tables, the scent of coffee and sweets from our own kitchen.','คาเฟ่ BLAGOVA SWEETS ในอนาคตที่พัทยา โต๊ะเล็ก ๆ ไม่กี่ตัว กาแฟหอม และขนมจากครัวของเรา') }}</p>
    </div>
    <div class="cafe-wide">
      <img src="/prototype/cafe.webp" :alt="t('AI-визуализация будущей кофейни','AI concept of the future café','ภาพแนวคิดคาเฟ่จาก AI')" width="1536" height="1024" />
      <span class="photo-label">{{ t('ВИЗУАЛЬНАЯ КОНЦЕПЦИЯ · НЕ ФОТО РЕАЛЬНОГО ПОМЕЩЕНИЯ','VISUAL CONCEPT · NOT AN EXISTING LOCATION','ภาพแนวคิด · ไม่ใช่สถานที่จริง') }}</span>
    </div>
    <div class="cafe-menu-grid">
      <div>
        <span class="eyebrow">A TASTE OF WHAT’S COMING</span>
        <h2>{{ t('Кофе и','Coffee &','กาแฟและ') }} <em>{{ t('кое-что сладкое.','something sweet.','ขนมหวาน') }}</em>
        </h2>
        <p>{{ t('Здесь можно будет попробовать начинки перед заказом торта, забрать подарок и остаться на чашку кофе.','Taste cake fillings before your celebration, pick up a gift, and stay for a cup of coffee.','ลองชิมไส้เค้กก่อนสั่ง รับของขวัญ และอยู่ดื่มกาแฟต่อ') }}</p>
        <div class="opening-note">
          <AtelierIcon name="pin" />
          <div>
            <strong>Pattaya, Thailand</strong>
            <p>{{ t('Адрес и дата открытия пока не определены.','The address and opening date are still to be confirmed.','ที่ตั้งและวันเปิดยังไม่ได้กำหนด') }}</p>
          </div>
        </div>
      </div>
      <div>
        <div class="filter-tabs">
          <button :class="{selected:active==='coffee'}" :aria-pressed="active==='coffee'" @click="active='coffee'">{{ t('Кофе','Coffee','กาแฟ') }}</button>
          <button :class="{selected:active==='dessert'}" :aria-pressed="active==='dessert'" @click="active='dessert'">{{ t('Десерты','Desserts','ขนม') }}</button>
        </div>
        <div v-for="item in items" :key="item.name" class="cafe-menu-row">
          <div>
            <h3>{{ item.name }}</h3>
            <p>{{ item.detail }}</p>
          </div>
          <strong>{{ money(item.price) }}</strong>
        </div>
        <p class="demo-note">{{ t('Пример будущего меню. Цены тестовые.','A sample of the future menu. Prices are illustrative.','ตัวอย่างเมนูในอนาคต ราคาเพื่อการสาธิต') }}</p>
      </div>
    </div>
  </section>
</template>
