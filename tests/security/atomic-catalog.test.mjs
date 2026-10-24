import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {parse} from '@vue/compiler-sfc';
import * as vue from 'vue';
const owner='11111111-1111-4111-8111-111111111111';
const words=x=>({ru:x,en:x,th:x});
function document(){const id=crypto.randomUUID();return {id,catalog_version:0,slug:'synthetic-'+id,category:'cake',name:words('Synthetic cake'),subtitle:words('Synthetic'),description:words('Synthetic description'),allergens:words('Synthetic allergens'),sort_order:1,production_profile:{kind:'manual',work_units:0},
 product_variants:[{id:crypto.randomUUID(),sku:'synthetic-'+crypto.randomUUID(),name:words('One cake'),price_minor:10000,lead_days:1,min_quantity:1,active:true,sort_order:0,production_variant_profiles:{components:{cake:1}}}],
 catalog_options:[{id:crypto.randomUUID(),option_group:'decoration',option_key:'synthetic',label:words('Synthetic decoration'),price_delta_minor:1000,active:true,sort_order:0}],
 product_images:[{id:crypto.randomUUID(),storage_path:'products/'+id+'/'+crypto.randomUUID()+'.webp',alt:words('Synthetic cake photo'),sort_order:0,is_primary:true}]};}
async function fixture(run){
 const db=new PGlite();await db.exec(readFileSync('scripts/test-database.mjs','utf8').match(/await db\.exec\(`([\s\S]*?)`\);/)[1]);for(const f of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 await db.exec("insert into auth.users(id,email) values('"+owner+"','owner@example.invalid'),('22222222-2222-4222-8222-222222222222','manager@example.invalid');insert into public.staff_members(user_id,role) values('"+owner+"','owner'),('22222222-2222-4222-8222-222222222222','manager')");
 const as=async(role,fn)=>{await db.exec('set role '+role);try{return await fn();}finally{await db.exec('reset role');}};
 const rpc=async(name,p)=>as('authenticated',async()=>{
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  if(name==='save_catalog_product')return (await db.query('select public.save_catalog_product($1,$2,$3::jsonb,$4) result',[p.p_product_id,p.p_expected_version,JSON.stringify(p.p_document),p.p_status])).rows[0].result;
  return (await db.query('select public.save_catalog_setting($1,$2,$3,$4::jsonb) result',[p.p_kind,p.p_key,p.p_expected_version,JSON.stringify(p.p_value)])).rows[0].result;
 });
 const save=(doc,status='published',version=doc.catalog_version)=>rpc('save_catalog_product',{p_product_id:doc.id,p_expected_version:version,p_document:doc,p_status:status});
 const current=async id=>(await db.query('select private.catalog_document($1) doc',[id])).rows[0].doc;
 const upload=async path=>db.query("insert into storage.objects(bucket_id,name) values('catalog-demo',$1)",[path]);
 try{await run({db,as,rpc,save,current,upload});}finally{await db.close();}
}

test('atomic owner aggregate rolls back late option/photo failures including audit, versions and profile edits',async()=>fixture(async({db,save,current,upload})=>{
 const d=document();await upload(d.product_images[0].storage_path);const saved=await save(d);assert.ok(saved.catalog_version>0);
 const events=(await db.query('select count(*)::int n from public.catalog_events')).rows[0].n;
 const bad=structuredClone(saved);bad.name=words('Changed');bad.product_variants[0].price_minor=20000;bad.product_variants[0].production_variant_profiles.components={cake:2};bad.catalog_options[0].price_delta_minor=-1;
 await assert.rejects(save(bad),/check constraint/);assert.deepEqual(await current(d.id),saved);
 const missing=structuredClone(saved);missing.name=words('Changed');missing.product_images.push({id:crypto.randomUUID(),storage_path:'products/'+d.id+'/'+crypto.randomUUID()+'.webp',alt:words('Unuploaded'),sort_order:10,is_primary:false});await assert.rejects(save(missing),/catalog_image_unavailable/);assert.deepEqual(await current(d.id),saved);
 assert.equal((await db.query('select count(*)::int n from public.catalog_events')).rows[0].n,events,'all intermediate audit/version changes roll back');
 const newer=structuredClone(saved);newer.name=words('Editor one');const updated=await save(newer);assert.ok(updated.catalog_version>saved.catalog_version);
 await assert.rejects(save({...saved,name:words('Editor two')}),/catalog_conflict/);assert.deepEqual(await current(d.id),updated,'stale editor cannot overwrite');
 await assert.rejects(save({...updated,product_variants:[]}),/catalog_existing_child_missing/);
}));

test('incomplete draft may retain an inactive unassessed variant but cannot publish or activate it without required content',async()=>fixture(async({save,current})=>{
 const d=document();d.name={ru:'Synthetic draft'};d.description={};d.product_images=[];d.catalog_options=[];d.product_variants[0].active=false;d.product_variants[0].name={ru:'Synthetic variant'};d.product_variants[0].production_variant_profiles=null;
 const draft=await save(d,'draft');assert.equal(draft.status,'draft');assert.equal(draft.product_variants[0].production_variant_profiles,null);
 await assert.rejects(save(draft,'published'),/catalog_translation_missing/);assert.deepEqual(await current(d.id),draft);
 const active=structuredClone(draft);active.product_variants[0].active=true;await assert.rejects(save(active,'draft'),/production_load_required/);assert.deepEqual(await current(d.id),draft);
}));

test('one validator protects every published related entity, storage metadata and owner/manager/anon boundaries',async()=>fixture(async({db,save,current,upload,as,rpc})=>{
 const d=document();await upload(d.product_images[0].storage_path);const saved=await save(d);
 const cases=[
  [x=>x.name.en='',/catalog_translation_missing/],[x=>x.description.th='',/catalog_translation_missing/],
  [x=>delete x.name.en,/catalog_translation_missing/],[x=>delete x.description.th,/catalog_translation_missing/],
  [x=>x.product_variants.forEach(v=>v.active=false),/catalog_active_variant_missing/],
  [x=>x.product_variants[0].name.th='',/catalog_variant_translation_missing/],
  [x=>delete x.product_variants[0].name.en,/catalog_variant_translation_missing/],
  [x=>x.catalog_options[0].label.en='',/catalog_option_translation_missing/],
  [x=>delete x.catalog_options[0].label.th,/catalog_option_translation_missing/],
  [x=>x.product_images[0].is_primary=false,/catalog_primary_image_missing/],
  [x=>x.product_images[0].alt.th='',/catalog_image_unavailable/],
  [x=>x.product_variants[0].production_variant_profiles=null,/catalog_profile_missing/]
 ];
 for(const [edit,error] of cases){const copy=structuredClone(saved);edit(copy);await assert.rejects(save(copy),error);assert.deepEqual(await current(d.id),saved);}
 const category=(await db.query("select * from public.catalog_categories where id='cake'")).rows[0];await assert.rejects(rpc('save_catalog_setting',{p_kind:'category',p_key:'cake',p_expected_version:category.catalog_version,p_value:{...category,active:false}}),/catalog_category_unavailable/);
 // Privileged maintenance still cannot leave a published card incomplete.
 await assert.rejects(as('service_role',()=>db.query("update public.product_variants set active=false where product_id=$1",[d.id])),/catalog_active_variant_missing/);
 await assert.rejects(as('service_role',()=>db.query("update public.products set description='{}' where id=$1",[d.id])),/catalog_translation_missing/);
 await assert.rejects(as('service_role',()=>db.query("update public.product_images set is_primary=false where product_id=$1",[d.id])),/catalog_primary_image_missing/);
 await assert.rejects(as('service_role',()=>db.query("update public.catalog_options set label='{}' where product_id=$1",[d.id])),/check constraint/);
 for(const role of ['anon','authenticated'])await as(role,async()=>{
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[role==='authenticated'?'22222222-2222-4222-8222-222222222222':'']);
  await assert.rejects(db.query('select public.save_catalog_product($1,$2,$3::jsonb,$4)',[d.id,saved.catalog_version,JSON.stringify(saved),'draft']),role==='anon'?/permission denied/:/Owner access required/);
 });
 await as('authenticated',async()=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  for(const table of ['products','product_variants','catalog_options','product_images','production_variant_profiles','catalog_categories','catalog_price_rules'])await assert.rejects(db.query('delete from public.'+table+' where false'),/permission denied/);
  await assert.rejects(db.query('select public.set_primary_product_image($1,$2)',[d.id,saved.product_images[0].id]),/permission denied/);
 });
}));

