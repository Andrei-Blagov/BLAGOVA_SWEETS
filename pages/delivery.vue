<script setup lang="ts">
const {
  t
} = useAtelier();
</script>
<template>
  <section class="shell section page-intro">
    <span class="eyebrow">PATTAYA, THAILAND</span>
    <h1>{{ t('Доставка и','Delivery &','การจัดส่งและ') }} <em>{{ t('самовывоз.','pickup.','รับที่ร้าน') }}</em>
    </h1>
    <p>{{ t('Производство ещё не открыто. Зоны, тарифы и интервалы в прототипе приведены для проверки интерфейса. Реальные условия будут опубликованы перед запуском.','Production is not open yet. Areas, fees and time slots in this prototype are for interface testing. Actual terms will be published before launch.','ร้านยังไม่เปิดดำเนินการ พื้นที่ ค่าจัดส่ง และช่วงเวลาในต้นแบบใช้ทดสอบเท่านั้น จะแจ้งเงื่อนไขจริงก่อนเปิดร้าน') }}</p>
    <NuxtLink to="/menu" class="btn btn-dark">{{ t('Посмотреть коллекцию','Explore the collection','ดูคอลเลกชัน') }}<AtelierIcon name="arrow" />
    </NuxtLink>
  </section>
</template>
