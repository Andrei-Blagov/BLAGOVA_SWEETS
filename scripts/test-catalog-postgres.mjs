// Own cached image, new network-less container, no ports/host mounts/hosted DSN.
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {waitForPostgresTcp} from './postgres-test-readiness.mjs';
const cachedImage='sha256:858bb5e98eed02eb8cafbcdc007f9a65d1b613972028944a8ec2133ccaf80d27';
const ciImage='postgres:16.15@sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65';
const image=process.env.BLAGOVA_A4_POSTGRES_IMAGE||cachedImage;
assert.ok([cachedImage,ciImage].includes(image),'Only the reviewed cached/pinned test images are allowed');
const name='blagova-a4-disposable-'+crypto.randomUUID().slice(0,8),dbName='blagova_a4';
const owner='11111111-1111-4111-8111-111111111111';
const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const literal=s=>"'"+String(s).replaceAll("'","''")+"'";
let container='';const evidence={postgres:null,scenarios:[],containerRemoved:false,limits:['Disposable Auth/Storage scaffold only; no hosted Supabase/PostgREST/Storage acceptance']};
function sql(input,db=dbName){return execFileSync('docker',['exec','-i',container,'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','postgres','-d',db],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
const identity=`set "request.jwt.claim.sub"='${owner}';set role authenticated;`;
const save=(id,version,doc)=>`select public.save_catalog_product('${id}',${version},${literal(JSON.stringify(doc))}::jsonb,'published');`;
function session(input){
 const p=spawn('docker',['exec','-i',container,'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','postgres','-d',dbName]);let out='',err='';p.stdout.on('data',s=>out+=s);p.stderr.on('data',s=>err+=s);
 const finished=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',code=>code===0?resolve(out.trim()):reject(Error(err)));});
 if(input)p.stdin.end(input);return {finished,write:s=>p.stdin.write(s),end:s=>p.stdin.end(s)};
}
async function observed(query){const until=Date.now()+12000;while(Date.now()<until){if(sql(query)==='t')return;await new Promise(r=>setTimeout(r,50));}throw Error('Concurrency barrier not observed');}
try{
 docker(['image','inspect',image]);
 container=docker(['create','--name',name,'--network','none','--label','blagova.test=A4','--env','POSTGRES_HOST_AUTH_METHOD=trust',image]);assert.match(container,/^[a-f0-9]{64}$/);
 docker(['start',container]);await waitForPostgresTcp(container);
 sql('create database '+dbName+';','postgres');
 sql(readFileSync('scripts/test-database.mjs','utf8').match(/await db\.exec\(`([\s\S]*?)`\);/)[1]);
 for(const f of readdirSync('supabase/migrations').sort())sql(readFileSync('supabase/migrations/'+f,'utf8'));
 for(const f of ['structured_order_capacity.sql','stage2_acceptance.sql','staff_order_workspace.sql','staff_operations.sql'])sql(readFileSync('supabase/tests/'+f,'utf8'));
 evidence.postgres=sql('select version();');
 sql(`insert into auth.users(id,email) values('${owner}','owner@example.invalid');insert into public.staff_members(user_id,role) values('${owner}','owner');`);
 const id=sql("select id from public.products where slug='berry-cloud';"),before=JSON.parse(sql(`select private.catalog_document('${id}');`));
 const a=structuredClone(before),b=structuredClone(before);a.name.en='Synthetic editor one';b.name.en='Synthetic editor two';
 const holder=session();holder.write(`begin;set application_name='a4-holder';${identity}${save(id,before.catalog_version,a)}\n`);
 await observed("select exists(select 1 from pg_stat_activity where datname='blagova_a4' and application_name='a4-holder' and state='idle in transaction');");
 const waiter=session(`set application_name='a4-waiter';${identity}${save(id,before.catalog_version,b)}`);
 const waiting=waiter.finished.then(value=>({value}),error=>({error}));
 await observed("select exists(select 1 from pg_stat_activity where datname='blagova_a4' and application_name='a4-waiter' and cardinality(pg_blocking_pids(pid))>0);");
 holder.end('commit;\n');const [first,second]=await Promise.all([holder.finished,waiting]);assert.ok(second.error);assert.match(second.error.message,/catalog_conflict/);const saved=JSON.parse(first);
 assert.equal(saved.name.en,'Synthetic editor one');assert.deepEqual(JSON.parse(sql(`select private.catalog_document('${id}');`)),saved);
 evidence.scenarios.push({name:'two concurrent editor sessions, same expected version',result:'passed',barrier:'idle transaction + pg_blocking_pids observed; waiter rejected after holder commit'});
 const bad=structuredClone(saved);bad.name.en='Must roll back';bad.product_variants[0].price_minor+=123;bad.product_variants[0].production_variant_profiles.components={cake:2};bad.catalog_options.push({option_group:'synthetic',option_key:'bad',label:{ru:'Synthetic',en:'Synthetic',th:'Synthetic'},price_delta_minor:-1,sort_order:0,active:true});
 const auditCount=sql('select count(*) from public.catalog_events;');assert.throws(()=>sql(identity+save(id,saved.catalog_version,bad)),/check constraint/);assert.deepEqual(JSON.parse(sql(`select private.catalog_document('${id}');`)),saved);assert.equal(sql('select count(*) from public.catalog_events;'),auditCount);
 evidence.scenarios.push({name:'late failure rolls back root, variants, profiles and audit',result:'passed'});
 assert.throws(()=>sql(`set role service_role;update public.product_variants set active=false where product_id='${id}';`),/catalog_active_variant_missing/);assert.deepEqual(JSON.parse(sql(`select private.catalog_document('${id}');`)),saved);
 evidence.scenarios.push({name:'deferred publication guard rejects privileged disabling of last active variant',result:'passed'});
 const newId=crypto.randomUUID(),newDoc=structuredClone(saved);newDoc.id=newId;newDoc.slug='synthetic-'+newId;newDoc.category='cafe';newDoc.catalog_version=0;newDoc.catalog_options=[];
 newDoc.product_variants=[{...newDoc.product_variants[0],id:crypto.randomUUID(),sku:'synthetic-'+crypto.randomUUID()}];
 newDoc.product_images=[{id:crypto.randomUUID(),storage_path:'products/'+newId+'/'+crypto.randomUUID()+'.webp',alt:{ru:'Synthetic',en:'Synthetic',th:'Synthetic'},sort_order:0,is_primary:true}];
 sql(`insert into storage.objects(bucket_id,name) values('catalog-demo',${literal(newDoc.product_images[0].storage_path)});`);
 const category=JSON.parse(sql("select to_jsonb(c) from public.catalog_categories c where id='cafe';"));
 const publishing=session();publishing.write(`begin;set application_name='a4-publisher';${identity}${save(newId,0,newDoc)}\n`);
 await observed("select exists(select 1 from pg_stat_activity where datname='blagova_a4' and application_name='a4-publisher' and state='idle in transaction');");
 const disabling=session(`set application_name='a4-category';${identity}select public.save_catalog_setting('category','cafe',${category.catalog_version},${literal(JSON.stringify({...category,active:false}))}::jsonb);`);
 const disabled=disabling.finished.then(value=>({value}),error=>({error}));
 await observed("select exists(select 1 from pg_stat_activity where datname='blagova_a4' and application_name='a4-category' and cardinality(pg_blocking_pids(pid))>0);");
 publishing.end('commit;\n');await publishing.finished;const categoryResult=await disabled;assert.ok(categoryResult.error);assert.match(categoryResult.error.message,/catalog_category_unavailable/);assert.equal(sql("select active from public.catalog_categories where id='cafe';"),'t');
 evidence.scenarios.push({name:'category disable waits for publication, then rejects incomplete published state',result:'passed',barrier:'independent sessions + pg_blocking_pids observed'});
 console.log('PostgreSQL A4 concurrency/rollback/invariant scenarios: 4 PASS');
}finally{
 if(container){
  const actual=JSON.parse(docker(['inspect',container]))[0];assert.equal(actual.Id,container);assert.equal(actual.Name,'/'+name);assert.equal(actual.Config.Labels['blagova.test'],'A4');assert.equal(actual.HostConfig.NetworkMode,'none');assert.deepEqual(actual.HostConfig.PortBindings,{});
  docker(['rm','-f','-v',container]);evidence.containerRemoved=true;
 }
 writeFileSync(process.env.A4_PG_REPORT||'../evidence/A4-catalog-postgres.json',JSON.stringify(evidence,null,2)+'\n');
}
