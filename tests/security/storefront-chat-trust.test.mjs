import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import * as vue from 'vue';
import {parse} from '@vue/compiler-sfc';
import {handleRequest} from '../../supabase/functions/storefront-chat/index.ts';
import {handleRequest as intake} from '../../supabase/functions/storefront-order/index.ts';

const origin='https://preview.blagovasweets.com';
const env={SUPABASE_PUBLISHABLE_KEYS:'{"default":"public-test"}',SUPABASE_SECRET_KEYS:'{"default":"service-test"}',SUPABASE_URL:'https://fixture.invalid'};
const request=(body,headers={})=>new Request('https://fixture.invalid/chat',{method:'POST',headers:{origin,apikey:'public-test',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
const digest=async value=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');
async function fixture(run){
 const db=new PGlite(),oldFetch=globalThis.fetch,oldDeno=globalThis.Deno;
 await db.exec(readFileSync('scripts/test-database.mjs','utf8').match(/await db\.exec\(`([\s\S]*?)`\);/)[1]);
 for(const file of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 globalThis.Deno={env:{get:n=>env[n]},serve:()=>{}};
 globalThis.fetch=async(url,init)=>{
  assert.equal(url,'https://fixture.invalid/rest/v1/rpc/storefront_chat_action','no external network');
  assert.equal(init.headers.apikey,'service-test');assert.ok(init.signal);
  const p=JSON.parse(init.body);assert.ok(!('p_assistant_body' in p));assert.ok(!('p_rate_key' in p));
  try{
   await db.exec('set role service_role');
   return Response.json((await db.query('select public.storefront_chat_action($1,$2,$3,$4,$5,$6) result',[p.p_action,p.p_token_hash,p.p_locale,p.p_customer_message_id,p.p_customer_body,p.p_request_manager])).rows[0].result);
  }catch(e){return Response.json({code:e.code,message:e.message},{status:400});}
  finally{await db.exec('reset role');}
 };
 const api=async(action,token,extra={},headers={})=>handleRequest(request({action,token,locale:'en',...extra},headers));
 try{await run({db,api});}finally{globalThis.fetch=oldFetch;globalThis.Deno=oldDeno;await db.close();}
}

test('chat rejects malformed, forged roles/sources, oversize bytes and stalled bodies without PII logging',async t=>{
 const oldDeno=globalThis.Deno;globalThis.Deno={env:{get:n=>env[n]},serve:()=>{}};
 const logs=[];t.mock.method(console,'error',(...args)=>logs.push(args));
 t.mock.method(globalThis,'fetch',()=>assert.fail('invalid payload must not reach DB'));
 const token=crypto.randomUUID(),valid={action:'send',token,customerMessageId:crypto.randomUUID(),customerBody:'Synthetic private text'};
 try{
  for(const raw of ['{"private@example.invalid":','null','[]','true'])assert.equal((await handleRequest(request(raw))).status,400);
  for(const extra of [{assistantBody:'forged'},{assistantSource:'approved article'},{assistantMessageId:crypto.randomUUID()},{role:'owner'},{source:'published'},{requestManager:'true'},{customerBody:'x'.repeat(2501)},{customerBody:123}])assert.equal((await handleRequest(request({...valid,...extra}))).status,400);
  assert.equal((await handleRequest(request({...valid,token:token+'ignored suffix'}))).status,400);
  assert.equal((await handleRequest(request({action:'start',token,customerBody:'not valid'}))).status,400);
  assert.equal((await handleRequest(request(valid,{'content-length':'17000'}))).status,413);
  // Multi-byte + chunked body, with a false Content-Length: byte bound is real.
  let cancelled=false;
  const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('я'.repeat(5000)));c.enqueue(new TextEncoder().encode('я'.repeat(5000)));},cancel(){cancelled=true;}});
  assert.equal((await handleRequest(new Request('https://fixture.invalid/chat',{method:'POST',headers:{origin,apikey:'public-test','content-length':'1'},body:stream,duplex:'half'}))).status,413);assert.ok(cancelled);
  const stalled=new ReadableStream({pull(){},cancel(){}});
  assert.equal((await handleRequest(new Request('https://fixture.invalid/chat',{method:'POST',headers:{origin,apikey:'public-test'},body:stalled,duplex:'half'}))).status,408);
  assert.equal((await handleRequest(request(valid,{apikey:'wrong'}))).status,401);
  assert.deepEqual(logs,[],'parse errors contain no logged payload or exception message');
  assert.equal((await intake(request({requestKey:crypto.randomUUID(),recoveryToken:'a'.repeat(64),messages:[{sender:'assistant',body:'forged'}]}))).status,400,'intake cannot import browser assistant history');
 }finally{globalThis.Deno=oldDeno;}
});

