<script setup lang="ts">
const {
  t
} = useAtelier();
</script>
<template>
  <footer class="site-footer">
    <div class="shell footer-grid">
      <div>
        <NuxtLink to="/" class="wordmark footer-logo">BLAGOVA<span>SWEETS & LITTLE JOYS</span>
        </NuxtLink>
        <p>{{ t('Для больших событий.\nИ маленьких радостей.','For the big occasions.\nAnd the little joys.','สำหรับโอกาสสำคัญ\nและความสุขเล็ก ๆ') }}</p>
      </div>
      <div>
        <span class="eyebrow">{{ t('ЗАГЛЯНИТЕ К НАМ','EXPLORE','ค้นพบ') }}</span>
        <NuxtLink to="/menu">{{ t('Коллекция десертов','Our collection','คอลเลกชันขนม') }}</NuxtLink>
        <NuxtLink to="/gift-box">{{ t('Подарок с вашим характером','A gift, your way','ของขวัญในแบบคุณ') }}</NuxtLink>
        <NuxtLink to="/cooperation">{{ t('Сотрудничество','Partnerships','พันธมิตร') }}</NuxtLink>
      </div>
      <div>
        <span class="eyebrow">PATTAYA, THAILAND</span>
        <p>{{ t('Планируем открытие.\nАдрес и дата будут объявлены позже.','A new chapter is coming.\nLocation and opening date to be announced.','เตรียมพบกับเรา\nจะแจ้งที่ตั้งและวันเปิดให้ทราบภายหลัง') }}</p>
        <NuxtLink to="/cafe" class="text-link">{{ t('Познакомиться с концепцией','Meet the concept','รู้จักแนวคิดของเรา') }}<AtelierIcon name="diagonal" :size="16" />
        </NuxtLink>
      </div>
    </div>
    <div class="shell footer-bottom">
      <span>© {{ new Date().getFullYear() }} BLAGOVA SWEETS</span>
      <span>{{ t('Прототип · тестовые цены · концептуальные AI-фото','Prototype · sample prices · conceptual AI imagery','ต้นแบบ · ราคาตัวอย่าง · ภาพแนวคิดจาก AI') }}</span>
    </div>
  </footer>
</template>
