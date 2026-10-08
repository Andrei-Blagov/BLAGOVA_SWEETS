import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {parse} from '@vue/compiler-sfc';
import {ref,reactive,computed,nextTick,watch} from 'vue';
import {orderHistory} from '../../utils/orderHistory.mjs';

function script(path,context,bindings){
 const {descriptor}=parse(readFileSync(new URL('../../'+path,import.meta.url),'utf8'));
 const source=descriptor.scriptSetup.content.replace(/^import .*;\s*$/gm,'');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const globals={ref,reactive,computed,nextTick,watch:()=>{},onMounted:()=>{},onBeforeUnmount:()=>{},...context};
 return new Function(...Object.keys(globals),js+'\nreturn {'+bindings.join(',')+'};')(...Object.values(globals));
}
test('saved gift pieces and production sets have distinct units in the card',()=>{
 const state=script('components/admin/OrderComposition.vue',{defineProps:()=>({items:[]})},['componentName']);
 assert.equal(state.componentName({snapshot:{variant:{sku:'custom-gift'}}},'chocolate'),'Шоколадные конфеты, шт.');
 assert.equal(state.componentName({snapshot:{variant:{sku:'custom-gift'}}},'gingerbread'),'Пряники, шт.');
 assert.equal(state.componentName({snapshot:{variant:{sku:'chocolate-stories-standard'}}},'chocolate'),'Наборы конфет');
});
test('history identifies status, transfer, assessment and reservation from frozen revisions',()=>{
 const events=[{id:'b',revision:2,kind:'updated',old_status:'pending',new_status:'confirmed',created_at:'2026-10-05T00:00:00Z',details:{scheduled_start:'new',scheduled_end:'new-end',production_load:8,rules_version:1,reservation_expires_at:null,production_assessment:{reason:'Agreed cake'}}},{id:'a',revision:1,kind:'created',new_status:'pending',created_at:'2026-10-05T00:00:00Z',details:{scheduled_start:'old',scheduled_end:'old-end',production_load:null,rules_version:null,reservation_expires_at:'expiry'}}];
 const rows=orderHistory(events,[{id:'note',order_revision:2,created_at:'2026-10-05T01:00:00Z',body:'<script>literal</script>'}],x=>x,x=>x);
 assert.equal(rows[0].id,'a');assert.equal(rows[1].id,'b');
 assert.deepEqual(rows[1].lines,['pending → confirmed','Перенос: new — new-end','Нагрузка: 8 ед.','Правила производства: версия 1','Резерв снят','Основание оценки: Agreed cake']);
 assert.equal(rows[2].lines[0],'Внутренняя заметка: <script>literal</script>');
 assert.equal(events[0].id,'b','does not mutate source audit order');
});
test('note transport retries keep request identity and order changes keep the draft',async()=>{
 const order={id:'order',revision:1};const requests=[];let mode='network';const emitted=[];let key=0;
 const state=script('components/admin/OrderNotes.vue',{
  defineProps:()=>({order,busy:false}),defineEmits:()=>((...args)=>emitted.push(args)),newUuid:()=> 'request-'+(++key),
  watch:(source,callback)=>watch(source,callback,{flush:'sync'}),
  useNuxtApp:()=>({$supabase:{rpc:async(_,args)=>{requests.push({...args});return {error:mode==='network'?{code:'NETWORK'}:mode==='conflict'?{code:'40001'}:null};}}})
 },['body','requestId','error','save']);
 state.body.value='A private note';await state.save();await state.save();
 assert.equal(requests[0].p_note_id,requests[1].p_note_id);assert.equal(state.body.value,'A private note');
 mode='conflict';await state.save();assert.equal(state.body.value,'A private note');assert.ok(emitted.some(([event])=>event==='refresh'));
 order.revision=2;mode='success';await state.save();assert.equal(requests[3].p_note_id,requests[0].p_note_id);assert.equal(requests[3].p_revision,2);assert.equal(state.body.value,'');
 state.body.value='Another note';await state.save();assert.notEqual(requests[4].p_note_id,requests[3].p_note_id);
});
function adminContext(rpc){
 const staff=ref({id:'manager',role:'manager'});
 const api={rpc,from:()=>({select:()=>({order:()=>({limit:async()=>({data:[],error:null})})})})};
 return {useStaffAuth:()=>({staff,verify:async()=>staff.value,logout:async()=>{}}),useNuxtApp:()=>({$supabase:api}),definePageMeta:()=>{},useHead:()=>{},allowedStaffTabs:()=>['orders'],bangkokDate:()=> '2026-10-10',statuses:[],transitions:{},navigateTo:async()=>{}};
}
test('admin applies server filters, global metrics and keeps an independent card across pages',async()=>{
 const requests=[];const rpc=async(name,args)=>{requests.push({name,args:{...args}});return name==='staff_order_details'?{data:{id:args.p_order_id,scheduled_start:'2026-10-10T02:00:00Z',total_minor:163000},error:null}:{data:{orders:[{id:'list-only'}],total:130,stats:{pending:130,preparing:0,ready:0}},error:null};};
 const state=script('pages/admin.vue',adminContext(rpc),['load','loadSelected','applyOrderFilters','nextPage','selectedId','selected','orders','orderStats','orderPage','search','filter','sourceFilter','fromDate','toDate','loading']);
 state.loading.value=false;state.selectedId.value='independent-order';state.orderPage.value=3;state.search.value='cake';state.filter.value='pending';state.sourceFilter.value='chat';state.fromDate.value='2026-10-10';state.toDate.value='2026-10-11';
 await state.applyOrderFilters();
 assert.equal(requests[0].args.p_page,0);assert.equal(requests[0].args.p_query,'cake');assert.equal(requests[0].args.p_source,'chat');assert.equal(requests[0].args.p_from,'2026-10-10');
 assert.equal(state.orderStats.value.pending,130);assert.equal(state.selected.value.id,'independent-order');
 await state.nextPage(1);assert.equal(state.orderPage.value,1);assert.equal(state.selectedId.value,'independent-order');assert.equal(state.selected.value.id,'independent-order');
});
test('late detail responses cannot replace a more recently selected order',async()=>{
 let finish;const pending=new Promise(resolve=>{finish=resolve;});
 const state=script('pages/admin.vue',adminContext(async(_,args)=>args.p_order_id==='old'?pending:{data:{id:'new'},error:null}),['selectedId','selected','loadSelected']);
 state.selectedId.value='old';const old=state.loadSelected();state.selectedId.value='new';await state.loadSelected();finish({data:{id:'old'},error:null});await old;
 assert.equal(state.selected.value.id,'new');
});

