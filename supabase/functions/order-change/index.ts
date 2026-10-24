import {origins,cors,reply,rpc,failureReply} from '../_shared/staffHttp.ts';
export async function handleRequest(req:Request){
 const origin=req.headers.get('origin')||'';
 if(!origins.has(origin))return reply('',403,{error:'origin_not_allowed'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=='POST')return reply(origin,405,{error:'method_not_allowed'});
 const authorization=req.headers.get('authorization')||'',key=req.headers.get('apikey')||'';
 if(!authorization.startsWith('Bearer ')||!key)return reply(origin,401,{error:'authentication_required'});
 try{
  const raw=await req.text();if(raw.length>4096)return reply(origin,413,{error:'request_too_large'});
  const body=JSON.parse(raw);
  if(typeof body.orderId!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.orderId)||!Number.isInteger(body.revision)||body.revision<1||!['cancel','reschedule'].includes(body.action))return reply(origin,400,{error:'invalid_request'});
  if(body.action==='reschedule'&&(!Number.isFinite(Date.parse(body.start))||!Number.isFinite(Date.parse(body.end))))return reply(origin,400,{error:'invalid_schedule'});
  const order=await rpc('staff_change_order',{p_order_id:body.orderId,p_revision:body.revision,p_action:body.action,p_start:body.action==='reschedule'?body.start:null,p_end:body.action==='reschedule'?body.end:null},key,authorization);
  return reply(origin,200,{status:order.notification_status,reference:order.reference,event:order.event});
 }catch(e){return failureReply(origin,e);}
}
if(typeof Deno!=='undefined')Deno.serve(handleRequest);
declare const Deno:{serve(handler:(req:Request)=>Promise<Response>):void};
