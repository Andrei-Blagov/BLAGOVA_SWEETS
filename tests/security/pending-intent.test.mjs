import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {parse} from '@vue/compiler-sfc';
import * as vue from 'vue';
import {handleRequest} from '../../supabase/functions/storefront-order/index.ts';
import {validOrderContact} from '../../supabase/functions/_shared/orderContact.ts';
import {loadPendingIntent,createPendingIntent,clearPendingIntent,intentFingerprint,pendingIntentStorageKey} from '../../utils/pendingIntent.mjs';

const origin='https://preview.blagovasweets.com',token='a'.repeat(64);
const payload={source:'website',locale:'ru',customerName:'Synthetic Name',customerContact:'qa@example.invalid',fulfillment:'pickup',deliveryAddress:'',deliveryZone:'pickup',scheduledStart:'2099-01-05T02:00:00.000Z',scheduledEnd:'2099-01-05T05:00:00.000Z',note:'private synthetic note',items:[{sku:'berry-cloud-1kg',quantity:1,configuration:{},personalization:'private synthetic inscription',description:''}],messages:[]};
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};}
function script(path,context,bindings){
 let source=path.endsWith('.vue')?parse(readFileSync(path,'utf8')).descriptor.scriptSetup.content:readFileSync(path,'utf8');
 source=source.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function(...Object.keys(context),js+'\nreturn {'+bindings.join(',')+'};')(...Object.values(context));
}
async function database(){
 const db=new PGlite();
 // Reuse the checked-in disposable harness scaffold, never hosted Auth/Storage.
 const harness=readFileSync('scripts/test-database.mjs','utf8');
 const scaffold=harness.match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
 await db.exec(scaffold);
 for(const file of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 return db;
}
test('actual Edge + SQL enforce receipt capability, immutable payload and atomic close fence',async()=>{
 const db=await database();const oldFetch=globalThis.fetch,oldDeno=globalThis.Deno;
 globalThis.Deno={env:{get:n=>({SUPABASE_PUBLISHABLE_KEYS:'{"default":"public-test"}',SUPABASE_SECRET_KEYS:'{"default":"service-test"}',SUPABASE_URL:'https://fixture.invalid'})[n]},serve:()=>{}};
 globalThis.fetch=async(url,init)=>{
  assert.match(url,/^https:\/\/fixture.invalid\/rest\/v1\/rpc\//,'no external calls');
  const p=JSON.parse(init.body);let sql,args;
  if(url.endsWith('/submit_storefront_intent')){sql='select public.submit_storefront_intent($1,$2,$3::jsonb,$4) result';args=[p.p_request_key,p.p_token_hash,JSON.stringify(p.p_payload),p.p_rate_key];}
  else if(url.endsWith('/resolve_storefront_intent')){sql='select public.resolve_storefront_intent($1,$2,$3,$4) result';args=[p.p_request_key,p.p_token_hash,p.p_close,p.p_rate_key];}
  else throw Error('unexpected RPC');
  try{await db.exec('set role service_role');return Response.json((await db.query(sql,args)).rows[0].result);}
  catch(e){return Response.json({message:e.message,code:e.code},{status:400});}
  finally{await db.exec('reset role');}
 };
 const api=body=>handleRequest(new Request('https://fixture.invalid/intake',{method:'POST',headers:{origin,apikey:'public-test'},body:JSON.stringify(body)}));
 try{
  const key=crypto.randomUUID(),body={...payload,requestKey:key,recoveryToken:token};
  const first=await api(body);assert.equal(first.status,200);const saved=await first.json();
  assert.equal(new Date(saved.summary.scheduledStart).toISOString(),'2099-01-05T02:00:00.000Z');
  assert.equal(saved.summary.totalMinor,145000);assert.equal(saved.summary.items[0].quantity,1);
  assert.doesNotMatch(JSON.stringify(saved.summary),/Synthetic Name|qa@example|private synthetic/);
  assert.equal((await api(body)).status,200);
  await db.exec("set timezone='Pacific/Honolulu'");
  assert.equal((await api(body)).status,200,'canonical fingerprint is independent of session timezone');
  assert.equal((await api({...body,scheduledStart:'2099-01-06T02:00:00Z',scheduledEnd:'2099-01-06T05:00:00Z'})).status,409);
  assert.equal((await api({...body,items:[{...body.items[0],quantity:2}]})).status,409);
  assert.equal((await api({action:'resolve',requestKey:key,recoveryToken:'b'.repeat(64)})).status,404);
  assert.equal((await api({action:'resolve',requestKey:key})).status,400);
  assert.equal((await api({action:'resolve',requestKey:key,recoveryToken:token+'extra'})).status,400,'capability must match exactly, not a truncated prefix');
  const closeSaved=await (await api({action:'close',requestKey:key,recoveryToken:token})).json();assert.equal(closeSaved.state,'saved');
  const lateKey=crypto.randomUUID();assert.equal((await (await api({action:'resolve',requestKey:lateKey,recoveryToken:token})).json()).state,'unknown');
  assert.equal((await (await api({action:'close',requestKey:lateKey,recoveryToken:token})).json()).state,'closed');
  assert.equal((await api({...body,requestKey:lateKey})).status,409);
  assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n,1);
  await db.query("update private.storefront_intents set expires_at=clock_timestamp()-interval '1 second' where request_key=$1",[key]);
  assert.equal((await api({action:'resolve',requestKey:key,recoveryToken:token})).status,404,'expired capability cannot read receipt');
  await db.exec('set role anon');await assert.rejects(db.query('select * from private.storefront_intents'),/permission denied/);await db.exec('reset role');
  await db.exec('set role authenticated');await assert.rejects(db.query('select public.resolve_storefront_intent($1,$2,false,$3)',[key,'a'.repeat(64),'b'.repeat(64)]),/permission denied/);await db.exec('reset role');
 }finally{globalThis.fetch=oldFetch;globalThis.Deno=oldDeno;await db.close();}
});
test('actual checkout script resolves timeout-after-commit after edits and reload without resubmission',async()=>{
 const store=storage();let saved,submits=0,drop=true;
 const basket=vue.ref([{sku:'berry-cloud-1kg',quantity:1,personalization:'private inscription',productId:'berry',configuration:{},detail:'',price:1450}]);
 const hydrated=vue.ref(true);
 const api={submitOrder:async input=>{submits++;saved={reference:'BLG-SYNTHETIC',scheduledStart:'2099-01-05T02:00:00Z',scheduledEnd:'2099-01-05T05:00:00Z',totalMinor:145000,items:[{sku:input.items[0].sku,name:'Cake',quantity:1,lineTotalMinor:145000}]};if(drop){drop=false;throw Error('response lost after commit');}return saved;},resolveIntent:async()=>({state:'saved',summary:saved})};
 let mounted;
 const context={ref:vue.ref,computed:vue.computed,watch:(source,callback)=>source===hydrated?vue.watch(source,callback):()=>{},onMounted:f=>{mounted=f;},sessionStorage:store,validOrderContact,
  loadPendingIntent,createPendingIntent,clearPendingIntent,intentFingerprint,
  useAtelier:()=>({t:r=>r,local:x=>x,money:x=>x,basket,total:vue.ref(1450),leadDays:vue.ref(1),hydrated,locale:vue.ref('ru')}),
  usePublicIntake:()=>api,useAvailability:()=>({getAvailability:async()=>[]})};
 const make=()=>script('pages/checkout.vue',context,['submit','pending','date','slot','slots','name','contact','accepted','finished','finalDate','finalSlot','keptCart','recoveryBusy']);
 const ui=make();await mounted();ui.date.value='2099-01-05';ui.name.value='Private Name';ui.contact.value='private@example.invalid';ui.accepted.value=true;ui.slots.value=[{label:ui.slot.value,available:true}];
 await ui.submit();assert.equal(ui.finished.value,false);assert.ok(ui.pending.value);
 const persisted=store.getItem(pendingIntentStorageKey);assert.doesNotMatch(persisted,/Private Name|private@example|inscription|berry-cloud/);
 ui.date.value='2099-01-06';basket.value[0].quantity=2;
 await ui.submit();assert.equal(submits,1);assert.equal(ui.finalDate.value,'2099-01-05');assert.equal(ui.finalSlot.value,'09:00–12:00');assert.equal(ui.keptCart.value,true);assert.equal(basket.value[0].quantity,2);assert.equal(store.getItem(pendingIntentStorageKey),null);
 // Restore a persisted unresolved identity: mounting must resolve, never submit.
 await createPendingIntent(store,{synthetic:true},[]);hydrated.value=false;const reloaded=make();const mounting=mounted();await vue.nextTick();assert.equal(reloaded.finished.value,false);hydrated.value=true;await mounting;assert.equal(reloaded.finished.value,true);assert.equal(reloaded.finalDate.value,'2099-01-05');assert.equal(submits,1);
});
test('expired browser intent clears capability but blocks silent new intent; storage failure sends nothing',async()=>{
 const store=storage();const p=await createPendingIntent(store,{x:1},[]);
 const expired=loadPendingIntent(store,p.expiresAt+1);assert.equal(expired.expired,true);assert.equal(expired.token,undefined);
 assert.doesNotMatch(store.getItem(pendingIntentStorageKey),new RegExp(p.token));
 await assert.rejects(createPendingIntent(store,{x:2},[]),/intent_pending/);
 await assert.rejects(createPendingIntent({getItem:()=>null,setItem:()=>{throw Error('storage disabled');}},{},[]),/storage disabled/);
});
