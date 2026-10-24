import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderHistory} from '../../utils/orderHistory.mjs';
import {orderCsv,csvCell} from '../../utils/orderCsv.mjs';
import {notificationCopy} from '../../supabase/functions/_shared/notificationCopy.ts';
import {handleRequest as worker,processJob} from '../../supabase/functions/notification-worker/index.ts';
import {handleRequest as confirm} from '../../supabase/functions/confirm-order/index.ts';
import {handleRequest as change} from '../../supabase/functions/order-change/index.ts';
import {readFileSync} from 'node:fs';
import {parse} from '@vue/compiler-sfc';
import ts from 'typescript';
import {ref,computed} from 'vue';
const id='12345678-1234-4234-8234-123456789012';
const origin='https://preview.blagovasweets.com';
const payload={order_id:id,revision:2,reference:'BLG-12345678',event:'order_confirmed',customer_name:'<script>A</script>',customer_contact:'qa@example.invalid',locale:'ru',fulfillment:'delivery',delivery_address:'<b>Address</b>',scheduled_start:'2026-12-01T02:00:00Z',scheduled_end:'2026-12-01T05:00:00Z',is_demo:true,total_minor:163000,items:[{name:'Frozen cake',detail:'Saved vanilla',quantity:1,line_total_minor:145000}]};
const job={kind:'confirmation',id,lease_token:id,attempt:1,payload};
const env={SUPABASE_URL:'https://example.test',SUPABASE_SECRET_KEYS:JSON.stringify({default:'test-server-key'}),NOTIFICATION_SEND_ENABLED:'true',RESEND_API_KEY:'test-mail-key',ORDER_EMAIL_FROM:'demo@example.invalid',ORDER_EMAIL_MANAGER_TO:'manager@example.invalid'};
const install=()=>{globalThis.Deno={env:{get:n=>env[n]},serve:()=>{}};};
const req=(body,method='POST',headers={})=>new Request('https://example.test/function',{method,headers:{origin,apikey:'test-client-key',authorization:'Bearer test-user','Content-Type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
test('CSV exports all supplied rows, quotes text and neutralizes spreadsheet formulas',()=>{
 for(const value of ['=1+1',' +SUM(A1)','\t@cmd','\r\n-1','\u0000=cmd'])assert.ok(csvCell(value).startsWith('"\''));
 assert.equal(csvCell('hello,"world"'),'"hello,""world"""');
 const rows=Array.from({length:130},(_,i)=>({reference:'BLG-'+i,total_minor:163000,delivery_minor:18000,items:'Cake\nvanilla',customer_name:'Private',customer_contact:'private@example.invalid',delivery_address:'Private address'}));
 const text=orderCsv(rows);assert.ok(text.startsWith('\ufeff'));assert.ok(text.includes('"1630.00"'));assert.ok(text.includes('BLG-129'));assert.ok(!text.includes('Private')&&!text.includes('private@example.invalid'));
 assert.ok(orderCsv(rows,true).includes('private@example.invalid'));
});
test('notification rendering uses frozen price/items/time and escapes HTML in RU/EN/TH',()=>{
 for(const locale of ['ru','en','th']){
  const copy=notificationCopy({...payload,locale});assert.ok(copy.text.includes('Frozen cake'));assert.ok(copy.text.includes('Saved vanilla'));assert.ok(copy.text.includes('09:00')&&copy.text.includes('12:00'));assert.ok(copy.html.includes('&lt;script&gt;'));assert.ok(!copy.html.includes('<script>'));
  assert.ok(notificationCopy({...payload,event:'order_rescheduled',locale}).text.includes('Asia/Bangkok'));
  assert.ok(!notificationCopy({...payload,event:'order_cancelled',locale}).text.includes('Frozen cake'));
 }
});
test('worker rejects browser JWTs/invalid scheduler credentials and emits counters only',async()=>{
 install();const before=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,init)=>{calls.push(url);if(url.endsWith('authorize_notification_worker'))return Response.json(false);throw new Error('unexpected claim');};
 try{
  assert.equal((await worker(req({}))).status,401);assert.equal(calls.length,0);
  assert.equal((await worker(req({},'POST',{'x-blagova-worker-token':'x'.repeat(72)}))).status,401);assert.equal(calls.length,1);
  assert.equal((await worker(req({},'OPTIONS'))).status,405);
 }finally{globalThis.fetch=before;delete globalThis.Deno;}
});
test('preview worker never calls mail provider even with configured live credentials',async()=>{
 install();const before=globalThis.fetch;const completions=[];
 globalThis.fetch=async(url,init)=>{assert.ok(!url.includes('resend'));if(url.endsWith('authorize_notification_worker'))return Response.json(true);if(url.endsWith('claim_order_deliveries'))return Response.json([job]);completions.push(JSON.parse(init.body));return Response.json(true);};
 try{
  const response=await worker(req({},'POST',{'x-blagova-worker-token':'x'.repeat(72)}));assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body,{processed:1,results:{simulated:1}});assert.ok(!JSON.stringify(body).includes('qa@example'));assert.equal(completions[0].p_status,'simulated');assert.equal(completions[0].p_provider_id,null);assert.equal(completions[0].p_lease_token,id);
  await processJob({...job,payload:{...payload,customer_contact:'+66 81 234 5678'}},'test-server-key');assert.equal(completions[1].p_status,'manual_required');assert.equal(completions[1].p_error,'customer_email_missing');
 }finally{globalThis.fetch=before;delete globalThis.Deno;}
});
test('live worker has explicit enable gate and classifies provider failures with stable keys',async()=>{
 install();const before=globalThis.fetch;let mailStatus=429;const requests=[],completions=[];
 globalThis.fetch=async(url,init)=>{if(url.includes('resend')){requests.push(init);return Response.json(mailStatus===200?{id:'provider-id'}:{error:'private provider error'}, {status:mailStatus});}completions.push(JSON.parse(init.body));return Response.json(true);};
 try{
  env.NOTIFICATION_SEND_ENABLED='false';await processJob({...job,payload:{...payload,is_demo:false}},'test-server-key');assert.equal(requests.length,0);assert.equal(completions.at(-1).p_error,'live_delivery_disabled');env.NOTIFICATION_SEND_ENABLED='true';
  for(const code of [429,500,400,200]){mailStatus=code;await processJob({...job,payload:{...payload,is_demo:false}},'test-server-key');assert.equal(completions.at(-1).p_status,code===200?'sent':code>=500||code===429?'failed':'manual_required');}
  assert.ok(requests.every(r=>r.headers['Idempotency-Key']===`blagova/confirmation/${id}`));assert.equal(completions.at(-1).p_provider_id,'provider-id');assert.ok(!JSON.stringify(completions).includes('private provider error'));
 }finally{env.NOTIFICATION_SEND_ENABLED='true';globalThis.fetch=before;delete globalThis.Deno;}
});
test('foreground confirmation/change enqueue once and never depend on mail provider',async()=>{
 install();const before=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,init)=>{calls.push({url,body:JSON.parse(init.body),headers:init.headers});assert.ok(!url.includes('resend'));return Response.json({reference:'BLG-QA',notification_status:'pending',event:'order_rescheduled'});};
 try{for(const handler of [confirm,change]){
  assert.equal((await handler(req({},'OPTIONS'))).status,204);assert.equal((await handler(req({},'OPTIONS',{origin:'https://bad.example'}))).status,403);assert.equal((await handler(req({},'GET'))).status,405);
  assert.equal((await handler(req({},'POST',{authorization:''}))).status,401);
 }
 assert.equal((await confirm(req({orderId:id,revision:1}))).status,200);assert.equal(calls.length,1);assert.equal(calls[0].headers.Authorization,'Bearer test-user');
 assert.equal((await change(req({orderId:id,revision:2,action:'cancel'}))).status,200);assert.equal(calls[1].body.p_action,'cancel');
 assert.equal((await change(req({orderId:id,revision:2,action:'reschedule',start:'bad',end:'bad'}))).status,400);
 globalThis.fetch=async()=>Response.json({code:'40001',message:'changed'},{status:400});assert.equal((await confirm(req({orderId:id,revision:1}))).status,409);
 }finally{globalThis.fetch=before;delete globalThis.Deno;}
});
function script(path,context,bindings){const {descriptor}=parse(readFileSync(new URL('../../'+path,import.meta.url),'utf8'));const source=descriptor.scriptSetup.content.replace(/^import .*;\s*$/gm,'');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;const globals={ref,computed,watch:()=>{},...context};return new Function(...Object.keys(globals),js+'\nreturn {'+bindings.join(',')+'};')(...Object.values(globals));}
test('assignment UI uses current revision and refreshes after a conflict',async()=>{
 const events=[],calls=[];const state=script('components/admin/OrderAssignment.vue',{defineProps:()=>({order:{id,revision:4,status:'pending',assigned_to:null},members:[],staffId:'manager',owner:false,busy:false}),defineEmits:()=>((...x)=>events.push(x)),useNuxtApp:()=>({$supabase:{rpc:async(_,args)=>{calls.push(args);return {error:{code:'40001'}};}}})},['assign','error']);
 await state.assign('manager');assert.equal(calls[0].p_revision,4);assert.equal(calls[0].p_assignee,'manager');assert.ok(events.some(([name])=>name==='refresh'));assert.ok(state.error.value.includes('изменился'));
});
test('manual retry targets delivery ID and never calls cancel/reschedule again',async()=>{
 const calls=[],events=[];const state=script('components/admin/OrderNotifications.vue',{defineProps:()=>({order:{id,revision:9,order_notification_deliveries:[],order_change_deliveries:[]},busy:false}),defineEmits:()=>((...x)=>events.push(x)),useNuxtApp:()=>({$supabase:{rpc:async(name,args)=>{calls.push({name,args});return {data:'pending',error:null};}}})},['retry']);
 await state.retry({id:'delivery',kind:'change'});assert.equal(calls[0].name,'staff_retry_order_notification');assert.deepEqual(calls[0].args,{p_kind:'change',p_delivery_id:'delivery',p_revision:9});assert.ok(events.some(([name])=>name==='saved'));
});

test('assignment history preserves the old label instead of current staff directory data',()=>{
 const events=[{id:'a',revision:1,kind:'created',new_status:'pending',created_at:'2026-10-05T00:00:00Z',details:{}},{id:'b',revision:2,kind:'updated',old_status:'pending',new_status:'pending',created_at:'2026-10-05T01:00:00Z',details:{assigned_to:'manager-id',assignee_label:'Historical manager'}},{id:'c',revision:3,kind:'updated',old_status:'pending',new_status:'pending',created_at:'2026-10-05T02:00:00Z',details:{assigned_to:null,assignee_label:null}}];
 const rows=orderHistory(events,[],x=>x,x=>x);assert.deepEqual(rows[1].lines,['Ответственный: Historical manager']);assert.deepEqual(rows[2].lines,['Ответственный снят']);
});
