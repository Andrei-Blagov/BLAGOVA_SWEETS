<script setup lang="ts">
import type {StoredOrder} from '~/types/studio';
const props=defineProps<{order:StoredOrder;busy:boolean}>();
const emit=defineEmits<{saved:[];refresh:[];busy:[value:boolean]}>();
const body=ref('');const requestId=ref('');const error=ref('');
watch(body,()=>{requestId.value='';});
async function save(){
 if(props.busy||!body.value.trim())return;
 if(!requestId.value)requestId.value=newUuid();
 emit('busy',true);error.value='';
 try{
  const result=await useNuxtApp().$supabase.rpc('staff_add_order_note',{p_order_id:props.order.id,p_revision:props.order.revision,p_note_id:requestId.value,p_body:body.value.trim()});
  if(result.error)throw result.error;
  body.value='';requestId.value='';emit('saved');
 }catch(failure){
  const conflict=(failure as {code?:string})?.code==='40001';
  error.value=conflict?'Заказ изменился. Карточка обновляется; текст заметки сохранён в форме. Проверьте данные и повторите.':'Заметка не сохранена. Проверьте соединение и повторите.';
  if(conflict)emit('refresh');
 }finally{emit('busy',false);}
}
</script>
<template><form class="inspector-section order-notes" @submit.prevent="save"><h4>Внутренняя заметка</h4><p>Видна только сотрудникам. Пожелания клиента сохраняются отдельно.</p><label>Текст заметки<textarea v-model="body" class="form-input" maxlength="2000" rows="3" required :disabled="busy"/></label><p v-if="error" class="form-error" role="alert">{{error}}</p><button class="btn btn-outline" :disabled="busy||!body.trim()">Добавить заметку</button></form></template>
