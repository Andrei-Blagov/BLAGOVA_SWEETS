import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { ref, reactive, watch } from 'vue';
import { orderCsv } from '../../utils/orderCsv.mjs';

function setup(rpc){
  const props=reactive({owner:true,busy:false,filters:{p_query:'QA',p_status:'all'}});
  const files=[],revoked=[],cleanup=[];
  const {descriptor}=parse(readFileSync(new URL('../../components/admin/OrderExport.vue',import.meta.url),'utf8'));
  const source=descriptor.scriptSetup.content.replace(/^import .*$/gm,'');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const context={ref,defineProps:()=>props,onBeforeUnmount:fn=>cleanup.push(fn),
    watch:(source,fn,options)=>watch(source,fn,{...options,flush:'sync'}),
    useNuxtApp:()=>({$supabase:{rpc}}),orderCsv,
    URL:{createObjectURL:blob=>{files.push(blob);return 'blob:export-'+files.length;},revokeObjectURL:url=>revoked.push(url)},
  };
  const state=new Function(...Object.keys(context),code+';return {download,downloadUrl,downloadName,includeContacts,notice,exporting};')(...Object.values(context));
  return {state,props,files,revoked,cleanup};
}
const result={data:{count:1,includes_contacts:false,rows:[{reference:'BLG-QA',items:'Cake',customer_contact:'private@example.invalid'}]},error:null};

test('prepared CSV stays available for explicit download and changing filters revokes the old file',async()=>{
  const {state,props,files,revoked,cleanup}=setup(async()=>result);
  await state.download();assert.equal(state.downloadUrl.value,'blob:export-1');
  assert.ok(state.notice.value.includes('CSV подготовлен: 1'));assert.ok(state.downloadName.value.endsWith('.csv'));
  assert.ok(!(await files[0].text()).includes('private@example.invalid'));
  props.filters.p_status='cancelled';assert.equal(state.downloadUrl.value,'');assert.deepEqual(revoked,['blob:export-1']);
  await state.download();cleanup[0]();assert.deepEqual(revoked,['blob:export-1','blob:export-2']);
});

test('late export responses cannot publish a contacts file after permissions or filters change',async()=>{
  for(const change of [props=>{props.owner=false;},props=>{props.filters.p_query='Other';}]){
    let finish;const args=[];
    const {state,props,files}=setup(async(_,p)=>{args.push(p);return new Promise(resolve=>{finish=resolve;});});
    state.includeContacts.value=true;const pending=state.download();assert.equal(args[0].p_include_contacts,true);
    change(props);finish({...result,data:{...result.data,includes_contacts:true}});await pending;
    assert.equal(state.downloadUrl.value,'');assert.equal(state.notice.value,'');assert.equal(files.length,0);assert.equal(state.exporting.value,false);
  }
});