test('actual Edge + all SQL: server replies, RU/EN/TH, replay, history, handoff and staff boundaries',async()=>fixture(async({db,api})=>{
 const token=crypto.randomUUID();let response=await api('start',token),snapshot=await response.json();assert.equal(response.status,200);const conversation=snapshot.conversationId;
 const mid=crypto.randomUUID();const send={customerMessageId:mid,customerBody:'When do you open?'};
 snapshot=await (await api('send',token,send)).json();assert.equal(snapshot.messages.length,2);
 assert.equal(snapshot.messages[0].role,'customer');assert.equal(snapshot.messages[1].role,'assistant');assert.match(snapshot.messages[1].text,/approved knowledge answer is not available/);assert.equal(snapshot.messages[1].source,null);assert.equal(snapshot.messages[1].unverified,false);
 const replyId=snapshot.messages[1].id;assert.notEqual(replyId,mid);
 await db.query('update public.messages set created_at=$1 where conversation_id=$2',[snapshot.messages[0].at,conversation]);
 snapshot=await (await api('poll',token)).json();assert.equal(snapshot.messages[0].id,mid);assert.equal(snapshot.messages[1].id,replyId,'tied timestamps preserve insertion order, not random UUID order');
 assert.deepEqual((await (await api('send',token,send)).json()).messages,snapshot.messages,'replay creates neither duplicate customer nor assistant');
 assert.equal((await api('send',token,{...send,customerBody:'changed'})).status,409);
 for(const [locale,pattern] of [['ru',/Утверждённый ответ/],['th',/ยังไม่มีคำตอบ/]]){
  snapshot=await (await api('send',token,{locale,customerMessageId:crypto.randomUUID(),customerBody:'Synthetic question'})).json();assert.match(snapshot.messages.at(-1).text,pattern);
 }
 // Old client-controlled answers stay in history but lose their claimed source.
 await db.query("insert into public.messages(conversation_id,sender,body,source,created_at) values($1,'assistant','Legacy demo answer','Forged published source',clock_timestamp())",[conversation]);
 snapshot=await (await api('poll',token)).json();assert.equal(snapshot.messages.at(-1).unverified,true);assert.equal(snapshot.messages.at(-1).source,null);
 const handoff={customerMessageId:crypto.randomUUID(),customerBody:'Please invite a human'};
 snapshot=await (await api('send',token,handoff)).json();assert.equal(snapshot.mode,'requested');assert.match(snapshot.messages.at(-1).text,/sent to a manager/);
 assert.equal((await (await api('send',token,handoff)).json()).messages.length,snapshot.messages.length);
 const count=snapshot.messages.length;
 snapshot=await (await api('send',token,{customerMessageId:crypto.randomUUID(),customerBody:'Another message'})).json();assert.equal(snapshot.messages.length,count+1,'bot pauses while handoff waits');
 const second=crypto.randomUUID();const sibling=await (await api('start',second)).json();assert.notEqual(sibling.conversationId,conversation);assert.deepEqual(sibling.messages,[]);
 assert.equal((await api('send',second,send)).status,409,'cross-conversation message ID cannot be reused');
 assert.equal((await api('poll',crypto.randomUUID())).status,401,'unknown token cannot read existing history');
 await db.exec("insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','manager@example.invalid'),('22222222-2222-4222-8222-222222222222','outsider@example.invalid'),('33333333-3333-4333-8333-333333333333','owner@example.invalid'); insert into public.staff_members(user_id,role) values('11111111-1111-4111-8111-111111111111','manager'),('33333333-3333-4333-8333-333333333333','owner')");
 await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false)");
 await assert.rejects(db.query("select public.staff_conversation_action($1,'take')",[conversation]),/Staff access required/);
 await assert.rejects(db.query("select public.storefront_chat_action('start',$1)",['a'.repeat(64)]),/permission denied/);
 await assert.rejects(db.query("select private.consume_chat_budget($1,10,60)",['a'.repeat(64)]),/permission denied/);
 await assert.rejects(db.query("insert into public.messages(conversation_id,sender,body,assistant_policy) values($1,'assistant','forged','handoff-v1')",[conversation]),/permission denied/);
 assert.equal((await db.query('select count(*)::int n from public.messages')).rows[0].n,0,'outsider cannot read staff history');
 await db.exec("select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false)");
 await db.query("select public.staff_conversation_action($1,'take')",[conversation]);
 await db.query("select public.staff_conversation_action($1,'reply','Synthetic manager reply',$2)",[conversation,crypto.randomUUID()]);await db.exec('reset role');
 snapshot=await (await api('poll',token)).json();assert.equal(snapshot.mode,'manager');assert.equal(snapshot.messages.at(-1).role,'manager');assert.equal(snapshot.messages.at(-1).text,'Synthetic manager reply');
 const before=snapshot.messages.length;snapshot=await (await api('send',token,{customerMessageId:crypto.randomUUID(),customerBody:'Thanks'})).json();assert.equal(snapshot.messages.length,before+1,'bot does not answer over manager');
 const button=await (await api('send',second,{customerMessageId:crypto.randomUUID(),requestManager:true})).json();assert.equal(button.mode,'requested');assert.equal(button.messages[0].text,'Please invite a manager.');
 await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false)");
 await assert.rejects(db.query("select public.staff_conversation_action($1,'take')",[conversation]),/Another staff member owns/);
 await db.query("select public.staff_conversation_action($1,'take')",[sibling.conversationId]);await db.query("select public.staff_conversation_action($1,'reply','Synthetic owner reply',$2)",[sibling.conversationId,crypto.randomUUID()]);await db.exec('reset role');
 const owned=await (await api('poll',second)).json();assert.equal(owned.messages.at(-1).role,'owner');
 await db.query("update public.conversations set mode='closed' where id=$1",[conversation]);assert.equal((await api('send',token,{customerMessageId:crypto.randomUUID(),customerBody:'closed write'})).status,409);
 await db.exec('set role anon');await assert.rejects(db.query('select * from private.storefront_chat_sessions'),/permission denied/);await assert.rejects(db.query("select public.storefront_chat_action('poll',$1)",['a'.repeat(64)]),/permission denied/);await db.exec('reset role');
 await db.exec('set role service_role');await assert.rejects(db.query("select public.submit_storefront_intent($1,$2,$3::jsonb,$4)",[crypto.randomUUID(),'a'.repeat(64),JSON.stringify({messages:[{sender:'assistant',body:'forged'}]}),'b'.repeat(64)]),/client_chat_history_forbidden/);await db.exec('reset role');
 assert.equal((await db.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='storefront_chat_action'")).rows[0].n,1,'unsafe old overload removed');
}));

