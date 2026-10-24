import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {processJob} from '../../supabase/functions/notification-worker/index.ts';
import {notificationCopy} from '../../supabase/functions/_shared/notificationCopy.ts';

const token='a'.repeat(64),rate='b'.repeat(64);
const payload={source:'website',locale:'en',customerName:'Synthetic <name>',customerContact:'qa@example.invalid',fulfillment:'pickup',deliveryAddress:'',deliveryZone:'pickup',scheduledStart:'2099-01-05T02:00:00Z',scheduledEnd:'2099-01-05T05:00:00Z',note:'Synthetic <note>',items:[{sku:'berry-cloud-1kg',quantity:1,configuration:{}}],messages:[]};
async function database(){
 const db=new PGlite();await db.exec(readFileSync('scripts/test-database.mjs','utf8').match(/await db\.exec\(`([\s\S]*?)`\);/)[1]);
 for(const f of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 return db;
}
test('intake receipt and two frozen notifications commit atomically, duplicate once, retry through existing SQL leases',async t=>{
 const db=await database();const beforeFetch=globalThis.fetch,beforeDeno=globalThis.Deno;
 const env={SUPABASE_URL:'https://fixture.invalid',SUPABASE_SECRET_KEYS:'{"default":"service-test"}',NOTIFICATION_SEND_ENABLED:'true',RESEND_API_KEY:'synthetic-mail',ORDER_EMAIL_FROM:'from@example.invalid',ORDER_EMAIL_MANAGER_TO:'manager@example.invalid'};
 globalThis.Deno={env:{get:n=>env[n]},serve:()=>{}};
 const query=async(sql,args=[])=>{await db.exec('set role service_role');try{return (await db.query(sql,args)).rows[0]?.result;}finally{await db.exec('reset role');}};
 const submit=key=>query('select public.submit_storefront_intent($1,$2,$3::jsonb,$4) result',[key,token,JSON.stringify(payload),rate]);
 const claim=()=>query('select public.claim_order_deliveries(5) result');
 const providerCalls=[];let providerMode='429';const timeouts=[];
 const originalTimeout=AbortSignal.timeout.bind(AbortSignal);t.mock.method(AbortSignal,'timeout',ms=>{timeouts.push(ms);return originalTimeout(5);});
 globalThis.fetch=async(url,init)=>{
  if(url==='https://api.resend.com/emails'){
   providerCalls.push({body:init.body,key:init.headers['Idempotency-Key']});
   if(providerMode==='timeout')return new Promise((_,reject)=>{const abort=()=>reject(new DOMException('synthetic timeout','TimeoutError'));if(init.signal.aborted)abort();else init.signal.addEventListener('abort',abort,{once:true});});
   return Response.json(providerMode==='200'?{id:'synthetic-provider-id'}:{error:'synthetic provider failure'},{status:Number(providerMode)});
  }
  assert.match(url,/^https:\/\/fixture.invalid\/rest\/v1\/rpc\//,'No external provider/network');
  const p=JSON.parse(init.body);
  if(url.endsWith('/bind_receipt_delivery'))return Response.json(await query('select public.bind_receipt_delivery($1,$2,$3) result',[p.p_delivery_id,p.p_lease_token,p.p_request_hash]));
  assert.match(url,/complete_order_delivery$/);
  return Response.json(await query('select public.complete_order_delivery($1,$2,$3,$4,$5,$6) result',[p.p_kind,p.p_delivery_id,p.p_lease_token,p.p_status,p.p_provider_id,p.p_error]));
 };
 try{
  const key=crypto.randomUUID(),saved=await submit(key);await submit(key);
  assert.equal((await db.query('select count(*)::int n from public.order_notification_deliveries')).rows[0].n,2);
  const frozen=(await db.query('select payload from public.order_notification_deliveries order by event')).rows.map(r=>r.payload);
  assert.equal(frozen[0].items.length,1);assert.equal(frozen[0].total_minor,145000);assert.equal(frozen[0].note,payload.note);
  await db.exec("alter table public.order_notification_deliveries add constraint synthetic_outbox_failure check(event<>'order_received_manager') not valid");
  await assert.rejects(submit(crypto.randomUUID()),/synthetic_outbox_failure/);
  assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n,1,'outbox failure rolls back order, reservation and receipt');
  assert.equal((await db.query('select count(*)::int n from private.storefront_intents')).rows[0].n,1);
  for(const table of ['customers','order_items','order_events'])assert.equal((await db.query(`select count(*)::int n from public.${table}`)).rows[0].n,1,table+' rolled back with failed outbox');
  await db.exec('alter table public.order_notification_deliveries drop constraint synthetic_outbox_failure');
  const demoJobs=await claim();assert.equal(demoJobs.length,2);
  for(const job of demoJobs)assert.equal(await processJob(job,'service-test'),'simulated');
  assert.equal(providerCalls.length,0,'configured credentials never send demo mail');
  // Synthetic non-demo queue payload only in disposable DB to exercise provider.
  const second=await submit(crypto.randomUUID());
  await db.query("update public.order_notification_deliveries set payload=jsonb_set(payload,'{is_demo}','false') where order_id=$1",[second.internalOrderId]);
  let jobs=await claim();let manager=jobs.find(j=>j.payload.event==='order_received_manager');
  assert.equal(await processJob(manager,'service-test'),'failed');
  assert.equal((await claim()).length,0,'backoff is respected');
  const owner=crypto.randomUUID();await db.query("insert into auth.users(id,email) values($1,'owner@example.invalid')",[owner]);await db.query("insert into public.staff_members(user_id,role) values($1,'owner')",[owner]);
  const retry=async()=>{await db.exec('set role authenticated');try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.query("select public.staff_retry_order_notification('confirmation',$1,1)",[manager.id]);}finally{await db.exec('reset role');}manager=(await claim()).find(j=>j.id===manager.id);};
  providerMode='timeout';await retry();assert.equal(await processJob(manager,'service-test'),'failed');assert.ok(timeouts.includes(10000));
  providerMode='200';await retry();assert.equal(await processJob(manager,'service-test'),'sent');
  assert.equal(providerCalls.length,3);assert.equal(new Set(providerCalls.map(x=>x.key)).size,1);assert.equal(new Set(providerCalls.map(x=>x.body)).size,1);
  assert.deepEqual(JSON.parse(providerCalls[0].body).to,['manager@example.invalid']);
  assert.equal((await db.query('select attempts,status from public.order_notification_deliveries where id=$1',[manager.id])).rows[0].attempts,3);
  assert.equal((await db.query('select revision from public.orders where id=$1',[second.internalOrderId])).rows[0].revision,1,'mail retry never replays business mutation');
 }finally{globalThis.fetch=beforeFetch;globalThis.Deno=beforeDeno;await db.close();}
});
test('receipt copy is explicitly pending in all languages; provider body conflict fails closed',async()=>{
 const base={order_id:'synthetic',revision:1,reference:'BLG-SYNTHETIC',event:'order_received_customer',customer_name:'<name>',customer_contact:'qa@example.invalid',locale:'en',fulfillment:'pickup',delivery_address:null,scheduled_start:'2099-01-05T02:00:00Z',scheduled_end:'2099-01-05T05:00:00Z',is_demo:false,total_minor:145000,items:[{name:'Frozen cake',detail:'',quantity:1,line_total_minor:145000}]};
 for(const locale of ['ru','en','th']){const c=notificationCopy({...base,locale});assert.ok(c.text.includes('Frozen cake'));assert.ok(c.html.includes('&lt;name&gt;'));assert.match(c.text,locale==='en'?/not a confirmed/:locale==='ru'?/не подтверждённый/:/ยังไม่ใช่/);}
 const beforeFetch=globalThis.fetch,beforeDeno=globalThis.Deno;let provider=0,completion;
 globalThis.Deno={env:{get:n=>({SUPABASE_URL:'https://fixture.invalid',RESEND_API_KEY:'synthetic',ORDER_EMAIL_FROM:'from@example.invalid',ORDER_EMAIL_MANAGER_TO:'manager@example.invalid',NOTIFICATION_SEND_ENABLED:'true'})[n]}};
 globalThis.fetch=async(url,init)=>{if(url.includes('resend')){provider++;throw Error('must not send');}if(url.endsWith('bind_receipt_delivery'))return Response.json(false);completion=JSON.parse(init.body);return Response.json(true);};
 try{assert.equal(await processJob({kind:'confirmation',id:crypto.randomUUID(),lease_token:crypto.randomUUID(),attempt:2,payload:base},'synthetic'),'manual_required');assert.equal(provider,0);assert.equal(completion.p_error,'receipt_payload_conflict');}
 finally{globalThis.fetch=beforeFetch;globalThis.Deno=beforeDeno;}
 assert.doesNotMatch(readFileSync('supabase/functions/storefront-order/index.ts','utf8'),/resend\.com|notifyOrder|RESEND_API_KEY/,'Intake handler cannot synchronously call provider');
});
