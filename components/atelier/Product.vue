<script setup lang="ts">
import type { AtelierProduct } from '~/data/atelier';
defineProps<{
  product: AtelierProduct;
  index?: number;
}>();
const {
  t,
  local,
  money
} = useAtelier();
</script>
<template>
  <article class="treat-card">
    <NuxtLink :to="'/products/' + product.id" class="treat-image">
      <img :src="product.image" :alt="local(product.imageAlt)" loading="lazy" width="640" height="640" />
      <span class="product-tag">{{ product.leadDays ? t('К вашей дате','Made to order','สั่งทำล่วงหน้า') : t('Коллекция подарков','Gift collection','คอลเลกชันของขวัญ') }}</span>
      <span class="image-arrow">
        <AtelierIcon name="diagonal" />
      </span>
    </NuxtLink>
    <div class="treat-meta">
      <span>{{ local(product.unit) }}</span>
      <span>{{ money(product.price) }}</span>
    </div>
    <NuxtLink :to="'/products/' + product.id" class="treat-name">{{ local(product.name) }}</NuxtLink>
    <p>{{ local(product.subtitle) }}</p>
  </article>
</template>
