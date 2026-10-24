import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {parse} from '@vue/compiler-sfc';
import * as vue from 'vue';
import {PGlite} from '@electric-sql/pglite';
import {handleRequest} from '../../supabase/functions/storefront-order/index.ts';
import {validOrderContact} from '../../supabase/functions/_shared/orderContact.ts';
import {loadPendingIntent,createPendingIntent,clearPendingIntent,expirePendingIntent,intentFingerprint,pendingIntentStorageKey,chatPendingIntentStorageKey} from '../../utils/pendingIntent.mjs';

function script(path,context,bindings){
 let source=path.endsWith('.vue')?parse(readFileSync(path,'utf8')).descriptor.scriptSetup.content:readFileSync(path,'utf8');
 source=source.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
 return new Function(...Object.keys(context),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nreturn {'+bindings.join(',')+'};')(...Object.values(context));
}
function storage(){const data=new Map();return {data,getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
const utilities={loadPendingIntent,createPendingIntent,clearPendingIntent,expirePendingIntent,intentFingerprint,chatPendingIntentStorageKey,validOrderContact};
const origin='https://preview.blagovasweets.com';
async function fixture(run){
 const db=new PGlite();await db.exec(readFileSync('scripts/test-database.mjs','utf8').match(/await db\.exec\(`([\s\S]*?)`\);/)[1]);
 for(const file of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 const oldFetch=globalThis.fetch,oldDeno=globalThis.Deno;
 globalThis.Deno={env:{get:n=>({SUPABASE_PUBLISHABLE_KEYS:'{"default":"public-test"}',SUPABASE_SECRET_KEYS:'{"default":"service-test"}',SUPABASE_URL:'https://fixture.invalid'})[n]},serve:()=>{}};
 const state={drop:'',submits:[],lookups:0};
 globalThis.fetch=async(url,init)=>{
  assert.match(url,/^https:\/\/fixture.invalid\//,'no external calls');const p=JSON.parse(init.body);
  if(url.endsWith('/functions/v1/storefront-order')){
   const submit=!['resolve','close'].includes(p.action);if(submit)state.submits.push(p);else state.lookups++;
   const drop=submit?state.drop:'';if(submit)state.drop='';
   if(drop==='before')throw Error('Synthetic connection lost before send');
   const response=await handleRequest(new Request(url,{...init,headers:{...init.headers,origin}}));
   if(drop==='after'&&response.ok)throw Error('Synthetic timeout after commit');return response;
  }
  let sql,args;
  if(url.endsWith('/submit_storefront_intent')){sql='select public.submit_storefront_intent($1,$2,$3::jsonb,$4) result';args=[p.p_request_key,p.p_token_hash,JSON.stringify(p.p_payload),p.p_rate_key];}
  else if(url.endsWith('/resolve_storefront_intent')){sql='select public.resolve_storefront_intent($1,$2,$3,$4) result';args=[p.p_request_key,p.p_token_hash,p.p_close,p.p_rate_key];}
  else throw Error('Unexpected RPC');
  try{await db.exec('set role service_role');return Response.json((await db.query(sql,args)).rows[0].result);}
  catch(e){return Response.json({message:e.message,code:e.code},{status:400});}finally{await db.exec('reset role');}
 };
 const api=script('composables/usePublicIntake.ts',{validOrderContact,useRuntimeConfig:()=>({public:{supabaseUrl:'https://fixture.invalid',supabasePublishableKey:'public-test'}})},['usePublicIntake']).usePublicIntake();
 const store=storage();
 function chat(){
  const mounted=[];
  const ctx={...utilities,sessionStorage:store,ref:vue.ref,computed:vue.computed,nextTick:vue.nextTick,watch:()=>()=>{},onMounted:f=>mounted.push(f),onBeforeUnmount:()=>{},bangkokDate:()=> '2099-01-01',
   useCatalog:()=>({products:vue.ref([{id:'berry',name:{en:'Cake'},price:1450,leadDays:1,variants:[{sku:'berry-cloud-1kg'}]}]),load:async()=>{},error:vue.ref('')}),
   useAtelier:()=>({t:(r,e)=>e,local:x=>x.en,money:x=>x,locale:vue.ref('en')}),
   useStorefrontChat:()=>({chatOpen:vue.ref(true),thread:vue.ref({mode:'bot',messages:[]}),ready:vue.ref(true),storageWarning:vue.ref(false),busy:vue.ref(false),error:vue.ref(''),sessionToken:vue.ref(''),initialise:async()=>{},sendExchange:async()=>true}),
   usePublicIntake:()=>api,useAvailability:()=>({getAvailability:async()=>[]}),useRoute:()=>({path:'/'})};
  const ui=script('components/atelier/Chat.vue',ctx,['startOrder','confirm','editOrder','recoverOrder','orderStep','date','customer','contact','accepted','error','lastOrder','requestKey','pendingOrder','savedOrder','savedOrderDate','savedOrderSlot']);
  return {...ui,mount:async()=>{for(const fn of mounted)await fn();}};
 }
 try{await run({db,state,api,store,chat});}finally{globalThis.fetch=oldFetch;globalThis.Deno=oldDeno;await db.close();}
}

test('all actual chat callers resolve committed receipt before edited retry, Edit or reload; no browser PII persisted',async()=>fixture(async({db,state,store,chat})=>{
 for(const [index,action] of ['confirm','edit','reload'].entries()){
  let ui=chat();await ui.mount();await ui.startOrder();ui.orderStep.value=2;const day=`2099-01-${String(5+index*2).padStart(2,'0')}`;ui.date.value=day;ui.customer.value='Synthetic private name';ui.contact.value='private@example.invalid';ui.accepted.value=true;
  state.drop='after';await ui.confirm();const intent={...ui.pendingOrder.value};assert.ok(intent?.token);assert.equal(ui.lastOrder.value,'');
  assert.doesNotMatch(store.getItem(chatPendingIntentStorageKey),/Synthetic|private@example|berry-cloud|2099-01/,'only capability/fingerprints/times persisted');
  ui.date.value='2099-02-05';
  if(action==='confirm')await ui.confirm();else if(action==='edit')await ui.editOrder();else{ui=chat();await ui.mount();}
  assert.match(ui.lastOrder.value,/^BLG-/);assert.equal(ui.savedOrderDate.value,day);assert.equal(ui.savedOrderSlot.value,'09:00–12:00');assert.equal(ui.savedOrder.value.totalMinor,145000);assert.equal(ui.savedOrder.value.items[0].quantity,1);assert.equal(ui.orderStep.value,0);assert.equal(ui.pendingOrder.value,null);assert.equal(store.getItem(chatPendingIntentStorageKey),null);
  assert.equal(state.submits.length,index+1,'resolution never submits edited date with old key');assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n,index+1);
 }
}));

test('unknown chat attempt blocks editing/new order until atomic close; late old submit is fenced',async()=>fixture(async({db,state,api,store,chat})=>{
 const ui=chat();await ui.mount();await ui.startOrder();ui.orderStep.value=2;ui.date.value='2099-01-05';ui.customer.value='Synthetic';ui.contact.value='qa@example.invalid';ui.accepted.value=true;
 state.drop='before';await ui.confirm();const old=state.submits[0];assert.ok(ui.pendingOrder.value);
 ui.date.value='2099-01-06';await ui.editOrder();await ui.startOrder();assert.equal(ui.orderStep.value,2);assert.match(ui.error.value,/still unknown/);assert.equal(state.submits.length,1);
 await ui.recoverOrder(true);assert.equal(ui.pendingOrder.value,null);assert.equal(ui.orderStep.value,1);assert.equal(store.getItem(chatPendingIntentStorageKey),null);
 const late=await handleRequest(new Request('https://fixture.invalid/functions/v1/storefront-order',{method:'POST',headers:{origin,apikey:'public-test'},body:JSON.stringify(old)}));assert.equal(late.status,409);
 ui.orderStep.value=2;await ui.confirm();assert.notEqual(state.submits[1].requestKey,old.requestKey);assert.equal(ui.savedOrderDate.value,'2099-01-06');assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n,1);
 const before=state.submits.length;await assert.rejects(api.submitOrder({...old,recoveryToken:undefined,date:'2099-01-10',slot:'09:00–12:00'}),/invalid_intent/);assert.equal(state.submits.length,before,'intake no longer fabricates hidden memory tokens');
}));

test('mounted checkout and chat scrub expired capability before every resolve/close/retry; storage write failure still scrubs memory',async()=>{
 const oldNow=Date.now;
 for(const caller of ['checkout','chat']){
  const store=storage(),key=caller==='chat'?chatPendingIntentStorageKey:pendingIntentStorageKey;
  const p=await createPendingIntent(store,{synthetic:true},[],key);let lookups=0;const mounted=[];
  const ctx={...utilities,sessionStorage:store,ref:vue.ref,computed:vue.computed,nextTick:vue.nextTick,watch:()=>()=>{},onMounted:f=>mounted.push(f),onBeforeUnmount:()=>{},bangkokDate:()=> '2099-01-01',
   useCatalog:()=>({products:vue.ref([]),load:async()=>{},error:vue.ref('')}),useAtelier:()=>({t:(r,e)=>e,local:x=>x,money:x=>x,locale:vue.ref('en'),basket:vue.ref([]),total:vue.ref(0),leadDays:vue.ref(1),hydrated:vue.ref(true)}),
   useStorefrontChat:()=>({chatOpen:vue.ref(true),thread:vue.ref({mode:'bot',messages:[]}),ready:vue.ref(true),storageWarning:vue.ref(false),busy:vue.ref(false),error:vue.ref(''),sessionToken:vue.ref(''),initialise:async()=>{},sendExchange:async()=>true}),
   usePublicIntake:()=>({resolveIntent:async()=>{lookups++;throw Error('Synthetic unavailable');},submitOrder:async()=>assert.fail('expired must never submit')}),useAvailability:()=>({getAvailability:async()=>[]}),useRoute:()=>({path:'/'})};
  const ui=script(caller==='chat'?'components/atelier/Chat.vue':'pages/checkout.vue',ctx,caller==='chat'?['pendingOrder','recoverOrder','confirm','editOrder','error']:['pending','recover','submit','error']);
  for(const fn of mounted)await fn();assert.equal(lookups,1);
  Date.now=()=>p.expiresAt+1;
  try{
   if(caller==='chat'){await ui.recoverOrder();await ui.recoverOrder(true);await ui.confirm();await ui.editOrder();}else{await ui.recover();await ui.recover(true);await ui.submit();}
   const pending=(ui.pending||ui.pendingOrder).value;assert.equal(pending.expired,true);assert.equal(pending.token,undefined);assert.equal(lookups,1);assert.doesNotMatch(store.getItem(key),new RegExp(p.token));assert.match(ui.error.value,/expired/);
  }finally{Date.now=oldNow;}
 }
 const store=storage(),p=await createPendingIntent(store,{x:1},[]),token=p.token;store.setItem=()=>{throw Error('storage denied');};
 assert.throws(()=>expirePendingIntent(store,p,p.expiresAt+1),/storage denied/);assert.equal(p.token,undefined);assert.equal(p.expired,true);assert.notEqual(p.token,token);
});
