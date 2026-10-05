// Audit records store the resulting values. Compare adjacent revisions; never
// reconstruct historical configuration from the current catalogue.
export function orderHistory(events,notes,statusLabel,dateTime) {
 const sorted=[...events].sort((a,b)=>a.revision-b.revision||a.id.localeCompare(b.id));
 const rows=sorted.map((event,index)=>{
  const lines=[];const previous=sorted[index-1]?.details||{};const details=event.details||{};
  if(event.kind==='created') lines.push('Заявка создана · '+statusLabel(event.new_status));
  else {
   if(event.old_status!==event.new_status) lines.push(statusLabel(event.old_status)+' → '+statusLabel(event.new_status));
   if(index && (details.scheduled_start!==previous.scheduled_start||details.scheduled_end!==previous.scheduled_end) && details.scheduled_start) lines.push('Перенос: '+dateTime(details.scheduled_start)+' — '+dateTime(details.scheduled_end));
   if(details.production_load!==previous.production_load && details.production_load!==undefined) lines.push(details.production_load===null?'Нагрузка требует уточнения':'Нагрузка: '+details.production_load+' ед.');
   if(details.rules_version!==previous.rules_version && details.rules_version!=null) lines.push('Правила производства: версия '+details.rules_version);
   if(details.reservation_expires_at!==previous.reservation_expires_at && details.reservation_expires_at!==undefined) lines.push(details.reservation_expires_at?'Резерв до '+dateTime(details.reservation_expires_at):'Резерв снят');
   const reason=details.production_assessment?.reason;
   if(reason && reason!==previous.production_assessment?.reason) lines.push('Основание оценки: '+reason);
   if(!lines.length) lines.push('Данные заказа обновлены');
  }
  return {id:event.id,at:event.created_at,revision:event.revision,actor_id:event.actor_id,lines};
 });
 for(const note of notes) rows.push({id:note.id,at:note.created_at,revision:note.order_revision,actor_id:note.actor_id,lines:['Внутренняя заметка: '+note.body]});
 return rows.sort((a,b)=>a.at.localeCompare(b.at)||a.revision-b.revision||a.id.localeCompare(b.id));
}
