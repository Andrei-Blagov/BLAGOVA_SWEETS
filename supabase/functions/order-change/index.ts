const allowedOrigins = new Set([
  'https://blagova-pattaya-atelier.blagovandrey1323.chatgpt.site',
  'https://blagovasweets.com',
  'https://www.blagovasweets.com',
  'https://preview.blagovasweets.com',
  'http://localhost:3000',
]);

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

function reply(origin: string,status: number,body: Record<string,unknown>) {
  return Response.json(body,{status,headers:{...corsHeaders(origin),'Cache-Control':'no-store'}});
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g,character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character] || character));
}
function emailFromContact(value: string) {
  return value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0].toLowerCase() || '';
}
function formatSchedule(start: Date,end: Date,locale: string) {
  const language=locale==='th'?'th-TH':locale==='en'?'en-GB':'ru-RU';
  const date=new Intl.DateTimeFormat(language,{timeZone:'Asia/Bangkok',day:'numeric',month:'long',year:'numeric'}).format(start);
  const time=new Intl.DateTimeFormat(language,{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false});
  return `${date}, ${time.format(start)}–${time.format(end)}`;
}
async function rpc(name: string,body: Record<string,unknown>,key: string,authorization?: string) {
  const response=await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,...(authorization?{Authorization:authorization}:{}),'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
  const result=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(`${name}_${response.status}_${result?.code || result?.message || 'error'}`);
  return result;
}
function emailCopy(order: ChangedOrder) {
  const schedule=formatSchedule(new Date(order.scheduled_start),new Date(order.scheduled_end),order.locale);
  const name=escapeHtml(order.customer_name);
  const reference=escapeHtml(order.reference);
  const safeSchedule=escapeHtml(schedule);
  if(order.event==='order_cancelled') {
    if(order.locale==='en') return {subject:`Order ${order.reference} cancelled`,text:`Hello ${order.customer_name}. Order ${order.reference} has been cancelled. If this was unexpected, please contact us.`,html:`<h2>Order cancelled</h2><p>Hello, ${name}. Order <strong>${reference}</strong> has been cancelled.</p><p>If this was unexpected, please contact us.</p>`};
    if(order.locale==='th') return {subject:`ยกเลิกออเดอร์ ${order.reference} แล้ว`,text:`สวัสดี ${order.customer_name} ออเดอร์ ${order.reference} ถูกยกเลิกแล้ว`,html:`<h2>ยกเลิกออเดอร์แล้ว</h2><p>สวัสดี ${name} ออเดอร์ <strong>${reference}</strong> ถูกยกเลิกแล้ว</p>`};
    return {subject:`Заказ ${order.reference} отменён`,text:`Здравствуйте, ${order.customer_name}. Заказ ${order.reference} отменён. Если это произошло неожиданно, свяжитесь с нами.`,html:`<h2>Заказ отменён</h2><p>Здравствуйте, ${name}. Заказ <strong>${reference}</strong> отменён.</p><p>Если это произошло неожиданно, свяжитесь с нами.</p>`};
  }
  if(order.locale==='en') return {subject:`New time for order ${order.reference}`,text:`Hello ${order.customer_name}. Order ${order.reference} has been moved to ${schedule} (Pattaya time).`,html:`<h2>Order time changed</h2><p>Hello, ${name}. Order <strong>${reference}</strong> has been moved to <strong>${safeSchedule}</strong> (Pattaya time).</p>`};
  if(order.locale==='th') return {subject:`เปลี่ยนเวลาออเดอร์ ${order.reference}`,text:`สวัสดี ${order.customer_name} ออเดอร์ ${order.reference} เปลี่ยนเป็น ${schedule} (เวลาพัทยา)`,html:`<h2>เปลี่ยนเวลาออเดอร์แล้ว</h2><p>สวัสดี ${name} ออเดอร์ <strong>${reference}</strong> เปลี่ยนเป็น <strong>${safeSchedule}</strong> (เวลาพัทยา)</p>`};
  return {subject:`Новое время заказа ${order.reference}`,text:`Здравствуйте, ${order.customer_name}. Заказ ${order.reference} перенесён на ${schedule} по времени Паттайи.`,html:`<h2>Время заказа изменено</h2><p>Здравствуйте, ${name}. Заказ <strong>${reference}</strong> перенесён на <strong>${safeSchedule}</strong> по времени Паттайи.</p>`};
}

