import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { ref } from 'vue';
import { readStaffIdentity } from '../../utils/staffIdentity.ts';

function client(auth, member = { role:'manager', active:true }, resolveMember) {
  const calls = [];
  const query = {
    select(){ return this; }, eq(){ return this; },
    abortSignal(signal){ calls.push(signal); return this; },
    maybeSingle(){ return resolveMember ? resolveMember() : Promise.resolve({data:member,error:null}); },
  };
  return {calls,auth:{getUser:auth},from(name){calls.push(name);return query;}};
}
const user = {data:{user:{id:'staff-id',email:'staff@example.invalid'}},error:null};

test('staff verification requires a server user and an active allowed database role', async()=>{
  assert.deepEqual(await readStaffIdentity(client(async()=>user)),{id:'staff-id',email:'staff@example.invalid',role:'manager'});
  for(const member of [null,{role:'manager',active:false},{role:'customer',active:true}]){
    await assert.rejects(readStaffIdentity(client(async()=>user,member)),/нет доступа сотрудника/);
  }
  const missing = client(async()=>({data:{user:null},error:null}));
  assert.equal(await readStaffIdentity(missing),null);assert.deepEqual(missing.calls,[]);
});

test('a hung auth check times out and a late user does not query staff data',async()=>{
  let finish; const sdk = client(()=>new Promise(resolve=>{finish=resolve;}));
  await assert.rejects(readStaffIdentity(sdk,10),/слишком много времени/);
  finish(user);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(sdk.calls,[]);
});

test('a hung membership lookup is aborted and cannot produce an accepted late identity',async()=>{
  let finish;const sdk=client(async()=>user,undefined,()=>new Promise(resolve=>{finish=resolve;}));
  await assert.rejects(readStaffIdentity(sdk,10),/слишком много времени/);
  assert.equal(sdk.calls[1].aborted,true);
  finish({data:{role:'owner',active:true},error:null});
  await new Promise(resolve=>setImmediate(resolve));
});

function composable(reader){
  const state=new Map();
  const useState=(key,init)=>{if(!state.has(key))state.set(key,ref(init()));return state.get(key);};
  const source=readFileSync(new URL('../../composables/useStaffAuth.ts',import.meta.url),'utf8')
    .replace(/^import .*$/gm,'').replace(/^export type .*$/gm,'').replaceAll('import.meta.server','false');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/\bexport /g,'');
  const factory=new Function('useState','useNuxtApp','readStaffIdentity','navigateTo',code+';return useStaffAuth;');
  return {state,auth:factory(useState,()=>({$supabase:{}}),reader,async()=>{})()};
}

test('a stale successful check cannot restore staff identity after sign-out or a newer verification',async()=>{
  let finish;let first=true;
  const {state,auth}=composable(()=>first?(first=false,new Promise(resolve=>{finish=resolve;})):Promise.resolve({id:'new-user',role:'owner',email:''}));
  const stale=auth.verify();await auth.verify();finish({id:'old-user',role:'manager',email:''});
  await assert.rejects(stale,/Сессия изменилась/);assert.equal(auth.staff.value.id,'new-user');
  const pending=composable(()=>new Promise(resolve=>{finish=resolve;}));
  const beforeSignOut=pending.auth.verify();pending.state.get('staff-verification').value++;
  finish({id:'signed-out',role:'manager',email:''});
  await assert.rejects(beforeSignOut,/Сессия изменилась/);assert.equal(pending.auth.staff.value,null);
});
