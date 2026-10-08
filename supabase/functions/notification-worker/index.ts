import {reply,rpc,serviceKey} from '../_shared/staffHttp.ts';
import {notificationCopy} from '../_shared/notificationCopy.ts';
import type {NotificationPayload} from '../_shared/notificationCopy.ts';
type Job={kind:string;id:string;lease_token:string;attempt:number;payload:NotificationPayload};
export async function processJob(job:Job,secret:string){
 let status='failed',error:string|null=null,providerId:string|null=null;
 try{
  const copy=notificationCopy(job.payload);
  if(!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(job.payload.customer_contact.trim())){status='manual_required';error='customer_email_missing';}
  else if(job.payload.is_demo){status='simulated';}
  else if(Deno.env.get('NOTIFICATION_SEND_ENABLED')!=='true'){status='manual_required';error='live_delivery_disabled';}
  else {
   const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('ORDER_EMAIL_FROM'),replyTo=Deno.env.get('ORDER_EMAIL_MANAGER_TO');
   if(!key||!from||!replyTo){status='manual_required';error='email_not_configured';}
   else{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`blagova/${job.kind}/${job.id}`},body:JSON.stringify({from,to:[job.payload.customer_contact.trim().toLowerCase()],reply_to:replyTo,...copy}),signal:AbortSignal.timeout(10000)});
    const body=await response.json().catch(()=>null);
    if(response.ok&&typeof body?.id==='string'){status='sent';providerId=body.id;}
    else{error=`provider_${response.status}`;status=response.status===429||response.status>=500?'failed':'manual_required';}
   }
  }
 }catch{status='failed';error='transport_or_render_failed';}
 const completed=await rpc('complete_order_delivery',{p_kind:job.kind,p_delivery_id:job.id,p_lease_token:job.lease_token,p_status:status,p_provider_id:providerId,p_error:error},secret);
 return completed?status:'lease_lost';
}
export async function handleRequest(req:Request){
 // Cron calls use a dedicated Vault credential. Browser/user JWTs are not enough.
 if(req.method!=='POST')return reply('',405,{error:'method_not_allowed'});
 const token=req.headers.get('x-blagova-worker-token')||'';
 if(token.length<32||token.length>256)return reply('',401,{error:'worker_authentication_required'});
 try{
  const secret=serviceKey();if(!secret)return reply('',503,{error:'worker_unavailable'});
  if(!await rpc('authorize_notification_worker',{p_token:token},secret))return reply('',401,{error:'worker_authentication_required'});
  const jobs=await rpc('claim_order_deliveries',{p_limit:5},secret) as Job[];
  // All replies contain counters only; no recipients, snapshots or credentials.
  const counts:Record<string,number>={};
  const results=await Promise.allSettled(jobs.map(job=>processJob(job,secret)));
  for(const result of results){const status=result.status==='fulfilled'?result.value:'completion_failed';counts[status]=(counts[status]||0)+1;}
  return reply('',200,{processed:jobs.length,results:counts});
 }catch{return reply('',503,{error:'worker_unavailable'});}
}
if(typeof Deno!=='undefined')Deno.serve(handleRequest);
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(req:Request)=>Promise<Response>):void};
