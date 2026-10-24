// Explicitly opted-in, owned, network-less disposable Docker PostgreSQL only.
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const container=process.env.BLAGOVA_DISPOSABLE_CONTAINER;
assert.match(container||'',/^[a-f0-9]{64}$/,'Supply the exact newly created disposable container ID');
const inspect=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(inspect.Config.Labels['blagova.test'],'A2');assert.equal(inspect.HostConfig.NetworkMode,'none');
assert.match(inspect.Name,/^\/blagova-a2-disposable-/);
const database='blagova_a2_'+crypto.randomUUID().replaceAll('-','');
const evidence={postgres:null,scenarios:[],limits:['Disposable PostgreSQL with Auth/Storage scaffold; no hosted PostgREST/JWT/Cron/provider acceptance'],databaseRemoved:false};
function sql(input,db=database){return execFileSync('docker',['exec','-i',container,'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','postgres','-d',db],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
const literal=s=>"'"+String(s).replaceAll("'","''")+"'";
const payload={source:'website',locale:'ru',customerName:'Synthetic A2',customerContact:'qa@example.invalid',fulfillment:'pickup',deliveryAddress:'',deliveryZone:'pickup',scheduledStart:'2099-01-05T02:00:00Z',scheduledEnd:'2099-01-05T05:00:00Z',note:'',items:[{sku:'berry-cloud-1kg',quantity:1,configuration:{}}],messages:[]};
const hash='a'.repeat(64),rate='b'.repeat(64);
const submit=(key,p=payload)=>`select public.submit_storefront_intent('${key}','${hash}',${literal(JSON.stringify(p))}::jsonb,'${rate}');`;
function asynchronous(input){
 const p=spawn('docker',['exec','-i',container,'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','postgres','-d',database],{stdio:['pipe','pipe','pipe']});
 let out='',err='';p.stdout.on('data',s=>out+=s);p.stderr.on('data',s=>err+=s);
 const finished=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',code=>code===0?resolve(out):reject(Error(err)));});
 if(input)p.stdin.end(input);
 return {p,finished,write:s=>p.stdin.write(s),end:s=>p.stdin.end(s)};
}
async function observed(query){
 const end=Date.now()+12000;
 while(Date.now()<end){if(sql(query)==='t')return;await new Promise(r=>setTimeout(r,30));}
 throw Error('Expected server-side concurrency barrier not observed');
}
let created=false;
try{
 assert.equal(sql("select count(*) from pg_roles where rolname in ('anon','authenticated','service_role');",'postgres'),'0','Refusing a cluster with existing application roles');
 sql('create database '+database+';','postgres');created=true;
 evidence.postgres=sql('select version();');
 const harness=readFileSync('scripts/test-database.mjs','utf8');sql(harness.match(/await db\.exec\(`([\s\S]*?)`\);/)[1]);
 for(const file of readdirSync('supabase/migrations').sort())sql(readFileSync('supabase/migrations/'+file,'utf8'));
 for(const file of ['structured_order_capacity.sql','stage2_acceptance.sql','staff_order_workspace.sql','staff_operations.sql'])sql(readFileSync('supabase/tests/'+file,'utf8'));
 const key=crypto.randomUUID();
 const first=asynchronous();first.write(`begin;set application_name='a2-holder';set role service_role;${submit(key)}\n`);
 await observed("select exists(select 1 from pg_stat_activity where application_name='a2-holder' and state='idle in transaction');");
 const second=asynchronous(`set application_name='a2-waiter';set role service_role;${submit(key)}`);
 await observed("select exists(select 1 from pg_stat_activity where application_name='a2-waiter' and cardinality(pg_blocking_pids(pid))>0);");
 first.end('commit;\n');const [a,b]=await Promise.all([first.finished,second.finished]);
 const receiptA=JSON.parse(a.trim()),receiptB=JSON.parse(b.trim());assert.equal(receiptA.summary.reference,receiptB.summary.reference);assert.equal(receiptB.duplicate,true);
 assert.equal(sql(`select count(*) from public.orders where request_key='${key}';`),'1');
 evidence.scenarios.push({name:'concurrent identical duplicate',result:'passed',barrier:'independent psql sessions; pg_stat_activity idle TX + pg_blocking_pids observed'});
 assert.throws(()=>sql('set role service_role;'+submit(key,{...payload,scheduledStart:'2099-01-06T02:00:00Z',scheduledEnd:'2099-01-06T05:00:00Z'})),/intent_payload_conflict/);
 evidence.scenarios.push({name:'different payload on saved key',result:'passed'});
 const closed=crypto.randomUUID();sql(`set role service_role;select public.resolve_storefront_intent('${closed}','${hash}',true,'${rate}');`);
 assert.throws(()=>sql('set role service_role;'+submit(closed)),/intent_closed/);
 evidence.scenarios.push({name:'closed key fences late submission',result:'passed'});
 // A server-committed response can be discarded; recovery still returns exactly
 // the immutable summary, without creating another order.
 const recovered=JSON.parse(sql(`set role service_role;select public.resolve_storefront_intent('${key}','${hash}',false,'${rate}');`));
 assert.deepEqual(recovered.summary,receiptA.summary);
 evidence.scenarios.push({name:'timeout-after-commit receipt resolution',result:'passed'});
  const racingKey=crypto.randomUUID();
  const saving=asynchronous();saving.write(`begin;set application_name='a2-saving';set role service_role;${submit(racingKey)}\n`);
  await observed("select exists(select 1 from pg_stat_activity where application_name='a2-saving' and state='idle in transaction');");
  const closing=asynchronous(`set application_name='a2-closing';set role service_role;select public.resolve_storefront_intent('${racingKey}','${hash}',true,'${rate}');`);
  await observed("select exists(select 1 from pg_stat_activity where application_name='a2-closing' and cardinality(pg_blocking_pids(pid))>0);");
  saving.end('commit;\n');const [savedRace,closedRace]=await Promise.all([saving.finished,closing.finished]);
  assert.equal(JSON.parse(closedRace.trim()).state,'saved');assert.deepEqual(JSON.parse(savedRace.trim()).summary,JSON.parse(closedRace.trim()).summary);
  evidence.scenarios.push({name:'close waits for in-flight submit and returns saved receipt',result:'passed',barrier:'independent sessions and pg_blocking_pids observed'});
 evidence.result='passed';
}catch(e){evidence.result='failed';evidence.error=e.message;throw e;}
finally{
 if(created){sql('drop database '+database+' with (force);','postgres');sql('drop role if exists anon;drop role if exists authenticated;drop role if exists service_role;','postgres');evidence.databaseRemoved=true;}
 writeFileSync(process.env.A2_PG_REPORT||'../evidence/A2-pending-postgres.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify(evidence,null,2));
}
