import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { parse, compileTemplate } from '@vue/compiler-sfc';
import * as vue from 'vue';
import { renderToString } from '@vue/server-renderer';

// Exercise the actual Vue scripts and calendar template with isolated APIs.
// Watchers and mounted hooks stay idle: each test drives one user action.
function script(path, context, bindings) {
  const { descriptor } = parse(readFileSync(new URL('../../'+path,import.meta.url),'utf8'));
  const source = descriptor.scriptSetup.content.replace(/^import .*;\s*$/gm,'');
  const js = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const globals = {ref:vue.ref,reactive:vue.reactive,computed:vue.computed,nextTick:vue.nextTick,watch:()=>{},onMounted:()=>{},onBeforeUnmount:()=>{},...context};
  return new Function(...Object.keys(globals),js+'\nreturn {'+bindings.join(',')+'};')(...Object.values(globals));
}

test('calendar renders 32/32 as full even when a zero-load availability check succeeds',async()=>{
  const path='components/admin/ProductionWorkspace.vue';
  const state=script(path,{defineProps:()=>({owner:false,date:'2026-10-10'})},['slots','loading','slotStatus','slotHasRoom','percentage','names','week','rules','version','error','notice','busy','load','save','revealInvalidField']);
  state.loading.value=false;
  const slot={label:'09:00–12:00',used:32,capacity:32,available:true,category_used:{cake:4},category_limits:{cake:4},unknown_orders:0};
  state.slots.value=[slot];
  const {descriptor}=parse(readFileSync(new URL('../../'+path,import.meta.url),'utf8'));
  const compiled=compileTemplate({source:descriptor.template.content,filename:path,id:'acceptance'});
  assert.deepEqual(compiled.errors,[]);
  const js=ts.transpileModule(compiled.code,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={};new Function('require','exports',js)(()=>vue,exports);
  const html=await renderToString(vue.createSSRApp({setup:()=>({...state,owner:false}),render:exports.render}));
  assert.match(html,/Заполнен/);assert.match(html,/production-slot-blocked/);
  assert.match(html,/Новые бронирования недоступны/);assert.doesNotMatch(html,/Есть место|Свободно 0/);
  assert.equal(state.slotStatus({...slot,used:24}),'Есть место');
  assert.equal(state.slotStatus({...slot,used:0}),'Свободен');
  assert.equal(state.slotStatus({...slot,used:0,available:false}),'Недоступен');
  assert.equal(state.slotStatus({...slot,unknown_orders:1}),'Нужна оценка');
});

for (const [mode,area,expectedZone,totalMinor] of [['pickup','jomtien','pickup',145000],['delivery','central','central',157000],['delivery','jomtien','jomtien',163000]]) {
 test('chat submits '+expectedZone+' and reports the saved server total',async()=>{
  let payload,exchange;
  const context={
   useCatalog:()=>({products:vue.ref([{id:'berry',name:'Cake',price:9999,leadDays:1,variants:[{sku:'berry-cloud-1kg'}]}]),load:()=>{},error:vue.ref('')}),
   useAtelier:()=>({t:ru=>ru,local:x=>x,money:x=>x+' ฿',locale:vue.ref('ru')}),
   useStorefrontChat:()=>({chatOpen:vue.ref(true),thread:vue.ref({mode:'bot',messages:[]}),sessionToken:vue.ref('session'),sendExchange:async input=>{exchange=input;}}),
   useOperations:()=>({findKnowledge:()=>null}),
   usePublicIntake:()=>({submitOrder:async input=>{payload=input;return {reference:'BLG-QA',totalMinor};}}),
   useAvailability:()=>({getAvailability:async()=>[]}),useRoute:()=>({path:'/'}),bangkokDate:()=> '2026-10-10',validOrderContact:()=>true
  };
  const state=script('components/atelier/Chat.vue',context,['confirm','mode','area','orderStep','date','customer','contact','address']);
  state.mode.value=mode;state.area.value=area;state.orderStep.value=2;state.date.value='2026-10-12';state.customer.value='QA';state.contact.value='qa@example.invalid';state.address.value='Demo';
  await state.confirm();
  assert.equal(payload.deliveryZone,expectedZone);assert.equal(payload.fulfillment,mode);
  assert.match(exchange.customerText,new RegExp(totalMinor/100+' ฿'));
  assert.doesNotMatch(exchange.customerText,/9999|10119|10179/);
 });
}

test('past assessment tells staff to reschedule before reserving',async()=>{
 const state=script('components/admin/ProductionAssessment.vue',{
  defineProps:()=>({order:{id:'qa',revision:1}}),defineEmits:()=>()=>{throw Error('must not emit saved');},
  useNuxtApp:()=>({$supabase:{rpc:async()=>({error:{message:'invalid_schedule'}})}})
 },['save','error']);
 await state.save();assert.match(state.error.value,/Сначала перенесите заявку на будущее время/);
});