test('archive/restore and CAS settings preserve historical order snapshots, prices and production capacity',async()=>fixture(async({db,save,current,rpc})=>{
 const p=(await db.query("select id from public.products where slug='berry-cloud'")).rows[0].id;const original=await current(p);
 const submit=async day=>(await db.query("select * from public.receive_storefront_order($1,'website','en','Synthetic','qa@example.invalid','pickup','','pickup',$2::timestamptz,$2::timestamptz+interval '3 hours','','[{\"sku\":\"berry-cloud-1kg\",\"quantity\":1}]','[]',$3)",[crypto.randomUUID(),day+'T02:00:00Z','f'.repeat(64)])).rows[0];
 const first=await submit('2099-01-05');const before=(await db.query('select snapshot,load_units from public.order_items where order_id=$1',[first.order_id])).rows;
 const edited=structuredClone(original);edited.product_variants.find(v=>v.sku==='berry-cloud-1kg').price_minor=155000;let saved=await save(edited);const second=await submit('2099-01-06');assert.equal(Number(second.total_minor),155000);assert.deepEqual((await db.query('select snapshot,load_units from public.order_items where order_id=$1',[first.order_id])).rows,before);
 saved=await save(saved,'archived');await assert.rejects(submit('2099-01-07'),/catalog_item_unavailable/);saved=await save(saved,'draft');assert.equal(saved.status,'draft');saved=await save(saved,'published');assert.equal(saved.id,p);assert.deepEqual(saved.product_variants.map(v=>v.id).sort(),original.product_variants.map(v=>v.id).sort());assert.equal((await db.query('select production_load from public.orders where id=$1',[second.order_id])).rows[0].production_load,8);
 const r=(await db.query("select * from public.catalog_price_rules where rule_key='gift_box_base'")).rows[0];const params={p_kind:'price_rule',p_key:r.rule_key,p_expected_version:r.catalog_version,p_value:{amount_minor:r.amount_minor+100}};const changed=await rpc('save_catalog_setting',params);assert.ok(changed.catalog_version>r.catalog_version);await assert.rejects(rpc('save_catalog_setting',params),/catalog_conflict/);
 const category={p_kind:'category',p_key:'synthetic-gifts',p_expected_version:0,p_value:{name:words('Synthetic gifts'),active:true,sort_order:100}};
 const created=await rpc('save_catalog_setting',category);assert.ok(created.catalog_version>0);await assert.rejects(rpc('save_catalog_setting',category),/catalog_conflict/);
 saved.category='synthetic-gifts';saved=await save(saved);assert.equal(saved.category,'synthetic-gifts','category FK replaces the obsolete fixed-name check');
}));

