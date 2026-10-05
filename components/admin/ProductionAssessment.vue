<script setup lang="ts">
import type {StoredOrder} from '~/types/studio';
const props=defineProps<{order:StoredOrder}>();const emit=defineEmits<{saved:[]}>();
const counts=reactive({cake:0,chocolate:0,gingerbread:0,small:0});const reason=ref('');const price=ref<number|null>(null);const busy=ref(false);const error=ref('');
const names={cake:'Торты',chocolate:'Наборы конфет',gingerbread:'Комплекты пряников',small:'Капкейки / трайфлы, шт.'};
async function save(){busy.value=true;error.value='';try{
 const {error:failure}=await useNuxtApp().$supabase.rpc('staff_assess_production',{p_order_id:props.order.id,p_revision:props.order.revision,p_counts:counts,p_reason:reason.value,p_manual_price_minor:price.value===null?null:Math.round(price.value*100)});
 if(failure)throw failure;emit('saved');
 }catch{error.value='Оценка не сохранена. Нужны ненулевой состав, причина и свободный интервал. Обновите заказ.';}finally{busy.value=false;}}
</script>
<template><form class="inspector-section" @submit.prevent="save"><h3>Уточнить производственную нагрузку</h3><p>Состав не восстановлен. До оценки заявка не резервирует место и не может быть подтверждена. Укажите весь заказ.</p><label v-for="(name,key) in names" :key="key">{{name}}<input v-model.number="counts[key]" class="form-input" type="number" min="0" max="1000" required/></label><label>Основание оценки<textarea v-model="reason" class="form-input" minlength="3" maxlength="500" required/></label><label v-if="!order.order_items.length">Согласованная цена, ฿<input v-model.number="price" class="form-input" type="number" min="0" step="0.01" required/></label><p v-if="error" role="alert">{{error}}</p><button class="btn btn-outline" :disabled="busy">Сохранить оценку и удержать место</button></form></template>
