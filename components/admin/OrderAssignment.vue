<script setup lang="ts">
import type {StoredOrder,StaffMember} from '~/types/studio';
const props=defineProps<{order:StoredOrder;members:StaffMember[];staffId:string;owner:boolean;busy:boolean}>();
const emit=defineEmits<{saved:[];refresh:[];busy:[value:boolean]}>();
const target=ref(props.order.assigned_to||'');const error=ref('');
watch(()=>props.order.assigned_to,value=>{target.value=value||'';});
const currentLabel=computed(()=>props.members.find(s=>s.id===props.order.assigned_to)?.label||(props.order.assigned_to?'Сотрудник неактивен · '+props.order.assigned_to.slice(0,8):'Не назначен'));
const editable=computed(()=>!['completed','cancelled'].includes(props.order.status)&&(props.owner||!props.order.assigned_to||props.order.assigned_to===props.staffId));
async function assign(id:string){
 if(props.busy||!editable.value)return;error.value='';emit('busy',true);
 try{const r=await useNuxtApp().$supabase.rpc('staff_assign_order',{p_order_id:props.order.id,p_revision:props.order.revision,p_assignee:id||null});if(r.error)throw r.error;emit('saved');}
 catch(e){error.value=(e as {code?:string}).code==='40001'?'Заказ изменился. Проверьте обновлённую карточку и повторите.':'Назначение не сохранено. Сотрудник мог стать неактивным или заказ уже взят другим менеджером.';emit('refresh');}
 finally{emit('busy',false);}
}
</script>
<template><section class="inspector-section"><h4>Ответственный</h4><p>{{currentLabel}}</p><form v-if="owner&&editable" class="assignment-form" @submit.prevent="assign(target)"><label>Назначить сотрудника<select v-model="target" class="form-input" :disabled="busy"><option value="">Не назначен</option><option v-for="s in members" :key="s.id" :value="s.id">{{s.label}} · {{s.role==='owner'?'Владелец':'Менеджер'}}</option></select></label><button class="btn btn-outline" :disabled="busy||target===(order.assigned_to||'')">Сохранить назначение</button></form><button v-else-if="editable" class="btn btn-outline" :disabled="busy" @click="assign(order.assigned_to?'':staffId)">{{order.assigned_to?'Освободить заказ':'Назначить себя'}}</button><p v-if="!owner&&order.assigned_to&&order.assigned_to!==staffId">Переназначить заказ может владелец.</p><p v-if="error" class="form-error" role="alert">{{error}}</p></section></template>