test('actual owner UI uploads one candidate then commits metadata atomically; failure/unknown response never deletes current photos',async()=>fixture(async({db,save,current,upload,rpc})=>{
 const d=document();await upload(d.product_images[0].storage_path);let saved=await save(d),uploads=0,drop=false;
 const api={storage:{from:()=>({getPublicUrl:path=>({data:{publicUrl:path}}),upload:async path=>{uploads++;await upload(path);return {error:null};},remove:()=>assert.fail('no blob deletion, including unknown commit outcome')})},
  from:table=>({select:()=>({order:async()=>({error:null,data:table==='products'?[await current(d.id)]:(await db.query('select * from public.'+table)).rows})})}),
  rpc:async(name,params)=>{try{const data=await rpc(name,params);if(drop){drop=false;throw Error('Synthetic unknown outcome');}return {data,error:null};}catch(error){return {data:null,error};}}
 };
 const source=parse(readFileSync('components/admin/CatalogWorkspace.vue','utf8')).descriptor.scriptSetup.content.replace(/^import .*;\s*$/gm,'');
 const ctx={ref:vue.ref,reactive:vue.reactive,computed:vue.computed,toRaw:vue.toRaw,nextTick:vue.nextTick,onMounted:()=>{},defineProps:()=>({owner:true}),useNuxtApp:()=>({$supabase:api})};
 const ui=new Function(...Object.keys(ctx),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return {editing,file,photoAlt,saveProduct,makePrimary,error,candidatePath,conflict,reloadCurrent};')(...Object.values(ctx));
 ui.editing.value=structuredClone(saved);ui.file.value={type:'image/webp',size:100};Object.assign(ui.photoAlt,words('Synthetic candidate'));ui.editing.value.catalog_options[0].price_delta_minor=-1;
 assert.equal(await ui.saveProduct(),false);assert.equal(uploads,1);assert.ok(ui.candidatePath.value);assert.deepEqual(await current(d.id),saved);
 const candidate=ui.editing.value.product_images.at(-1);ui.makePrimary(candidate);assert.equal((await current(d.id)).product_images.find(i=>i.is_primary).id,saved.product_images[0].id,'primary selection only edits local draft');
 ui.editing.value.catalog_options[0].price_delta_minor=1000;drop=true;assert.equal(await ui.saveProduct(),false);assert.equal(uploads,1);assert.equal((await current(d.id)).product_images.find(i=>i.is_primary).id,candidate.id,'lost response can mean committed metadata');
 assert.equal(await ui.saveProduct(),false);assert.equal(ui.conflict.value,true);assert.match(ui.error.value,/Конфликт версий/);assert.equal(uploads,1);
 await ui.reloadCurrent();assert.equal(ui.conflict.value,false);assert.equal(ui.editing.value.product_images.find(i=>i.is_primary).id,candidate.id);assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='catalog-demo'")).rows[0].n,2);
}));
