export interface NotificationPayload {order_id:string;revision:number;reference:string;event:string;customer_name:string;customer_contact:string;locale:string;fulfillment:string;delivery_address:string|null;scheduled_start:string;scheduled_end:string;is_demo:boolean;total_minor:number;items:Array<{name:string;detail:string;quantity:number;line_total_minor:number}>}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]!));
export function notificationCopy(p:NotificationPayload){
 const locale=p.locale==='en'?'en-GB':p.locale==='th'?'th-TH':'ru-RU';
 const day=new Intl.DateTimeFormat(locale,{timeZone:'Asia/Bangkok',day:'numeric',month:'long',year:'numeric'}).format(new Date(p.scheduled_start));
 const time=new Intl.DateTimeFormat(locale,{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false});
 const schedule=`${day}, ${time.format(new Date(p.scheduled_start))}–${time.format(new Date(p.scheduled_end))}`;
 const words=p.locale==='en'?{greet:'Hello',confirmed:'Order confirmed',rescheduled:'Order time changed',cancelled:'Order cancelled',total:'Total',pickup:'Pickup',delivery:'Delivery'}:p.locale==='th'?{greet:'สวัสดี',confirmed:'ยืนยันออเดอร์แล้ว',rescheduled:'เปลี่ยนเวลาออเดอร์แล้ว',cancelled:'ยกเลิกออเดอร์แล้ว',total:'ยอดรวม',pickup:'รับด้วยตนเอง',delivery:'จัดส่ง'}:{greet:'Здравствуйте',confirmed:'Заказ подтверждён',rescheduled:'Время заказа изменено',cancelled:'Заказ отменён',total:'Итого',pickup:'Самовывоз',delivery:'Доставка'};
 const heading=p.event==='order_confirmed'?words.confirmed:p.event==='order_cancelled'?words.cancelled:words.rescheduled;
 const money=(n:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'THB'}).format(n/100);
 const lines=[`${words.greet}, ${p.customer_name}.`,`${heading}: ${p.reference}.`];
 if(p.event!=='order_cancelled')lines.push(`${schedule} (Asia/Bangkok)`);
 if(p.event==='order_confirmed'){for(const item of p.items)lines.push(`${item.name}${item.detail?' · '+item.detail:''} × ${item.quantity} — ${money(item.line_total_minor)}`);lines.push(`${words.total}: ${money(p.total_minor)}`,p.fulfillment==='delivery'?`${words.delivery}: ${p.delivery_address||''}`:words.pickup);}
 return {subject:`${heading} · ${p.reference}`,text:lines.join('\n'),html:`<h2>${escape(heading)}</h2>`+lines.map(line=>`<p>${escape(line)}</p>`).join('')};
}
