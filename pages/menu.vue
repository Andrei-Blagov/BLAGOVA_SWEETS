<script setup lang="ts">
const { products, categories, loading, error: catalogError, load: loadCatalog } = useCatalog();
onMounted(() => loadCatalog());
const {
  t,
  local
} = useAtelier();
const route = useRoute();
const category = ref(typeof route.query.category === 'string' ? route.query.category : 'all');
const search = ref('');
const sort = ref('collection');
const filtered = computed(() => {
  let rows = products.value.filter(p => (category.value === 'all' || p.category === category.value) && (local(p.name) + ' ' + local(p.subtitle)).toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
  if (sort.value !== 'collection') rows = [...rows].sort((a, b) => sort.value === 'low' ? a.price - b.price : b.price - a.price);
  return rows;
});
useSeoMeta({
  title: 'Our collection — BLAGOVA SWEETS'
});
</script>
<template>
  <section class="shell section catalog-section">
    <div class="page-intro">
      <span class="eyebrow">THE SWEET COLLECTION</span>
      <h1>{{ t('Найдите свою','Find your','ค้นหาความสุข') }} <em>{{ t('маленькую радость.','little joy.','เล็ก ๆ ของคุณ') }}</em>
      </h1>
      <p>{{ t('Торты, капкейки, имбирные пряники и шоколад ручной работы. Выберите повод — или придумайте его прямо сейчас.','Cakes, cupcakes, gingerbread and handmade chocolate. Find your occasion — or make one right now.','เค้ก คัพเค้ก ขนมปังขิง และช็อกโกแลตทำมือ เลือกขนมสำหรับโอกาสของคุณ') }}</p>
    </div>
    <div class="catalog-tools">
      <div class="filter-tabs" :aria-label="t('Категории','Categories','หมวดหมู่')">
        <button v-for="c in categories" :key="c.id" :class="{selected:category===c.id}" :aria-pressed="category===c.id" @click="category=c.id">{{ local(c.name) }}</button>
      </div>
      <div class="catalog-search">
        <AtelierIcon name="search" />
        <input v-model="search" type="search" :aria-label="t('Поиск десертов','Search treats','ค้นหาขนม')" :placeholder="t('Найти что-то вкусное','Find something sweet','ค้นหาขนมอร่อย')" />
      </div>
    </div>
    <div class="catalog-summary">
      <span>{{ t('В коллекции','In this collection','ในคอลเลกชันนี้') }}: {{ filtered.length }}</span>
      <label>{{ t('Порядок','Sort','เรียงลำดับ') }} <select v-model="sort">
          <option value="collection">{{ t('Выбор кондитера','Our selection','เชฟแนะนำ') }}</option>
          <option value="low">{{ t('Сначала дешевле','Price: low to high','ราคาต่ำไปสูง') }}</option>
          <option value="high">{{ t('Сначала дороже','Price: high to low','ราคาสูงไปต่ำ') }}</option>
        </select>
      </label>
    </div>
    <p v-if="catalogError" role="alert">{{ catalogError }} <button class="btn btn-outline" @click="loadCatalog(true)">Повторить</button></p>
    <p v-else-if="loading">{{ t('Загружаем каталог…','Loading collection…','กำลังโหลดสินค้า…') }}</p>
    <div v-if="filtered.length" class="product-grid">
      <AtelierProduct v-for="product in filtered" :key="product.id" :product="product" />
    </div>
    <div v-else-if="!loading && !catalogError" class="empty-state">
      <AtelierIcon name="search" :size="36" />
      <h2>{{ t('Пока не нашли','No treats found','ไม่พบขนม') }}</h2>
      <p>{{ t('Попробуйте другой запрос или откройте всю коллекцию.','Try a different search or explore the whole collection.','ลองค้นหาใหม่หรือดูคอลเลกชันทั้งหมด') }}</p>
      <button class="btn btn-outline" @click="search=''; category='all'">{{ t('Сбросить фильтры','Reset filters','ล้างตัวกรอง') }}</button>
    </div>
    <p class="demo-note">{{ t('Это тестовая коллекция. Цены, состав и сроки приведены для демонстрации.','This is a sample collection. Prices, ingredients and lead times are for demonstration.','คอลเลกชันตัวอย่าง ราคา ส่วนผสม และระยะเวลาเป็นข้อมูลสาธิต') }}</p>
  </section>
</template>
