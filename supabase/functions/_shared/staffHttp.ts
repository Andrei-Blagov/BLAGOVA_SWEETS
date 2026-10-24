export const origins=new Set(['https://blagova-pattaya-atelier.blagovandrey1323.chatgpt.site','https://blagovasweets.com','https://www.blagovasweets.com','https://preview.blagovasweets.com','http://localhost:3000']);
export const cors=(origin:string)=>({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'});
export const reply=(origin:string,status:number,body:Record<string,unknown>)=>Response.json(body,{status,headers:{...(origin?cors(origin):{}),'Cache-Control':'no-store'}});
export async function rpc(name:string,body:Record<string,unknown>,key:string,authorization?:string){
 const response=await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,...(authorization?{Authorization:authorization}:{}),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const result=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(`${result?.code||'rpc_failed'}:${result?.message||''}`);
 return result;
}
export function serviceKey(){const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');return keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';}
export function failureReply(origin:string,error:unknown){const message=error instanceof Error?error.message:'';if(message.includes('42501'))return reply(origin,403,{error:'staff_access_required'});if(message.includes('slot_capacity_full'))return reply(origin,409,{error:'slot_capacity_full'});if(message.includes('slot_unavailable'))return reply(origin,409,{error:'slot_unavailable'});if(message.includes('40001'))return reply(origin,409,{error:'order_changed'});return reply(origin,400,{error:'order_action_failed'});}
declare const Deno:{env:{get(name:string):string|undefined}};
