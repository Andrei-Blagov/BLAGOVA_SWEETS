<script setup lang="ts">
import type {StoredOrder} from '~/types/studio';
import {orderHistory} from '~/utils/orderHistory.mjs';
import {statuses} from '~/data/operations';
const props=defineProps<{order:StoredOrder;staffId:string}>();
const label=(status:string)=>statuses.find(s=>s.id===status)?.label||status;
const dateTime=(at:string)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(at));
const rows=computed(()=>orderHistory(props.order.order_events,props.order.order_notes,label,dateTime));
</script>
<template><section class="order-history"><h4>История заказа</h4><ol><li v-for="row in rows" :key="row.id"><div><time :datetime="row.at">{{dateTime(row.at)}}</time><small>Версия {{row.revision}} · {{!row.actor_id?'Сайт / система':row.actor_id===staffId?'Вы':'Сотрудник · '+row.actor_id.slice(0,8)}}</small></div><p v-for="(line,index) in row.lines" :key="index">{{line}}</p></li></ol><p v-if="!rows.length">История ещё не записана.</p></section></template>
