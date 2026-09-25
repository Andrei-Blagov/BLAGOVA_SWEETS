<script setup lang="ts">
import { nextTick, toRaw } from 'vue';
import type { Localized } from '~/data/atelier';

interface VariantRow { id?: string; sku: string; name: Localized; price_minor: number; lead_days: number; min_quantity: number; active: boolean; sort_order: number }
interface ImageRow { id: string; storage_path: string; alt: Localized; sort_order: number; is_primary: boolean }
interface OptionRow { id?: string; option_group: string; option_key: string; label: Localized; price_delta_minor: number; sort_order: number; active: boolean }
interface ProductRow { id?: string; slug: string; category: string; name: Localized; subtitle: Localized; description: Localized; allergens: Localized; status: 'draft'|'published'|'archived'; image_path: string|null; sort_order: number; production_profile: {kind:string;work_units:number}; product_variants: VariantRow[]; product_images: ImageRow[]; catalog_options: OptionRow[] }
interface CategoryRow { id: string; name: Localized; active:boolean; sort_order:number }
interface PriceRule { rule_key: string; amount_minor: number; description: string }
const props = defineProps<{ owner: boolean }>();
const api = () => useNuxtApp().$supabase;
const blank = (): Localized => ({ ru:'', en:'', th:'' });
const products = ref<ProductRow[]>([]);
const categories = ref<CategoryRow[]>([]);
const rules = ref<PriceRule[]>([]);
const editing = ref<ProductRow|null>(null);
const editorForm = ref<HTMLFormElement|null>(null);
const errorAlert = ref<HTMLElement|null>(null);
const query = ref('');
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const photoAlt = reactive<Localized>(blank());
const categoryDraft = reactive<CategoryRow>({id:'',name:blank(),active:true,sort_order:100});
const file = ref<File|null>(null);
const photoInput = ref<HTMLInputElement|null>(null);
const filtered = computed(() => products.value.filter(p => `${p.slug} ${p.name.ru} ${p.name.en}`.toLowerCase().includes(query.value.trim().toLowerCase())));
const photoUrl = (p: ProductRow) => {
  const primary = p.product_images.find(x => x.is_primary) || p.product_images[0];
  return primary ? api().storage.from('catalog-demo').getPublicUrl(primary.storage_path).data.publicUrl : p.image_path || '';
};
async function showEditor() {
  file.value = null; error.value = ''; notice.value = '';
  if (photoInput.value) photoInput.value.value = '';
  Object.assign(photoAlt,blank());
  await nextTick();
  editorForm.value?.scrollIntoView({ block:'start' });
  editorForm.value?.focus({ preventScroll:true });
}
async function selectProduct(p: ProductRow) {
  editing.value = structuredClone(toRaw(p));
  await showEditor();
}
async function createProduct() {
  editing.value = { slug:'', category:categories.value.find(c => c.active)?.id || 'cake', name:blank(), subtitle:blank(), description:blank(), allergens:blank(), status:'draft', image_path:null, sort_order:100, production_profile:{kind:'manual',work_units:0}, product_variants:[], product_images:[], catalog_options:[] };
  await showEditor();
}
async function load() {
  if (!props.owner) return;
  loading.value = true; error.value = '';
  const [p,c,r] = await Promise.all([
    api().from('products').select('*,product_variants(*),product_images(*),catalog_options(*)').order('sort_order'),
    api().from('catalog_categories').select('id,name,active,sort_order').order('sort_order'),
    api().from('catalog_price_rules').select('*').order('rule_key')
  ]);
  loading.value = false;
  if (p.error || c.error || r.error) { error.value = 'Каталог не загрузился. Проверьте доступ владельца и обновите страницу.'; return; }
  products.value = (p.data || []) as unknown as ProductRow[];
  categories.value = (c.data || []) as CategoryRow[];
  rules.value = (r.data || []) as PriceRule[];
  if (editing.value?.id) {
    const refreshed = products.value.find(x => x.id === editing.value?.id);
    if (refreshed) editing.value = structuredClone(toRaw(refreshed));
  }
}
function addVariant() {
  if (!editing.value) return;
  editing.value.product_variants.push({ sku:'', name:blank(), price_minor:0, lead_days:2, min_quantity:1, active:false, sort_order:editing.value.product_variants.length*10 });
}
function addOption() {
  if (!editing.value) return;
  editing.value.catalog_options.push({option_group:'',option_key:'',label:blank(),price_delta_minor:0,
    sort_order:editing.value.catalog_options.length*10,active:false});
}
function photoExtension(selectedFile: File): string {
  const allowed: Record<string,string> = { 'image/webp':'webp', 'image/png':'png', 'image/jpeg':'jpg' };
  const extension = allowed[selectedFile.type];
  if (!extension || selectedFile.size > 5*1024*1024 || selectedFile.size === 0 ||
      !(['ru','en','th'] as const).every(lang => photoAlt[lang].trim())) {
    throw new Error('Выберите WebP, PNG или JPEG до 5 МБ и заполните alt на RU/EN/TH.');
  }
  return extension;
}
async function savePhoto(p: ProductRow, selectedFile: File, extension: string, alt: Localized) {
  if (!p.id) throw new Error('Сначала сохраните черновик товара.');
  const path = `products/${p.id}/${crypto.randomUUID()}.${extension}`;
  const storage = api().storage.from('catalog-demo');
  const uploaded = await storage.upload(path,selectedFile,{contentType:selectedFile.type,upsert:false});
  if (uploaded.error) throw uploaded.error;
  const { error: metadataError } = await api().from('product_images').insert({ product_id:p.id, storage_path:path, alt,
    sort_order:p.product_images.length*10, is_primary:p.product_images.length===0 });
  if (metadataError) {
    await storage.remove([path]);
    throw metadataError;
  }
  file.value = null; if (photoInput.value) photoInput.value.value = '';
  Object.assign(photoAlt,blank());
}
async function saveProduct() {
  const p = editing.value;
  if (!props.owner || !p || saving.value) return false;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug) || !p.name.ru.trim()) { error.value = 'Укажите slug и название на русском.'; return false; }
  saving.value = true; error.value = ''; notice.value = '';
  try {
    const selectedFile = file.value;
    const extension = selectedFile ? photoExtension(selectedFile) : '';
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
      const saved = v.id ? await api().from('product_variants').update(values).eq('id',v.id) : await api().from('product_variants').insert(values).select('id').single();
      if (saved.error) throw saved.error;
      if (!v.id) v.id = saved.data?.id;
    }
    const keys = new Set<string>();
    for (const option of p.catalog_options) {
      const key = `${option.option_group}:${option.option_key}`;
      if (keys.has(key) || !/^[a-z][a-z0-9_]*$/.test(option.option_group) || !/^[a-z][a-z0-9_-]*$/.test(option.option_key) ||
          !option.label.ru.trim() || !Number.isInteger(option.price_delta_minor) || option.price_delta_minor < 0 || option.price_delta_minor > 100000000)
        throw new Error('Проверьте группу, ключ, название и цену дополнений. Ключи внутри группы не должны повторяться.');
      keys.add(key);
      const values = {product_id:p.id,option_group:option.option_group,option_key:option.option_key,label:option.label,
        price_delta_minor:option.price_delta_minor,sort_order:option.sort_order,active:option.active};
      const saved = option.id ? await api().from('catalog_options').update(values).eq('id',option.id)
        : await api().from('catalog_options').insert(values).select('id').single();
      if (saved.error) throw saved.error;
      if (!option.id) option.id = saved.data?.id;
    }
    if (selectedFile) await savePhoto(p,selectedFile,extension,{...photoAlt});
    notice.value = selectedFile ? 'Товар и фото сохранены.' : p.status === 'published' ? 'Сохранено. Изменения опубликованного товара уже видны покупателям.' : 'Черновик сохранён.';
    await load();
    return true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось сохранить товар.';
    await nextTick(); errorAlert.value?.scrollIntoView({ block:'center' });
    return false;
  }
  finally { saving.value = false; }
}
async function setStatus(status: ProductRow['status']) {
  const p = editing.value;
  if (!props.owner || !p?.id || saving.value) return;
  if (status === 'published' && (!(['ru','en','th'] as const).every(lang => p.name[lang]?.trim() && p.description[lang]?.trim()) ||
      !p.product_variants.some(v => v.active) || !(p.image_path || p.product_images.length || file.value))) {
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
async function saveCategory(category: CategoryRow) {
  if (!props.owner || saving.value || !/^[a-z][a-z0-9-]*$/.test(category.id) || !category.name.ru.trim()) { error.value = 'Укажите slug и название категории.'; return; }
  saving.value = true; error.value = '';
  const exists = categories.value.some(row => row.id === category.id);
  const values = {id:category.id,name:category.name,active:category.active,sort_order:category.sort_order};
  const {error: failure} = exists ? await api().from('catalog_categories').update(values).eq('id',category.id) : await api().from('catalog_categories').insert(values);
  saving.value = false;
  if (failure) error.value = failure.message; else { notice.value = 'Категория сохранена.'; Object.assign(categoryDraft,{id:'',name:blank(),active:true,sort_order:100}); await load(); }
}
onMounted(load);
</script>

<template>
  <section v-if="owner" class="catalog-workspace">
    <div class="studio-card"><div class="studio-card-heading"><div><h2>Каталог и цены</h2><p>Тестовые товары · изменение опубликованного товара видно сразу</p></div><button class="btn btn-dark" @click="createProduct">Новый товар +</button></div>
      <input v-model="query" class="form-input" type="search" placeholder="Название или slug" aria-label="Поиск товара" />
      <p v-if="loading">Загружаем каталог…</p><button v-for="p in filtered" :key="p.id" class="knowledge-row" @click="selectProduct(p)"><div><strong>{{ p.name.ru }}</strong><p>{{ p.slug }} · {{ p.product_variants.length }} вариантов</p></div><span class="status-chip">{{ p.status==='published' ? 'Опубликован' : p.status==='draft' ? 'Черновик' : 'Архив' }}</span></button>
    </div>
    <p v-if="error" ref="errorAlert" role="alert" class="staff-error">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <form v-if="editing" ref="editorForm" tabindex="-1" class="studio-card catalog-editor" @submit.prevent="saveProduct"><div class="studio-card-heading"><h2>{{ editing.id ? 'Редактирование' : 'Новый черновик' }}</h2><button type="button" class="icon-button" aria-label="Закрыть редактор" @click="editing=null">×</button></div>
      <div class="catalog-fields"><label>Slug<input v-model="editing.slug" class="form-input" :disabled="!!editing.id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label><label>Категория<select v-model="editing.category" class="form-input"><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name.ru }}</option></select></label><label>Порядок<input v-model.number="editing.sort_order" class="form-input" type="number" /></label><label>Нагрузка на производство<input v-model.number="editing.production_profile.work_units" class="form-input" type="number" min="0" /></label></div>
      <fieldset v-for="lang in (['ru','en','th'] as const)" :key="lang" class="catalog-language"><legend>{{ lang.toUpperCase() }}</legend><div class="catalog-fields"><label>Название<input v-model="editing.name[lang]" class="form-input" :required="lang==='ru'" /></label><label>Подзаголовок<input v-model="editing.subtitle[lang]" class="form-input" /></label><label>Описание<textarea v-model="editing.description[lang]" class="form-input" rows="2" /></label><label>Аллергены<textarea v-model="editing.allergens[lang]" class="form-input" rows="2" /></label></div></fieldset>
      <h3>Варианты и цены</h3><div v-for="(v,i) in editing.product_variants" :key="v.id||i" class="catalog-variant"><label>SKU<input v-model="v.sku" class="form-input" required /></label><label>RU<input v-model="v.name.ru" class="form-input" required /></label><label>EN<input v-model="v.name.en" class="form-input" /></label><label>TH<input v-model="v.name.th" class="form-input" /></label><label>Цена, ฿<input :value="v.price_minor/100" @input="v.price_minor=Math.round(Number(($event.target as HTMLInputElement).value)*100)" class="form-input" type="number" min="0" max="1000000" step="0.01" /></label><label>Дней<input v-model.number="v.lead_days" class="form-input" type="number" min="0" max="365" /></label><label><input v-model="v.active" type="checkbox" /> Активен</label></div><button type="button" class="btn btn-outline" @click="addVariant">Добавить вариант</button>
      <h3>Дополнения к заказу</h3><p>Один выбор в каждой группе; покупатель может оставить группу пустой. Цена добавляется к цене выбранного варианта или конструктора.</p>
      <div v-for="(option,i) in editing.catalog_options" :key="option.id||i" class="catalog-variant">
        <label>Группа (slug)<input v-model="option.option_group" class="form-input" required placeholder="decoration" /></label>
        <label>Ключ (slug)<input v-model="option.option_key" class="form-input" required placeholder="candle" /></label>
        <label>RU<input v-model="option.label.ru" class="form-input" required /></label>
        <label>EN<input v-model="option.label.en" class="form-input" /></label>
        <label>TH<input v-model="option.label.th" class="form-input" /></label>
        <label>Цена, ฿<input :value="option.price_delta_minor/100" @input="option.price_delta_minor=Math.round(Number(($event.target as HTMLInputElement).value)*100)" class="form-input" type="number" min="0" max="1000000" step="0.01" /></label>
        <label>Порядок<input v-model.number="option.sort_order" class="form-input" type="number" /></label>
        <label><input v-model="option.active" type="checkbox" /> Активно</label>
      </div><button type="button" class="btn btn-outline" @click="addOption">Добавить дополнение</button>
      <section class="catalog-photo-fields"><h3>Фотографии</h3><p class="demo-note">Выберите фото и заполните alt на трёх языках. При сохранении нового товара фото загрузится вместе с черновиком. Первое фото станет главным.</p><div v-for="img in editing.product_images" :key="img.id" class="catalog-photo"><img :src="api().storage.from('catalog-demo').getPublicUrl(img.storage_path).data.publicUrl" :alt="img.alt.ru" width="100" height="100" /><span>{{ img.alt.ru }}</span><button v-if="!img.is_primary" type="button" class="btn btn-outline" :disabled="saving" @click="makePrimary(img)">Сделать главным</button><strong v-else>Главное</strong></div><label>Фото: WebP, PNG или JPEG до 5 МБ<input ref="photoInput" type="file" accept="image/webp,image/png,image/jpeg" :disabled="saving" @change="file=($event.target as HTMLInputElement).files?.[0]||null" /></label><div class="catalog-fields"><label v-for="lang in (['ru','en','th'] as const)" :key="lang">Alt {{ lang.toUpperCase() }}<input v-model="photoAlt[lang]" class="form-input" /></label></div></section>
      <div class="button-row"><button class="btn btn-dark" :disabled="saving">{{ file ? 'Сохранить и загрузить фото' : 'Сохранить' }}</button><button v-if="editing.id && editing.status!=='published'" type="button" class="btn btn-outline" :disabled="saving" @click="setStatus('published')">Опубликовать</button><button v-if="editing.id && editing.status==='published'" type="button" class="btn btn-outline" :disabled="saving" @click="setStatus('draft')">Снять с публикации</button><button v-if="editing.id && editing.status!=='archived'" type="button" class="btn btn-outline" :disabled="saving" @click="setStatus('archived')">Архивировать</button></div>
      <div class="catalog-preview"><h3>Предпросмотр</h3><img v-if="photoUrl(editing)" :src="photoUrl(editing)" :alt="editing.name.ru" width="180" height="180" /><strong>{{ editing.name.ru || 'Название' }}</strong><p>{{ editing.subtitle.ru }}</p></div>
    </form>
    <section class="studio-card"><h3>Категории</h3><div v-for="category in categories" :key="category.id" class="catalog-rule"><strong>{{ category.id }}</strong><div class="catalog-fields"><label>RU<input v-model="category.name.ru" class="form-input" /></label><label>EN<input v-model="category.name.en" class="form-input" /></label><label>TH<input v-model="category.name.th" class="form-input" /></label><label>Порядок<input v-model.number="category.sort_order" class="form-input" type="number" /></label><label><input v-model="category.active" type="checkbox" /> Активна</label></div><button class="btn btn-outline" :disabled="saving" @click="saveCategory(category)">Сохранить</button></div><div class="catalog-rule"><h4>Новая категория</h4><div class="catalog-fields"><label>Slug<input v-model="categoryDraft.id" class="form-input" placeholder="trifle" /></label><label>RU<input v-model="categoryDraft.name.ru" class="form-input" /></label><label>EN<input v-model="categoryDraft.name.en" class="form-input" /></label><label>TH<input v-model="categoryDraft.name.th" class="form-input" /></label><label>Порядок<input v-model.number="categoryDraft.sort_order" class="form-input" type="number" /></label></div><button class="btn btn-outline" :disabled="saving" @click="saveCategory(categoryDraft)">Добавить категорию</button></div></section>
    <section class="studio-card"><h3>Цены конструктора</h3><p>Изменения применяются сервером сразу. Цены в ฿.</p><div v-for="rule in rules" :key="rule.rule_key" class="catalog-rule"><label>{{ rule.description }}<small>{{ rule.rule_key }}</small><input :value="rule.amount_minor/100" @input="rule.amount_minor=Math.round(Number(($event.target as HTMLInputElement).value)*100)" class="form-input" type="number" min="0" max="10000" step="0.01" /></label><button class="btn btn-outline" :disabled="saving" @click="saveRule(rule)">Сохранить</button></div></section>
  </section>
</template>