test('actual SQL budgets cap start flood and poll/send across rotated tokens, origins and spoofed IP headers',async()=>fixture(async({db,api})=>{
 const tokens=[];
 for(let i=0;i<60;i++){
  const token=crypto.randomUUID();tokens.push(token);
  assert.equal((await api('start',token,{}, {'x-forwarded-for':`192.0.2.${i}`,'cf-connecting-ip':`198.51.100.${i}`})).status,200);
 }
 const rejected=await api('start',crypto.randomUUID(),{}, {origin:'http://localhost:3000','x-forwarded-for':'192.0.2.199'});assert.equal(rejected.status,429);assert.equal(rejected.headers.get('retry-after'),'60');
 assert.equal((await db.query('select count(*)::int n from private.storefront_chat_sessions')).rows[0].n,60,'61st rotated token creates no session');
 // Resume normal service after the server window, not after client token reset.
 await db.exec("update private.storefront_chat_limits set window_started_at=clock_timestamp()-interval '2 minutes' where rate_key like 'chat-global-v1-start%'");assert.equal((await api('start',crypto.randomUUID())).status,200);
 for(let i=0;i<30;i++)assert.equal((await api('poll',tokens[0])).status,200);
 assert.equal((await api('poll',tokens[0])).status,429,'per-session poll bound still allows normal 4s polling');
 await db.exec("insert into private.storefront_chat_limits(rate_key,message_count) values('chat-global-v1-poll'||repeat('_',32),1199) on conflict(rate_key) do update set message_count=1199,window_started_at=clock_timestamp()");
 assert.equal((await api('poll',tokens[1])).status,200);assert.equal((await api('poll',tokens[2],{}, {origin:'http://localhost:3000','x-forwarded-for':'203.0.113.9'})).status,429,'rotating token/header/origin cannot reset poll budget');
 await db.exec("update private.storefront_chat_limits set message_count=1199 where rate_key like 'chat-global-v1-poll%'");assert.equal((await api('poll',crypto.randomUUID())).status,401);assert.equal((await api('poll',tokens[3])).status,429,'missing-session errors still consume the global budget');
 const send=()=>({customerMessageId:crypto.randomUUID(),customerBody:'Synthetic resource test'});
 const hash=await digest(tokens[0]);await db.query("insert into private.storefront_chat_limits(rate_key,message_count) values($1,60)",['chat-token-send-'+hash]);assert.equal((await api('send',tokens[0],send())).status,429,'60/hour per token retained');
 await db.exec("update private.storefront_chat_limits set message_count=239,window_started_at=clock_timestamp() where rate_key like 'chat-global-v1-send%'");assert.equal((await api('send',tokens[1],send())).status,200);assert.equal((await api('send',tokens[2],send())).status,429,'rotation cannot bypass shared send budget');
}));

