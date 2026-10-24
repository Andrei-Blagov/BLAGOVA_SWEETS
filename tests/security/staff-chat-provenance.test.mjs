import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {parse,compileTemplate} from '@vue/compiler-sfc';
import * as vue from 'vue';
import {renderToString} from '@vue/server-renderer';
import {projectStaffMessage} from '../../utils/chatProvenance.mjs';

test('actual manager/owner staff reader and template mark legacy/unknown assistants, retain history and server handoff',async()=>{
 const db=new PGlite();
 await db.exec(readFileSync('scripts/test-database.mjs','utf8').match(/await db\.exec\(`([\s\S]*?)`\);/)[1]);
 for(const file of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 try{
  const conversation=(await db.query("insert into public.conversations(channel,mode) values('website','bot') returning id")).rows[0].id;
  for(const [sender,body,policy] of [['assistant','Synthetic legacy answer',null],['system','Synthetic legacy system',null],['assistant','Synthetic unknown policy','handoff-v1'],['assistant','Synthetic server handoff','handoff-v1'],['manager','Synthetic manager reply',null],['owner','Synthetic owner reply',null]]){
   await db.query('insert into public.messages(conversation_id,sender,body,source,assistant_policy) values($1,$2,$3,$4,$5)',[conversation,sender,body,'Forged approved policy',policy]);
  }
  // Future/unknown policy is projected defensively; the current DB rejects such
  // values, so this case is exercised at the read boundary, not via bypass DML.
  assert.equal(projectStaffMessage({sender:'assistant',assistant_policy:'unknown-future',source:'Forged'}).unverified,true);
  const component=readFileSync('pages/admin.vue','utf8'),source=parse(component).descriptor.scriptSetup.content;
  const functionSource='async function readMessages'+source.split('async function readMessages')[1].split('watch(threadId')[0];
  const article=component.match(/<article :class="\['chat-bubble','chat-'\+m.sender\]">[\s\S]*?<\/article>/)[0];
  const compiled=compileTemplate({source:'<div><template v-for="m in messages" :key="m.id">'+article+'</template></div>',filename:'staff-provenance.vue',id:'staff-provenance'});assert.deepEqual(compiled.errors,[]);
  const exports={};new Function('require','exports',ts.transpileModule(compiled.code,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(()=>vue,exports);
  for(const role of ['manager','owner']){
   const id=crypto.randomUUID();await db.query("insert into auth.users(id,email) values($1,$2)",[id,role+'@example.invalid']);await db.query('insert into public.staff_members(user_id,role) values($1,$2)',[id,role]);
   const messages=vue.ref([]),error=vue.ref(''),threadId=vue.ref(conversation),staff=vue.ref({id,role});
   const api=()=>({from:table=>{assert.equal(table,'messages');return {select:fields=>{assert.equal(fields,'*');return {eq:(column,value)=>({order:()=>({limit:async n=>{
    assert.equal(column,'conversation_id');assert.equal(n,100);await db.exec('set role authenticated');
    try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return {data:(await db.query('select * from public.messages where conversation_id=$1 order by created_at desc limit 100',[value])).rows,error:null};}finally{await db.exec('reset role');}
   }})})};}};}});
   const fn=new Function('api','messages','error','threadId','staff','projectStaffMessage','let messageEpoch=0;'+ts.transpileModule(functionSource,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return readMessages;')(api,messages,error,threadId,staff,projectStaffMessage);
   await fn();assert.equal(error.value,'');assert.equal(messages.value.length,6);
   for(const message of messages.value){assert.equal(message.source,null);assert.equal(message.unverified,['Synthetic legacy answer','Synthetic legacy system'].includes(message.body));}
   const html=await renderToString(vue.createSSRApp({setup:()=>({messages:messages.value,senderLabel:x=>x,dateTime:()=> 'Synthetic time'}),render:exports.render}));
   assert.doesNotMatch(html,/Forged approved policy|Материал:/);assert.equal((html.match(/ответ не проверен/g)||[]).length,2);assert.match(html,/Synthetic server handoff/);assert.match(html,/Synthetic manager reply/);assert.match(html,/Synthetic owner reply/);
  }
  assert.equal((await db.query("select count(*)::int n from public.messages where source='Forged approved policy'")).rows[0].n,6,'history is retained, never rewritten by the projection');
 }finally{await db.close();}
});
