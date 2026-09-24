<script setup lang="ts">
import type { Localized } from '~/data/atelier';

interface VariantRow { id?: string; sku: string; name: Localized; price_minor: number; lead_days: number; min_quantity: number; active: boolean; sort_order: number }
interface ImageRow { id: string; storage_path: string; alt: Localized; sort_order: number; is_primary: boolean }
interface ProductRow { id?: string; slug: string; category: string; name: Localized; subtitle: Localized; description: Localized; allergens: Localized; status: 'draft'|'published'|'archived'; image_path: string|null; sort_order: number; production_profile: {kind:string;work_units:number}; product_variants: VariantRow[]; product_images: ImageRow[] }
interface CategoryRow { id: string; name: Localized }
interface PriceRule { rule_key: string; amount_minor: number; description: string }
const props = defineProps<{ owner: boolean }>();
const api = () => useNuxtApp().$supabase;
const blank = (): Localized => ({ ru:'', en:'', th:'' });
const products = ref<ProductRow[]>([]);
const categories = ref<CategoryRow[]>([]);
const rules = ref<PriceRule[]>([]);
const editing = ref<ProductRow|null>(null);
const query = ref('');
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const photoAlt = reactive<Localized>(blank());
const file = ref<File|null>(null);
const filtered = computed(() => products.value.filter(p => `${p.slug} ${p.name.ru} ${p.name.en}`.toLowerCase().includes(query.value.trim().toLowerCase())));
const photoUrl = (p: ProductRow) => {
  const primary = p.product_images.find(x => x.is_primary) || p.product_images[0];
  return primary ? api().storage.from('catalog-demo').getPublicUrl(primary.storage_path).data.publicUrl : p.image_path || '';
};
function selectProduct(p: ProductRow) { editing.value = structuredClone(p); file.value = null; error.value = ''; notice.value = ''; }
function createProduct() {
  editing.value = { slug:'', category:'cake', name:blank(), subtitle:blank(), description:blank(), allergens:blank(), status:'draft', image_path:null, sort_order:100, production_profile:{kind:'manual',work_units:0}, product_variants:[], product_images:[] };
  file.value = null; error.value = ''; notice.value = '';
}
async function load() {
  if (!props.owner) return;
  loading.value = true; error.value = '';
  const [p,c,r] = await Promise.all([
    api().from('products').select('*,product_variants(*),product_images(*)').order('sort_order'),
    api().from('catalog_categories').select('id,name').order('sort_order'),
    api().from('catalog_price_rules').select('*').order('rule_key')
  ]);
  loading.value = false;
  if (p.error || c.error || r.error) { error.value = 'Каталог не загрузился. Проверьте доступ владельца и обновите страницу.'; return; }
  products.value = (p.data || []) as unknown as ProductRow[];
  categories.value = (c.data || []) as CategoryRow[];
  rules.value = (r.data || []) as PriceRule[];
  if (editing.value?.id) {
    const refreshed = products.value.find(x => x.id === editing.value?.id);
    if (refreshed) editing.value = structuredClone(refreshed);
  }
}
function addVariant() {
  if (!editing.value) return;
  editing.value.product_variants.push({ sku:'', name:blank(), price_minor:0, lead_days:2, min_quantity:1, active:false, sort_order:editing.value.product_variants.length*10 });
}
async function saveProduct() {
  const p = editing.value;
  if (!props.owner || !p || saving.value) return false;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug) || !p.name.ru.trim()) { error.value = 'Укажите slug и название на русском.'; return false; }
  saving.value = true; error.value = ''; notice.value = '';
  try {
    const fields = { slug:p.slug, category:p.category, name:p.name, subtitle:p.subtitle, description:p.description,
      allergens:p.allergens, sort_order:p.sort_order, production_profile:p.production_profile };
    const result = p.id
      ? await api().from('products').update(fields).eq('id',p.id).select('id').single()
      : await api().from('products').insert({ ...fields, status:'draft', is_demo:true }).select('id').single();
    if (result.error || !result.data) throw result.error || new Error('product');
    p.id = result.data.id;
    for (const v of p.product_variants) {
      if (!/^[a-z0-9][a-z0-9_-]*$/.test(v.sku) || !v.name.ru.trim() || !Number.isInteger(v.price_minor) || v.price_minor < 0 || v.price_minor > 100000000) throw new Error('Проверьте SKU, название и цену каждого варианта.');
      const values = { product_id:p.id, sku:v.sku, name:v.name, price_minor:v.price_minor, lead_days:v.lead_days,
        min_quantity:v.min_quantity, active:v.active, sort_order:v.sort_order };
      const saved = v.id ? await api().from('product_variants').update(values).eq('id',v.id) : await api().from('product_variants').insert(values);
      if (saved.error) throw saved.error;
    }
    notice.value = p.status === 'published' ? 'Сохранено. Изменения опубликованного товара уже видны покупателям.' : 'Черновик сохранён.';
    await load();
    return true;
  } catch (e) { error.value = e instanceof Error ? e.message : 'Не удалось сохранить товар.'; return false; }
  finally { saving.value = false; }
}
async function setStatus(status: ProductRow['status']) {
  const p = editing.value;
  if (!props.owner || !p?.id || saving.value) return;
  if (status === 'published' && (!(['ru','en','th'] as const).every(lang => p.name[lang]?.trim() && p.description[lang]?.trim()) ||
      !p.product_variants.some(v => v.active) || !(p.image_path || p.product_images.length))) {
    error.value = 'Для публикации нужны названия и описания RU/EN/TH, активный вариант и фотография.'; return;
  }
  if (status === 'published' && !await saveProduct()) return;
  saving.value = true; error.value = '';
  const { error: failure } = await api().from('products').update({ status, ...(status === 'published' ? { published_at:new Date().toISOString() } : {}) }).eq('id',p.id);
  saving.value = false;
  if (failure) { error.value = failure.message; return; }
  notice.value = status === 'published' ? 'Товар опубликован.' : status === 'archived' ? 'Товар архивирован и недоступен для новых заказов.' : 'Товар переведён в черновики.';
  await load();
}
async function uploadPhoto() {
  const p = editing.value;
  if (!props.owner || !p?.id || !file.value || saving.value) return;
  const allowed: Record<string,string> = { 'image/webp':'webp', 'image/png':'png', 'image/jpeg':'jpg' };
  if (!allowed[file.value.type] || file.value.size > 5*1024*1024 || file.value.size === 0 || !(['ru','en','th'] as const).every(lang => photoAlt[lang].trim())) {
    error.value = 'Выберите WebP, PNG или JPEG до 5 МБ и заполните alt на RU/EN/TH.'; return;
  }
  saving.value = true; error.value = '';
  const path = `products/${p.id}/${crypto.randomUUID()}.${allowed[file.value.type]}`;
  const uploaded = await api().storage.from('catalog-demo').upload(path,file.value,{contentType:file.value.type,upsert:false});
  if (uploaded.error) { error.value = uploaded.error.message; saving.value = false; return; }
  const { error: metadataError } = await api().from('product_images').insert({ product_id:p.id, storage_path:path, alt:{...photoAlt},
    sort_order:p.product_images.length*10, is_primary:p.product_images.length===0 });
  saving.value = false;
  if (metadataError) { error.value = `Файл загружен, но метаданные не сохранены: ${metadataError.message}. Путь: ${path}`; return; }
  file.value = null; Object.assign(photoAlt,blank()); notice.value = 'Фото загружено.';
  await load();
}
async function makePrimary(image: ImageRow) {
  const p = editing.value;
  if (!props.owner || !p?.id || saving.value || image.is_primary) return;
  saving.value = true; error.value = '';
  const {error: failure} = await api().rpc('set_primary_product_image',{p_product_id:p.id,p_image_id:image.id});
  saving.value = false;
  if (failure) error.value = failure.message; else notice.value = 'Главное фото обновлено.';
  await load();
}
async function saveRule(rule: PriceRule) {
  if (!props.owner || saving.value || !Number.isInteger(rule.amount_minor) || rule.amount_minor < 0 || rule.amount_minor > 1000000) { error.value = 'Неверная цена.'; return; }
  saving.value = true; error.value = '';
  const {error: failure} = await api().from('catalog_price_rules').update({amount_minor:rule.amount_minor,updated_at:new Date().toISOString()}).eq('rule_key',rule.rule_key);
  saving.value = false;
  if (failure) error.value = failure.message; else notice.value = 'Правило цены сохранено и применяется сервером к новым заказам.';
}
onMounted(load);
</script>

