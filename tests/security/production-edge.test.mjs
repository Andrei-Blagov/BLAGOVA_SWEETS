import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest as availability} from '../../supabase/functions/storefront-availability/index.ts';
import {handleRequest as order} from '../../supabase/functions/storefront-order/index.ts';
const origin='https://preview.blagovasweets.com';
const request=(body,method='POST',site=origin)=>new Request('https://example.test/intake',{method,headers:{origin:site,apikey:'client-test','Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});
const env={SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'client-test'}),SUPABASE_SECRET_KEYS:JSON.stringify({default:'server-test'}),SUPABASE_URL:'https://example.test'};
const install=()=>{globalThis.Deno={env:{get:n=>env[n]},serve:()=>{}};};
test('production APIs enforce CORS, preflight, method and client authentication',async()=>{
 for(const handler of [availability,order]){
  assert.equal((await handler(request({},'OPTIONS','https://attacker.example'))).status,403);
  const response=await handler(request({},'OPTIONS'));assert.equal(response.status,204);assert.equal(await response.text(),'');
  assert.equal((await handler(request({},'GET'))).status,405);
  install();const bad=request({});bad.headers.set('apikey','wrong');assert.equal((await handler(bad)).status,401);
 }
});
test('availability sends cart to protected RPC and maps server units; browser load is ignored by SQL',async()=>{
 install();const before=globalThis.fetch;let posted;
 globalThis.fetch=async(url,init)=>{assert.match(url,/get_storefront_cart_availability$/);posted=JSON.parse(init.body);assert.equal(init.headers.apikey,'server-test');return Response.json([{label:'09:00–12:00',capacity:32,used:24,available:true,requested_load:8}]);};
 try{const response=await availability(request({date:'2026-12-01',locale:'ru',items:[{sku:'berry-cloud-1kg',quantity:1,load_units:0}]}));assert.equal(response.status,200);assert.equal(posted.p_items[0].quantity,1);assert.equal(posted.p_locale,'ru');assert.equal(posted.p_rate_key.length,64);assert.deepEqual((await response.json()).slots[0],{label:'09:00–12:00',capacity:32,used:24,available:true,requestedLoad:8});}finally{globalThis.fetch=before;delete globalThis.Deno;}
});
test('availability rejects empty cart, excessive body and maps rate limit',async()=>{
 install();assert.equal((await availability(request({date:'2026-12-01',locale:'ru',items:[]}))).status,400);
 assert.equal((await availability(request({padding:'x'.repeat(33000)}))).status,413);
 const before=globalThis.fetch;globalThis.fetch=async()=>Response.json({message:'rate_limit'},{status:400});
 try{assert.equal((await availability(request({date:'2026-12-01',locale:'ru',items:[{sku:'berry-cloud-1kg',quantity:1}]}))).status,429);}finally{globalThis.fetch=before;delete globalThis.Deno;}
});
test('order ignores supplied unit price/load and accepts incomplete chat for staff assessment',async()=>{
 install();const before=globalThis.fetch;let posted;
 globalThis.fetch=async(url,init)=>{posted=JSON.parse(init.body);return Response.json([{order_id:'test',reference:'BLG-QA',duplicate:true,total_minor:145000,delivery_minor:0}]);};
 const input={requestKey:'12345678-1234-4234-8234-123456789012',source:'website',locale:'ru',customerName:'QA',customerContact:'qa@example.invalid',fulfillment:'pickup',deliveryZone:'pickup',scheduledStart:'2026-12-01T02:00:00Z',scheduledEnd:'2026-12-01T05:00:00Z',items:[{sku:'berry-cloud-1kg',quantity:1,price:1,load:0}]};
 try{const response=await order(request(input));assert.equal(response.status,200);assert.equal((await response.json()).totalMinor,145000);assert.equal(posted.p_items[0].price,undefined);assert.equal(posted.p_items[0].load,undefined);
  assert.equal((await order(request({...input,items:[]}))).status,400);assert.equal((await order(request({...input,source:'chat',items:[]}))).status,200);
 }finally{globalThis.fetch=before;delete globalThis.Deno;}
});

test('date-only rollback client uses the rate-limited cart RPC with explicit null cart',async()=>{
 install();const before=globalThis.fetch;let posted;globalThis.fetch=async(url,init)=>{posted=JSON.parse(init.body);assert.match(url,/get_storefront_cart_availability$/);return Response.json([]);};
 try{assert.equal((await availability(request({date:'2026-12-01'}))).status,200);assert.equal(posted.p_items,null);assert.equal(posted.p_rate_key.length,64);}finally{globalThis.fetch=before;delete globalThis.Deno;}
});