for (const [start,status,message] of [
 ['2020-01-01T05:00:00Z','pending',/интервал уже начался или прошёл.*Сначала перенесите/],
 ['2099-01-01T05:00:00Z','pending',/Интервал мог заполниться или данные заказа изменились/],
 ['2020-01-01T05:00:00Z','confirmed',/Заказ подтверждён, но письмо не отправлено/],
]) {
 test('confirmation failure explains saved '+status+' order at '+start,async()=>{
  const order={id:'qa-order',revision:2,status:'pending',scheduled_start:start,total_minor:145000};
  const current={...order,status};let invoked=0;
  const context=adminContext(async(name)=>name==='staff_order_details'
   ? {data:current,error:null}
   : name==='staff_directory' ? {data:[],error:null}
   : {data:{orders:[current],total:1,stats:{pending:1,preparing:0,ready:0}},error:null});
  const app=context.useNuxtApp();app.$supabase.functions={invoke:async()=>{invoked++;return {error:new Error('rejected')};}};
  context.useNuxtApp=()=>app;context.window={confirm:()=>true};
  const state=script('pages/admin.vue',context,['confirmOrder','selected','selectedId','error','notice','saving']);
  state.selectedId.value=order.id;state.selected.value=order;
  await state.confirmOrder();
  assert.equal(invoked,1);assert.match(state.error.value,message);assert.equal(state.notice.value,'');
  assert.equal(state.selected.value.status,status);assert.equal(state.selected.value.revision,2);assert.equal(state.saving.value,false);
 });
}
