import assert from 'node:assert/strict';
import {mockProvider} from './mock-provider.mjs';

let input='';
for await (const chunk of process.stdin) input+=chunk;
const {mode,jobs}=JSON.parse(input);
const base=process.env.LOCAL_RPC_URL;
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const env={
  SUPABASE_URL:base,
  SUPABASE_SECRET_KEYS:JSON.stringify({default:'local-server-key'}),
  NOTIFICATION_SEND_ENABLED:'true',
  RESEND_API_KEY:'local-mock-provider-key',
  ORDER_EMAIL_FROM:'local-mock@example.invalid',
  ORDER_EMAIL_MANAGER_TO:'local-manager@example.invalid',
};
globalThis.Deno={env:{get:name=>env[name]},serve:()=>{}};
const networkFetch=globalThis.fetch;
const provider=mockProvider({failFirst:mode==='parallel'});
globalThis.fetch=async(url,init)=>{
  if(url==='https://api.resend.com/emails')return provider.send(url,init);
  // Reject every other external request. Only disposable bridge RPC is reachable.
  assert.ok(url.startsWith(base+'/rest/v1/rpc/'),'unexpected network destination');
  assert.equal(init.headers.apikey,'local-server-key');
  return networkFetch(url,init);
};
try {
  const {handleRequest,processJob}=await import('../../supabase/functions/notification-worker/index.ts');
  const request=()=>new Request(base+'/notification-worker',{
    method:'POST',headers:{'x-blagova-worker-token':'local-fixture-only-'+'x'.repeat(48)},
  });
  let responses=[],outcomes=[];
  if(mode==='claimed'){
    outcomes=await Promise.all(jobs.map(job=>processJob(job,'local-server-key')));
  }else{
    const results=await Promise.all(Array.from({length:mode==='parallel'?2:1},()=>handleRequest(request())));
    for(const r of results){
      const body=await r.json();
      assert.ok(!JSON.stringify(body).includes('@'),'worker counters must not expose recipients');
      responses.push({status:r.status,body});
    }
  }
  process.stdout.write(JSON.stringify({responses,outcomes,provider_calls:provider.calls}));
}finally{
  globalThis.fetch=networkFetch;
  delete globalThis.Deno;
}
