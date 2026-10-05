<script setup lang="ts">
import {orderCsv} from '~/utils/orderCsv.mjs';
const props=defineProps<{filters:Record<string,unknown>;owner:boolean;busy:boolean}>();
const includeContacts=ref(false);const exporting=ref(false);const error=ref('');const notice=ref('');
const downloadUrl=ref('');const downloadName=ref('');let exportEpoch=0;
function clearDownload(){++exportEpoch;if(downloadUrl.value)URL.revokeObjectURL(downloadUrl.value);downloadUrl.value='';downloadName.value='';notice.value='';}
watch(()=>[props.filters,props.owner,includeContacts.value],clearDownload,{deep:true});
onBeforeUnmount(clearDownload);
async function download(){
 if(props.busy||exporting.value)return;clearDownload();const current=exportEpoch;exporting.value=true;error.value='';
 try{
  const r=await useNuxtApp().$supabase.rpc('staff_export_orders',{...props.filters,p_include_contacts:props.owner&&includeContacts.value});if(r.error)throw r.error;
  if(current!==exportEpoch)return;
  const content=orderCsv(r.data.rows,r.data.includes_contacts);
  downloadUrl.value=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));downloadName.value=`blagova-orders-${new Date().toISOString().slice(0,10)}.csv`;
  notice.value=`CSV подготовлен: ${r.data.count} заказов по применённым фильтрам.`;
 }catch(e){if(current===exportEpoch)error.value=(e as {message?:string}).message?.includes('export_limit_exceeded')?'Выборка превышает 10 000 заказов. Уточните даты или фильтры.':'Экспорт не выполнен. Проверьте доступ и соединение.';}
 finally{exporting.value=false;}
}
</script>
<template><div class="order-export"><label v-if="owner"><input v-model="includeContacts" type="checkbox" :disabled="busy||exporting"/> Включить имена, контакты и адреса клиентов</label><p>CSV по всей применённой выборке, до 10 000 заказов. По умолчанию без имён, контактов, адресов и заметок.</p><button class="btn btn-outline" :disabled="busy||exporting" @click="download">{{exporting?'Готовим CSV…':'Экспорт CSV'}}</button><p v-if="error" class="form-error" role="alert">{{error}}</p><p v-if="notice" role="status">{{notice}}</p><a v-if="downloadUrl" :href="downloadUrl" :download="downloadName" class="text-link">Скачать CSV →</a></div></template>
