<script setup lang="ts">
import type {StoredOrder,StoredNotificationDelivery} from '~/types/studio';
const props=defineProps<{order:StoredOrder;busy:boolean}>();
const emit=defineEmits<{saved:[];refresh:[];busy:[value:boolean]}>();
const error=ref('');const notice=ref('');
const deliveries=computed(()=>[...props.order.order_notification_deliveries.map(d=>({...d,kind:'confirmation'})),...props.order.order_change_deliveries.map(d=>({...d,kind:'change'}))]);
const name=(event:string)=>event==='order_confirmed'?'Подтверждение':event==='order_rescheduled'?'Перенос':'Отмена';
const state=(s:string)=>({pending:'В очереди',sending:'Отправляется',sent:'Отправлено',failed:'Ошибка · повтор запланирован',manual_required:'Требует ручной проверки',simulated:'Демо: отправка проверена',lease_expired:'Попытка прервана',retry_requested:'Повтор запрошен сотрудником'}[s]||s);
const reason=(s:string|null)=>s==='legacy_notification_review'?'Старая отправка без снимка сообщения; свяжитесь с клиентом вручную.':s==='superseded_notification'?'Сообщение устарело после изменения заказа.':s==='customer_email_missing'?'Email не указан; свяжитесь с клиентом вручную.':s==='attempts_exhausted'?'Лимит попыток исчерпан.':s==='idempotency_window_expired'?'Срок безопасного повтора истёк; проверьте отправку вручную.':s==='live_delivery_disabled'?'Реальные отправки отключены.':s==='email_not_configured'?'Почтовый сервис не настроен.':s?'Ошибка доставки; подробности доступны в истории попыток.':'';
const attemptEvent=(id:string)=>name(deliveries.value.find(d=>d.id===id)?.event||'order_confirmed');
const date=(s:string)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
async function retry(d:StoredNotificationDelivery&{kind:string}){
 if(props.busy)return;emit('busy',true);error.value='';notice.value='';
 try{const r=await useNuxtApp().$supabase.rpc('staff_retry_order_notification',{p_kind:d.kind,p_delivery_id:d.id,p_revision:props.order.revision});if(r.error)throw r.error;notice.value='Повтор поставлен в очередь. Обработчик запускается каждые две минуты; обновите карточку, чтобы увидеть результат.';emit('saved');}
 catch{error.value='Повтор не поставлен в очередь. Обновите карточку: данные могли измениться или отправка требует ручной проверки.';emit('refresh');}
 finally{emit('busy',false);}
}
</script>
<template><section class="inspector-section notification-list"><h4>Уведомления</h4><p v-if="order.is_demo">Тестовые заявки проходят очередь без отправки реальных писем.</p><article v-for="d in deliveries" :key="d.id"><strong>{{name(d.event)}} · {{state(d.status)}}</strong><p>Попыток: {{d.attempts}}<template v-if="d.status==='failed'"> · следующий повтор {{date(d.available_at)}}</template></p><p v-if="d.last_error">{{reason(d.last_error)}}</p><button v-if="d.status==='failed'&&d.attempts<5" class="text-link" :disabled="busy" @click="retry(d)">Повторить сейчас →</button></article><p v-if="!deliveries.length">Отправок ещё нет.</p><p v-if="error" class="form-error" role="alert">{{error}}</p><p v-if="notice" role="status">{{notice}}</p><details v-if="order.order_delivery_attempts?.length"><summary>История попыток ({{order.order_delivery_attempts.length}})</summary><ol class="delivery-attempts"><li v-for="a in order.order_delivery_attempts" :key="a.id">{{date(a.created_at)}} · {{attemptEvent(a.delivery_id)}} · {{state(a.status)}} · попытка {{a.attempt}}<span v-if="a.error_code"> · {{reason(a.error_code)}}</span></li></ol></details></section></template>