Deno.serve(async(req: Request)=>{
  const origin=req.headers.get('origin') || '';
  if(!allowedOrigins.has(origin)) return Response.json({error:'origin_not_allowed'},{status:403});
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:corsHeaders(origin)});
  if(req.method!=='POST') return reply(origin,405,{error:'method_not_allowed'});
  try {
    const authorization=req.headers.get('authorization') || '';
    const publishable=req.headers.get('apikey') || '';
    if(!authorization.startsWith('Bearer ') || !publishable) return reply(origin,401,{error:'authentication_required'});
    const payload=await req.json();
    const orderId=typeof payload?.orderId==='string'?payload.orderId:'';
    const revision=Number(payload?.revision);
    const action=payload?.action==='cancel'?'cancel':payload?.action==='reschedule'?'reschedule':'';
    if(!/^[0-9a-f-]{36}$/i.test(orderId) || !Number.isInteger(revision) || revision<1 || !action) return reply(origin,400,{error:'invalid_request'});
    const start=action==='reschedule' && typeof payload?.start==='string'?payload.start:null;
    const end=action==='reschedule' && typeof payload?.end==='string'?payload.end:null;
    const order=await rpc('staff_change_order',{p_order_id:orderId,p_revision:revision,p_action:action,p_start:start,p_end:end},publishable,authorization) as ChangedOrder;
    const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string,string>;
    const secret=secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if(!secret) throw new Error('service_key_missing');
    const claimed=await rpc('claim_order_change',{p_delivery_id:order.delivery_id},secret) as boolean;
    if(!claimed) return reply(origin,202,{status:'sending',reference:order.reference,event:order.event});
    const customerEmail=emailFromContact(order.customer_contact);
    if(!customerEmail) {
      await rpc('complete_order_change',{p_delivery_id:order.delivery_id,p_status:'manual_required',p_provider_message_id:null,p_error:'customer_email_missing'},secret);
      return reply(origin,200,{status:'manual_required',reference:order.reference,event:order.event});
    }
    const resendKey=Deno.env.get('RESEND_API_KEY') || '';
    const from=Deno.env.get('ORDER_EMAIL_FROM') || '';
    if(!resendKey || !from) throw new Error('email_not_configured');
    const copy=emailCopy(order);
    const managerEmail=Deno.env.get('ORDER_EMAIL_MANAGER_TO') || 'blagovandrey1323@gmail.com';
    const mail=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':`${order.event}/${order.order_id}/${order.revision}/customer`},body:JSON.stringify({from,to:[customerEmail],reply_to:managerEmail,subject:copy.subject,html:copy.html,text:copy.text})});
    const mailResult=await mail.json().catch(()=>({}));
    if(!mail.ok) {
      await rpc('complete_order_change',{p_delivery_id:order.delivery_id,p_status:'failed',p_provider_message_id:null,p_error:`provider_${mail.status}`},secret);
      return reply(origin,502,{error:'email_delivery_failed',status:'failed',reference:order.reference,event:order.event});
    }
    await rpc('complete_order_change',{p_delivery_id:order.delivery_id,p_status:'sent',p_provider_message_id:mailResult.id || null,p_error:null},secret);
    return reply(origin,200,{status:'sent',reference:order.reference,event:order.event});
  } catch(error) {
    const message=error instanceof Error?error.message:'unknown';
    console.error('order_change_failed',message);
    if(message.includes('slot_capacity_full')) return reply(origin,409,{error:'slot_capacity_full'});
    if(message.includes('slot_unavailable')) return reply(origin,409,{error:'slot_unavailable'});
    if(message.includes('40001')) return reply(origin,409,{error:'order_changed'});
    return reply(origin,400,{error:'order_change_failed'});
  }
});

declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Response|Promise<Response>):void};
type ChangedOrder={order_id:string;reference:string;revision:number;status:string;customer_name:string;customer_contact:string;locale:string;scheduled_start:string;scheduled_end:string;event:'order_rescheduled'|'order_cancelled';delivery_id:string;notification_status:string};