<template>
  <section v-if="owner" class="catalog-workspace">
    <div class="studio-card"><div class="studio-card-heading"><div><h2>Каталог и цены</h2><p>Тестовые товары · изменение опубликованного товара видно сразу</p></div><button class="btn btn-dark" @click="createProduct">Новый товар +</button></div>
      <input v-model="query" class="form-input" type="search" placeholder="Название или slug" aria-label="Поиск товара" />
      <p v-if="loading">Загружаем каталог…</p><button v-for="p in filtered" :key="p.id" class="knowledge-row" @click="selectProduct(p)"><div><strong>{{ p.name.ru }}</strong><p>{{ p.slug }} · {{ p.product_variants.length }} вариантов</p></div><span class="status-chip">{{ p.status==='published' ? 'Опубликован' : p.status==='draft' ? 'Черновик' : 'Архив' }}</span></button>
    </div>
    <p v-if="error" role="alert" class="staff-error">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <form v-if="editing" class="studio-card catalog-editor" @submit.prevent="saveProduct"><div class="studio-card-heading"><h2>{{ editing.id ? 'Редактирование' : 'Новый черновик' }}</h2><button type="button" class="icon-button" aria-label="Закрыть редактор" @click="editing=null">×</button></div>
      <div class="catalog-fields"><label>Slug<input v-model="editing.slug" class="form-input" :disabled="!!editing.id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label><label>Категория<select v-model="editing.category" class="form-input"><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name.ru }}</option></select></label><label>Порядок<input v-model.number="editing.sort_order" class="form-input" type="number" /></label><label>Нагрузка на производство<input v-model.number="editing.production_profile.work_units" class="form-input" type="number" min="0" /></label></div>
      <fieldset v-for="lang in (['ru','en','th'] as const)" :key="lang" class="catalog-language"><legend>{{ lang.toUpperCase() }}</legend><div class="catalog-fields"><label>Название<input v-model="editing.name[lang]" class="form-input" :required="lang==='ru'" /></label><label>Подзаголовок<input v-model="editing.subtitle[lang]" class="form-input" /></label><label>Описание<textarea v-model="editing.description[lang]" class="form-input" rows="2" /></label><label>Аллергены<textarea v-model="editing.allergens[lang]" class="form-input" rows="2" /></label></div></fieldset>
      <h3>Варианты и цены</h3><div v-for="(v,i) in editing.product_variants" :key="v.id||i" class="catalog-variant"><label>SKU<input v-model="v.sku" class="form-input" required /></label><label>RU<input v-model="v.name.ru" class="form-input" required /></label><label>EN<input v-model="v.name.en" class="form-input" /></label><label>TH<input v-model="v.name.th" class="form-input" /></label><label>Цена, ฿<input :value="v.price_minor/100" @input="v.price_minor=Math.round(Number(($event.target as HTMLInputElement).value)*100)" class="form-input" type="number" min="0" max="1000000" step="0.01" /></label><label>Дней<input v-model.number="v.lead_days" class="form-input" type="number" min="0" max="365" /></label><label><input v-model="v.active" type="checkbox" /> Активен</label></div><button type="button" class="btn btn-outline" @click="addVariant">Добавить вариант</button>
      <div class="button-row"><button class="btn btn-dark" :disabled="saving">Сохранить</button><button v-if="editing.id && editing.status!=='published'" type="button" class="btn btn-outline" :disabled="saving" @click="setStatus('published')">Опубликовать</button><button v-if="editing.id && editing.status==='published'" type="button" class="btn btn-outline" :disabled="saving" @click="setStatus('draft')">Снять с публикации</button><button v-if="editing.id && editing.status!=='archived'" type="button" class="btn btn-outline" :disabled="saving" @click="setStatus('archived')">Архивировать</button></div>
      <div class="catalog-preview"><h3>Предпросмотр</h3><img v-if="photoUrl(editing)" :src="photoUrl(editing)" :alt="editing.name.ru" width="180" height="180" /><strong>{{ editing.name.ru || 'Название' }}</strong><p>{{ editing.subtitle.ru }}</p></div>
    </form>
    <section v-if="editing?.id" class="studio-card"><h3>Фотографии</h3><div v-for="img in editing.product_images" :key="img.id" class="catalog-photo"><img :src="api().storage.from('catalog-demo').getPublicUrl(img.storage_path).data.publicUrl" :alt="img.alt.ru" width="100" height="100" /><span>{{ img.alt.ru }}</span><button v-if="!img.is_primary" class="btn btn-outline" :disabled="saving" @click="makePrimary(img)">Сделать главным</button><strong v-else>Главное</strong></div><label>WebP, PNG или JPEG до 5 МБ<input type="file" accept="image/webp,image/png,image/jpeg" @change="file=($event.target as HTMLInputElement).files?.[0]||null" /></label><div class="catalog-fields"><label v-for="lang in (['ru','en','th'] as const)" :key="lang">Alt {{ lang.toUpperCase() }}<input v-model="photoAlt[lang]" class="form-input" /></label></div><button class="btn btn-dark" :disabled="saving||!file" @click="uploadPhoto">Загрузить фото</button></section>
    <section class="studio-card"><h3>Цены конструктора</h3><p>Изменения применяются сервером сразу. Цены в ฿.</p><div v-for="rule in rules" :key="rule.rule_key" class="catalog-rule"><label>{{ rule.description }}<small>{{ rule.rule_key }}</small><input :value="rule.amount_minor/100" @input="rule.amount_minor=Math.round(Number(($event.target as HTMLInputElement).value)*100)" class="form-input" type="number" min="0" max="10000" step="0.01" /></label><button class="btn btn-outline" :disabled="saving" @click="saveRule(rule)">Сохранить</button></div></section>
  </section>
</template>