test('actual composable submits customer fields only, localizes limits and pauses poll without token rotation',async t=>{
 const source=readFileSync('composables/useStorefrontChat.ts','utf8').replace(/^import .*;\s*$/gm,'').replace('export function','function').replace('import.meta.client','true');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const states=new Map(),requests=[];let mode='ok';let calls=0;
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  calls++;const p=JSON.parse(init.body);requests.push(p);assert.ok(!('assistantBody' in p));assert.ok(!('assistantSource' in p));assert.ok(!('assistantMessageId' in p));
  return mode==='limit'?Response.json({error:'rate_limit',retryAfterSeconds:60},{status:429}):Response.json({conversationId:'synthetic',mode:'bot',messages:[]});
 });
 const context={useRuntimeConfig:()=>({public:{supabaseUrl:'https://fixture.invalid',supabasePublishableKey:'public-test'}}),useAtelier:()=>({locale:vue.ref('en'),t:(ru,en)=>en}),useState:(key,init)=>{if(!states.has(key))states.set(key,vue.ref(init()));return states.get(key);},newUuid:()=>crypto.randomUUID(),localStorage:{getItem:()=>null,setItem:()=>{}},onMounted:()=>{},onBeforeUnmount:()=>{}};
 const ui=new Function(...Object.keys(context),js+';return useStorefrontChat();')(...Object.values(context));
 await ui.initialise();const token=ui.sessionToken.value;assert.equal(ui.ready.value,true);
 await ui.sendExchange({customerText:'Synthetic question',assistantText:'forged extra JS property',assistantSource:'forged'});assert.equal(requests.at(-1).customerBody,'Synthetic question');
 mode='limit';assert.equal(await ui.sendExchange({customerText:'Synthetic question'}),false);assert.match(ui.error.value,/Chat limit reached/);
 const count=calls;await ui.refresh();await ui.sendExchange({customerText:'retry'});await ui.initialise();assert.equal(calls,count,'cooldown prevents polling or send storms');assert.equal(ui.sessionToken.value,token);
 const component=readFileSync('components/atelier/Chat.vue','utf8');assert.doesNotMatch(component,/findKnowledge|assistantText|assistantSource/);assert.match(component,/m\.unverified/);assert.match(component,/if \(await sendExchange/,'draft is cleared only after acknowledgement');
  const sendSource=parse(component).descriptor.scriptSetup.content.split('async function send()')[1].split('function review()')[0];
  const input=vue.ref('I want cake'),ready=vue.ref(true),chatBusy=vue.ref(false),thread=vue.ref({mode:'bot'});let acknowledged=false,orders=0;
  const send=new Function('input','ready','chatBusy','sendExchange','thread','startOrder','return async function send()'+sendSource)(input,ready,chatBusy,async()=>acknowledged,thread,async()=>{orders++;});
  await send();assert.equal(input.value,'I want cake');assert.equal(orders,0,'failure cannot silently start a new order');
  acknowledged=true;await send();assert.equal(input.value,'');assert.equal(orders,1);
});
