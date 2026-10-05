<script setup lang="ts">
import {orderCsv} from '~/utils/orderCsv.mjs';
const props=defineProps<{filters:Record<string,unknown>;owner:boolean;busy:boolean}>();
const includeContacts=ref(false);const exporting=ref(false);const error=ref('');const notice=ref('');
async function download(){
 if(props.busy||exporting.value)return;exporting.value=true;error.value='';notice.value='';
 try{
  const r=await useNuxtApp().$supabase.rpc('staff_export_orders',{...props.filters,p_include_contacts:props.owner&&includeContacts.value});if(r.error)throw r.error;
  const content=orderCsv(r.data.rows,r.data.includes_contacts);
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`blagova-orders-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  notice.value=`Выгружено ${r.data.count} заказов по применённым фильтрам.`;
 }catch(e){error.value=(e as {message?:string}).message?.includes('export_limit_exceeded')?'Выборка превышает 10 000 заказов. Уточните даты или фильтры.':'Экспорт не выполнен. Проверьте доступ и соединение.';}
 finally{exporting.value=false;}
}
</script>
<template><div class="order-export"><label v-if="owner"><input v-model="includeContacts" type="checkbox" :disabled="busy||exporting"/> Включить имена, контакты и адреса клиентов</label><p>CSV по всей применённой выборке, до 10 000 заказов. По умолчанию без имён, контактов, адресов и заметок.</p><button class="btn btn-outline" :disabled="busy||exporting" @click="download">{{exporting?'Готовим CSV…':'Экспорт CSV'}}</button><p v-if="error" class="form-error" role="alert">{{error}}</p><p v-if="notice" role="status">{{notice}}</p></div></template>
