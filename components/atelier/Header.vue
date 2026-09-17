<script setup lang="ts">
const {
  locale,
  t,
  count
} = useAtelier();
const open = ref(false);
const route = useRoute();
watch(() => route.fullPath, () => {
  open.value = false;
});
const links = computed(() => [{
  to: '/menu',
  name: t('Десерты', 'Our treats', 'ขนมของเรา')
}, {
  to: '/celebration',
  name: t('К празднику', 'Celebrate', 'งานฉลอง')
}, {
  to: '/gift-box',
  name: t('Собрать подарок', 'Build a gift', 'จัดกล่องของขวัญ')
}, {
  to: '/cafe',
  name: t('Кофейня', 'The café', 'คาเฟ่')
}, {
  to: '/cooperation',
  name: t('Партнёрам', 'For business', 'สำหรับธุรกิจ')
}]);
</script>
<template>
  <div class="demo-bar">
    <span>{{ t('ПАТТАЙЯ · КОНЦЕПЦИЯ БУДУЩЕЙ КОНДИТЕРСКОЙ', 'PATTAYA · A PATISSERIE IN THE MAKING', 'พัทยา · แนวคิดร้านขนมในอนาคต') }}</span>
    <span class="demo-bar-note">{{ t('Демо: цены и фото — примеры. Заказы не принимаются.', 'Demo: sample prices and imagery. Orders are not accepted.', 'เดโม: ราคาและภาพตัวอย่าง ยังไม่เปิดรับออเดอร์') }}</span>
  </div>
  <header class="site-header" @keydown.esc="open = false">
    <div class="shell header-inner">
      <NuxtLink to="/" class="wordmark" aria-label="BLAGOVA SWEETS — Home">BLAGOVA<span>SWEETS & LITTLE JOYS</span>
      </NuxtLink>
      <nav class="desktop-nav" :aria-label="t('Основная навигация','Main navigation','เมนูหลัก')">
        <NuxtLink v-for="link in links" :key="link.to" :to="link.to">{{ link.name }}</NuxtLink>
      </nav>
      <div class="header-actions">
        <label class="sr-only" for="site-language">{{ t('Язык', 'Language', 'ภาษา') }}</label>
        <select id="site-language" v-model="locale" class="language-select">
          <option value="ru">RU</option>
          <option value="en">EN</option>
          <option value="th">TH</option>
        </select>
        <NuxtLink to="/cart" class="bag-link" :aria-label="t('Корзина','Shopping bag','ตะกร้า')">
          <AtelierIcon name="bag" />
          <span class="bag-count">{{ count }}</span>
        </NuxtLink>
        <button class="icon-button mobile-menu-button" :aria-expanded="open" aria-controls="mobile-menu" :aria-label="t('Меню','Menu','เมนู')" @click="open = !open">
          <AtelierIcon :name="open ? 'close' : 'menu'" />
        </button>
      </div>
    </div>
    <nav v-if="open" id="mobile-menu" class="mobile-nav">
      <NuxtLink v-for="link in links" :key="link.to" :to="link.to">{{ link.name }}<AtelierIcon name="arrow" />
      </NuxtLink>
    </nav>
  </header>
</template>
