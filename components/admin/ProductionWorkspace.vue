<script setup lang="ts">
const props=defineProps<{owner:boolean;date:string}>();
const api=()=>useNuxtApp().$supabase;
type Counts=Record<string,number>;
interface Rules { budget:number;hold_minutes:number;coefficients:Counts;limits:Counts;gift_chocolates_per_set:number;gingerbread_per_set:number;slots:Array<{weekday:number;start:string;end:string}>;blackouts:Array<{date:string;reason:string}> }
interface Slot {label:string;used:number;capacity:number;available:boolean;category_used:Counts;category_limits:Counts;unknown_orders:number}
const names:Record<string,string>={cake:'Торты',chocolate:'Наборы конфет',gingerbread:'Комплекты пряников',small:'Капкейки / трайфлы, шт.'};
const slots=ref<Slot[]>([]);const rules=ref<Rules|null>(null);const version=ref(0);const error=ref('');const notice=ref('');const busy=ref(false);
let request=0;
async function load(){const id=++request;error.value='';try{
 const [day,settings]=await Promise.all([api().rpc('staff_production_day',{p_date:props.date}),api().from('production_rule_versions').select('version,config').order('version',{ascending:false}).limit(1).single()]);
 if(id!==request)return;if(day.error||settings.error)throw new Error('load');slots.value=day.data as Slot[];rules.value=structuredClone(settings.data.config) as Rules;version.value=settings.data.version;
 }catch{if(id===request){slots.value=[];error.value='Не удалось загрузить производственный календарь.';}}
}
async function save(){if(!rules.value||!props.owner)return;busy.value=true;notice.value='';try{
 const result=await api().rpc('save_production_rules',{p_config:rules.value,p_expected_version:version.value});if(result.error)throw result.error;
 await load();notice.value='Сохранена новая версия правил. Нагрузка ранее подтверждённых заказов сохранена.';
 }catch{error.value='Правила не сохранены. Проверьте числа, пересечения интервалов и обновите данные.';}finally{busy.value=false;}}
watch(()=>props.date,load);onMounted(load);
</script>
<template>
 <div class="production-workspace"><div class="button-row"><h3>Нагрузка производства</h3><button class="btn btn-outline" @click="load">Обновить нагрузку</button></div>
 <p v-if="error" role="alert">{{error}}</p><p v-if="notice" role="status">{{notice}}</p>
 <article v-for="s in slots" :key="s.label" class="inspector-section"><strong>{{s.label}} · {{s.used}} / {{s.capacity}} единиц</strong>
 <p v-if="s.unknown_orders">{{s.unknown_orders}} подтверждённых заказов с неизвестной нагрузкой — новые бронирования заблокированы.</p>
 <p v-for="(label,key) in names" :key="key">{{label}}: {{s.category_used[key]||0}} / {{s.category_limits[key]}}</p></article>
 <form v-if="owner && rules" class="inspector-section" @submit.prevent="save"><h3>Правила · версия {{version}}</h3>
 <label>Общий бюджет<input v-model.number="rules.budget" class="form-input" type="number" min="1" max="10000" required/></label>
 <label>Резерв, минут<input v-model.number="rules.hold_minutes" class="form-input" type="number" min="1" max="1440" required/></label>
 <div v-for="(label,key) in names" :key="key" class="catalog-variant"><strong>{{label}}</strong><label>Единиц нагрузки<input v-model.number="rules.coefficients[key]" class="form-input" type="number" min="1" max="10000" required/></label><label>Предел категории<input v-model.number="rules.limits[key]" class="form-input" type="number" min="1" max="10000" required/></label></div>
 <label>Конфет в производственном наборе<input v-model.number="rules.gift_chocolates_per_set" class="form-input" type="number" min="1" max="10000" required/></label><label>Пряников в производственном комплекте<input v-model.number="rules.gingerbread_per_set" class="form-input" type="number" min="1" max="10000" required/></label>
 <h4>Интервалы · день 1 = понедельник, 7 = воскресенье</h4>
 <div v-for="(s,i) in rules.slots" :key="i" class="catalog-variant"><input v-model.number="s.weekday" aria-label="День недели" type="number" min="1" max="7" class="form-input" required/><input v-model="s.start" aria-label="Начало" type="time" class="form-input" required/><input v-model="s.end" aria-label="Конец" type="time" class="form-input" required/><button type="button" @click="rules.slots.splice(i,1)">Удалить</button></div>
 <button type="button" class="text-link" @click="rules.slots.push({weekday:1,start:'09:00',end:'12:00'})">Добавить интервал</button>
 <h4>Недоступные даты</h4><div v-for="(b,i) in rules.blackouts" :key="i" class="catalog-variant"><input v-model="b.date" aria-label="Недоступная дата" type="date" class="form-input" required/><input v-model="b.reason" aria-label="Причина" maxlength="250" class="form-input"/><button type="button" @click="rules.blackouts.splice(i,1)">Удалить</button></div>
 <button type="button" class="text-link" @click="rules.blackouts.push({date:date,reason:''})">Добавить дату</button>
 <p>Изменения действуют для новых заявок. Подтверждение и перенос проверяются по текущим пределам с сохранённой нагрузкой заказа.</p><button class="btn btn-dark" :disabled="busy">Сохранить новую версию</button></form></div>
</template>
