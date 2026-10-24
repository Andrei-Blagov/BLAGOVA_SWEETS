<script setup lang="ts">
import { nextTick, toRaw } from 'vue';
import type { Localized } from '~/data/atelier';

interface VariantRow { id?: string; sku: string; name: Localized; price_minor: number; lead_days: number; min_quantity: number; active: boolean; sort_order: number; production_variant_profiles?: {components:Record<string,number>;version?:number}|null }
interface ImageRow { id: string; storage_path: string; alt: Localized; sort_order: number; is_primary: boolean }
interface OptionRow { id?: string; option_group: string; option_key: string; label: Localized; price_delta_minor: number; sort_order: number; active: boolean }
interface ProductRow { id: string; catalog_version:number; slug: string; category: string; name: Localized; subtitle: Localized; description: Localized; allergens: Localized; status: 'draft'|'published'|'archived'; image_path: string|null; sort_order: number; production_profile: {kind:string;work_units:number}; product_variants: VariantRow[]; product_images: ImageRow[]; catalog_options: OptionRow[] }
interface CategoryRow { id: string; catalog_version:number; name: Localized; active:boolean; sort_order:number }
interface PriceRule { rule_key: string; catalog_version:number; amount_minor: number; description: string }
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
const categoryDraft = reactive<CategoryRow>({id:'',catalog_version:0,name:blank(),active:true,sort_order:100});
const conflict = ref(false);
const candidatePath = ref('');
const file = ref<File|null>(null);
const photoInput = ref<HTMLInputElement|null>(null);
const filtered = computed(() => products.value.filter(p => `${p.slug} ${p.name.ru} ${p.name.en}`.toLowerCase().includes(query.value.trim().toLowerCase())));
const photoUrl = (p: ProductRow) => {
  const primary = p.product_images.find(x => x.is_primary) || p.product_images[0];
  return primary ? api().storage.from('catalog-demo').getPublicUrl(primary.storage_path).data.publicUrl : p.image_path || '';
};
async function showEditor() {
  file.value = null; error.value = ''; conflict.value=false;
  notice.value = candidatePath.value ? 'Предыдущий фото-кандидат оставлен в Storage. Файлы автоматически не удаляются.' : '';
  candidatePath.value='';
  if (photoInput.value) photoInput.value.value = '';
  Object.assign(photoAlt,blank());
  await nextTick();
  editorForm.value?.scrollIntoView({ block:'start' });
  editorForm.value?.focus({ preventScroll:true });
}
async function selectProduct(p: ProductRow) {
  if(saving.value)return;
  editing.value = structuredClone(toRaw(p));
  await showEditor();
}
async function createProduct() {
  if(saving.value)return;
  editing.value = { id:crypto.randomUUID(),catalog_version:0,slug:'', category:categories.value.find(c => c.active)?.id || 'cake', name:blank(), subtitle:blank(), description:blank(), allergens:blank(), status:'draft', image_path:null, sort_order:100, production_profile:{kind:'manual',work_units:0}, product_variants:[], product_images:[], catalog_options:[] };
  await showEditor();
}
async function load() {
  if (!props.owner) return false;
  loading.value = true; error.value = '';
  const [p,c,r] = await Promise.all([
    api().from('products').select('*,product_variants(*,production_variant_profiles(*)),product_images(*),catalog_options(*)').order('sort_order'),
    api().from('catalog_categories').select('id,name,active,sort_order,catalog_version').order('sort_order'),
    api().from('catalog_price_rules').select('*').order('rule_key')
  ]);
  loading.value = false;
  if (p.error || c.error || r.error) { error.value = 'Каталог не загрузился. Проверьте доступ владельца и обновите страницу.'; return false; }
  products.value = (p.data || []) as unknown as ProductRow[];
  categories.value = (c.data || []) as CategoryRow[];
  rules.value = (r.data || []) as PriceRule[];
  // Refresh the list without replacing a draft held by this editor. Explicit
  // select/reload is required after a version conflict, never silent overwrite.
  return true;
}
function addVariant() {
  if (!editing.value) return;
  editing.value.product_variants.push({ sku:'', name:blank(), price_minor:0, lead_days:2, min_quantity:1, active:false, sort_order:editing.value.product_variants.length*10,production_variant_profiles:null });
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
async function uploadCandidate(p:ProductRow,selectedFile:File){
  const extension=photoExtension(selectedFile);
  const path='products/'+p.id+'/'+crypto.randomUUID()+'.'+extension;
  const uploaded=await api().storage.from('catalog-demo').upload(path,selectedFile,{contentType:selectedFile.type,upsert:false});
  if(uploaded.error)throw uploaded.error;
  const image:ImageRow={id:crypto.randomUUID(),storage_path:path,alt:{...photoAlt},sort_order:p.product_images.length*10,is_primary:p.product_images.length===0};
  p.product_images.push(image);candidatePath.value=path;
  file.value=null;if(photoInput.value)photoInput.value.value='';Object.assign(photoAlt,blank());
}
function catalogError(failure:unknown,productConflict=true){
  const message=failure instanceof Error?failure.message:String((failure as {message?:string})?.message||'');
  if(message.includes('catalog_conflict')){
    if(productConflict)conflict.value=true;
    return productConflict?'Конфликт версий: другой редактор уже сохранил изменения либо прежняя попытка завершилась без ответа. Ваш черновик сохранён на экране. Скопируйте нужные правки и явно загрузите текущую карточку; повторная запись старой версии заблокирована.':'Конфликт версий категории или цены: другая вкладка уже сохранила изменения. Ваши правки остались на экране. Скопируйте их при необходимости, нажмите «Обновить список» и затем повторите.';
  }
  const copy:Record<string,string>={catalog_translation_missing:'Заполните название и описание RU/EN/TH для опубликованного товара.',catalog_variant_translation_missing:'Проверьте RU/EN/TH активных вариантов.',catalog_option_translation_missing:'Проверьте RU/EN/TH активных дополнений.',catalog_active_variant_missing:'У опубликованного товара должен оставаться активный вариант. Сначала снимите товар с публикации.',catalog_primary_image_missing:'Выберите главное фото перед публикацией.',catalog_image_unavailable:'Фото должно быть загружено в Storage и иметь alt RU/EN/TH.',catalog_category_unavailable:'Категория опубликованного товара должна быть активна и переведена на RU/EN/TH.',production_load_required:'Укажите производственный состав активного варианта.',catalog_profile_missing:'Сохраните производственный профиль существующего варианта.',catalog_existing_child_missing:'В карточке отсутствуют связанные записи. Обновите версию; варианты отключаются без удаления.',catalog_variant_identity_conflict:'ID и SKU существующего варианта менять нельзя.'};
  return Object.entries(copy).find(([code])=>message.includes(code))?.[1]||'Не удалось подтвердить атомарное сохранение. Проверьте данные и соединение. Прежняя карточка остаётся действующей; после неизвестного результата сначала загрузите её текущую версию.';
}
async function reloadCurrent(){
  if(saving.value||!editing.value)return;
  const id=editing.value.id;if(!await load())return;const current=products.value.find(p=>p.id===id);
  if(current)await selectProduct(current);
  else error.value='Карточка не найдена. Черновик оставлен на экране.';
}
async function saveSetting(kind:'category'|'price_rule',key:string,version:number,value:Record<string,unknown>){
  if(!props.owner||saving.value)return null;
  saving.value=true;error.value='';
  try{
    const result=await api().rpc('save_catalog_setting',{p_kind:kind,p_key:key,p_expected_version:version,p_value:value});
    if(result.error||!result.data)throw result.error||new Error('catalog_empty_response');
    return result.data;
  }catch(failure){error.value=catalogError(failure,false);return null;}
  finally{saving.value=false;}
}
async function saveProduct(targetStatus?:ProductRow['status']){
  const p=editing.value;
  if(!props.owner||!p||saving.value||conflict.value)return false;
  saving.value=true;error.value='';notice.value='';
  try{
    if(file.value)await uploadCandidate(p,file.value);
    const document=structuredClone(toRaw(p));
    const result=await api().rpc('save_catalog_product',{p_product_id:p.id,p_expected_version:p.catalog_version,p_document:document,p_status:targetStatus||p.status});
    if(result.error||!result.data)throw result.error||new Error('catalog_empty_response');
    editing.value=result.data as unknown as ProductRow;
    candidatePath.value='';
    notice.value='Карточка и все связанные записи сохранены одной транзакцией. Версия '+editing.value.catalog_version+'.';
    await load();return true;
  }catch(failure){
    error.value=catalogError(failure)+(candidatePath.value?' Фото-кандидат сохранён отдельно; действующие фото не удалялись.':'');
    await nextTick();errorAlert.value?.scrollIntoView({block:'center'});return false;
  }finally{saving.value=false;}
}
async function setStatus(status:ProductRow['status']){await saveProduct(status);}
function makePrimary(image:ImageRow){
  if(!props.owner||!editing.value||saving.value)return;
  for(const item of editing.value.product_images)item.is_primary=item.id===image.id;
  notice.value='Главное фото выбрано в черновике. Нажмите «Сохранить», чтобы применить весь товар атомарно.';
}
async function saveRule(rule: PriceRule) {
  if (!props.owner || saving.value || !Number.isInteger(rule.amount_minor) || rule.amount_minor < 0 || rule.amount_minor > 1000000) { error.value = 'Неверная цена.'; return; }
  const data=await saveSetting('price_rule',rule.rule_key,rule.catalog_version,{amount_minor:rule.amount_minor});
  if(data){Object.assign(rule,data);notice.value='Правило цены сохранено и применяется сервером к новым заказам.';}
}
async function saveCategory(category: CategoryRow) {
  if (!props.owner || saving.value || !/^[a-z][a-z0-9-]*$/.test(category.id) || !category.name.ru.trim()) { error.value = 'Укажите slug и название категории.'; return; }
  const values = {id:category.id,name:category.name,active:category.active,sort_order:category.sort_order};
  const data=await saveSetting('category',category.id,category.catalog_version,values);
  if(data){notice.value='Категория сохранена.';Object.assign(categoryDraft,{id:'',catalog_version:0,name:blank(),active:true,sort_order:100});await load();}
}
onMounted(load);
</script>

<template>
  <section v-if="owner" class="catalog-workspace">
    <div class="studio-card"><div class="studio-card-heading"><div><h2>Каталог и цены</h2><p>Тестовые товары · изменение опубликованного товара видно сразу</p></div><button class="btn btn-dark" @click="createProduct">Новый товар +</button></div>
      <input v-model="query" class="form-input" type="search" placeholder="Название или slug" aria-label="Поиск товара" />
      <p v-if="loading">Загружаем каталог…</p><button v-for="p in filtered" :key="p.id" class="knowledge-row" :disabled="saving" @click="selectProduct(p)"><div><strong>{{ p.name.ru }}</strong><p>{{ p.slug }} · {{ p.product_variants.length }} вариантов</p></div><span class="status-chip">{{ p.status==='published' ? 'Опубликован' : p.status==='draft' ? 'Черновик' : 'Архив' }}</span></button>
    </div>
    <p v-if="error" ref="errorAlert" role="alert" class="staff-error">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <form v-if="editing" ref="editorForm" tabindex="-1" class="studio-card catalog-editor" @submit.prevent="saveProduct()"><div class="studio-card-heading"><h2>{{ editing.catalog_version>0 ? 'Редактирование' : 'Новый черновик' }}</h2><button type="button" class="icon-button" aria-label="Закрыть редактор" :disabled="saving" @click="editing=null">×</button></div>
      <p>Карточка, варианты, дополнения, производственный состав и фото-метаданные сохраняются целиком. Версия {{editing.catalog_version}}.</p><p v-if="editing.status==='published'" class="demo-note">Сохранение сразу обновляет опубликованную карточку. Для неполных правок сначала снимите её с публикации.</p><button v-if="conflict" type="button" class="btn btn-outline" :disabled="saving" @click="reloadCurrent">Загрузить текущую карточку (заменит локальный черновик)</button><fieldset :disabled="saving" style="border:0;padding:0;margin:0;min-width:0"><div class="catalog-fields"><label>Slug<input v-model="editing.slug" class="form-input" :disabled="editing.catalog_version>0" required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label><label>Категория<select v-model="editing.category" class="form-input"><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name.ru }}</option></select></label><label>Порядок<input v-model.number="editing.sort_order" class="form-input" type="number" /></label><label>Нагрузка на производство<input v-model.number="editing.production_profile.work_units" class="form-input" type="number" min="0" /></label></div>
      <fieldset v-for="lang in (['ru','en','th'] as const)" :key="lang" class="catalog-language"><legend>{{ lang.toUpperCase() }}</legend><div class="catalog-fields"><label>Название<input v-model="editing.name[lang]" class="form-input" :required="lang==='ru'" /></label><label>Подзаголовок<input v-model="editing.subtitle[lang]" class="form-input" /></label><label>Описание<textarea v-model="editing.description[lang]" class="form-input" rows="2" /></label><label>Аллергены<textarea v-model="editing.allergens[lang]" class="form-input" rows="2" /></label></div></fieldset>
      <h3>Варианты и цены</h3><div v-for="(v,i) in editing.product_variants" :key="v.id||i" class="catalog-variant"><label>SKU<input v-model="v.sku" class="form-input" :disabled="!!v.id" required /></label><label>RU<input v-model="v.name.ru" class="form-input" required /></label><label>EN<input v-model="v.name.en" class="form-input" /></label><label>TH<input v-model="v.name.th" class="form-input" /></label><label>Цена, ฿<input :value="v.price_minor/100" @input="v.price_minor=Math.round(Number(($event.target as HTMLInputElement).value)*100)" class="form-input" type="number" min="0" max="1000000" step="0.01" /></label><label>Дней<input v-model.number="v.lead_days" class="form-input" type="number" min="0" max="365" /></label><label><input v-model="v.active" type="checkbox" /> Активен</label><div v-if="v.production_variant_profiles"><p>Состав одной позиции: торты, наборы конфет, комплекты пряников, капкейки/трайфлы в штуках.</p><label v-for="key in ['cake','chocolate','gingerbread','small']" :key="key">{{ ({cake:'Торты',chocolate:'Наборы конфет',gingerbread:'Комплекты пряников',small:'Капкейки / трайфлы, шт.'} as Record<string,string>)[key] }}<input v-model.number="v.production_variant_profiles.components[key]" class="form-input" type="number" min="0" max="1000"/></label></div><button v-else-if="!['custom-gift','celebration-set'].includes(v.sku)" type="button" @click="v.production_variant_profiles={components:{cake:0,chocolate:0,gingerbread:0,small:0}}">Задать производственный состав</button></div><button type="button" class="btn btn-outline" @click="addVariant">Добавить вариант</button>
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
      <section class="catalog-photo-fields"><h3>Фотографии</h3><p class="demo-note">Фото сначала загружается отдельным кандидатом. Затем метаданные сохраняются вместе со всем товаром. Первое фото станет главным. При ошибке действующие фото сохраняются; кандидат остаётся для повторной попытки и автоматически не удаляется.</p><div v-for="img in editing.product_images" :key="img.id" class="catalog-photo"><img :src="api().storage.from('catalog-demo').getPublicUrl(img.storage_path).data.publicUrl" :alt="img.alt.ru" width="100" height="100" /><span>{{ img.alt.ru }}</span><button v-if="!img.is_primary" type="button" class="btn btn-outline" :disabled="saving" @click="makePrimary(img)">Сделать главным</button><strong v-else>Главное</strong></div><label>Фото: WebP, PNG или JPEG до 5 МБ<input ref="photoInput" type="file" accept="image/webp,image/png,image/jpeg" :disabled="saving" @change="file=($event.target as HTMLInputElement).files?.[0]||null" /></label><div class="catalog-fields"><label v-for="lang in (['ru','en','th'] as const)" :key="lang">Alt {{ lang.toUpperCase() }}<input v-model="photoAlt[lang]" class="form-input" /></label></div></section>
      <div class="button-row"><button class="btn btn-dark" :disabled="saving">{{ file ? 'Сохранить и загрузить фото' : 'Сохранить' }}</button><button v-if="editing.id && editing.status!=='published'" type="button" class="btn btn-outline" :disabled="saving" @click="setStatus('published')">Опубликовать</button><button v-if="editing.id && editing.status==='published'" type="button" class="btn btn-outline" :disabled="saving" @click="setStatus('draft')">Снять с публикации</button><button v-if="editing.id && editing.status!=='archived'" type="button" class="btn btn-outline" :disabled="saving" @click="setStatus('archived')">Архивировать</button><button v-if="editing.status==='archived'" type="button" class="btn btn-outline" :disabled="saving" @click="setStatus('draft')">Восстановить в черновик</button></div>
      <div class="catalog-preview"><h3>Предпросмотр</h3><img v-if="photoUrl(editing)" :src="photoUrl(editing)" :alt="editing.name.ru" width="180" height="180" /><strong>{{ editing.name.ru || 'Название' }}</strong><p>{{ editing.subtitle.ru }}</p></div>
    </fieldset></form>
    <button class="btn btn-outline" :disabled="saving" @click="load">Обновить список: сбросить локальные правки категорий и цен</button><section class="studio-card"><h3>Категории</h3><div v-for="category in categories" :key="category.id" class="catalog-rule"><strong>{{ category.id }}</strong><div class="catalog-fields"><label>RU<input v-model="category.name.ru" class="form-input" /></label><label>EN<input v-model="category.name.en" class="form-input" /></label><label>TH<input v-model="category.name.th" class="form-input" /></label><label>Порядок<input v-model.number="category.sort_order" class="form-input" type="number" /></label><label><input v-model="category.active" type="checkbox" /> Активна</label></div><button class="btn btn-outline" :disabled="saving" @click="saveCategory(category)">Сохранить</button></div><div class="catalog-rule"><h4>Новая категория</h4><div class="catalog-fields"><label>Slug<input v-model="categoryDraft.id" class="form-input" placeholder="trifle" /></label><label>RU<input v-model="categoryDraft.name.ru" class="form-input" /></label><label>EN<input v-model="categoryDraft.name.en" class="form-input" /></label><label>TH<input v-model="categoryDraft.name.th" class="form-input" /></label><label>Порядок<input v-model.number="categoryDraft.sort_order" class="form-input" type="number" /></label></div><button class="btn btn-outline" :disabled="saving" @click="saveCategory(categoryDraft)">Добавить категорию</button></div></section>
    <section class="studio-card"><h3>Цены конструктора</h3><p>Изменения применяются сервером сразу. Цены в ฿.</p><div v-for="rule in rules" :key="rule.rule_key" class="catalog-rule"><label>{{ rule.description }}<small>{{ rule.rule_key }}</small><input :value="rule.amount_minor/100" @input="rule.amount_minor=Math.round(Number(($event.target as HTMLInputElement).value)*100)" class="form-input" type="number" min="0" max="10000" step="0.01" /></label><button class="btn btn-outline" :disabled="saving" @click="saveRule(rule)">Сохранить</button></div></section>
  </section>
</template>
