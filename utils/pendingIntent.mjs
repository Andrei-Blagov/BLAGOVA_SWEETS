export const pendingIntentStorageKey='blagova-checkout-intent-v1';
/** @typedef {{v:number,key:string,createdAt:number,expiresAt:number,expired?:boolean,token?:string,fingerprint?:string,cartFingerprint?:string}} PendingIntent */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function stableJson(value){
 if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stableJson(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export async function intentFingerprint(value){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableJson(value)));
 return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
}
/** @returns {PendingIntent|null} */
export function loadPendingIntent(storage,now=Date.now()){
 const raw=storage.getItem(pendingIntentStorageKey);if(!raw)return null;
 let p;try{p=JSON.parse(raw);}catch{throw Error('pending_storage_invalid');}
 if(p?.v!==1||!uuid.test(p.key)||!Number.isFinite(p.createdAt)||!Number.isFinite(p.expiresAt)||p.expiresAt-p.createdAt!==86400000)throw Error('pending_storage_invalid');
 if(p.expired||p.expiresAt<=now){
  const expired={v:1,key:p.key,createdAt:p.createdAt,expiresAt:p.expiresAt,expired:true};
  storage.setItem(pendingIntentStorageKey,JSON.stringify(expired));return expired;
 }
 if(!/^[0-9a-f]{64}$/.test(p.token)||!/^[0-9a-f]{64}$/.test(p.fingerprint)||!/^[0-9a-f]{64}$/.test(p.cartFingerprint))throw Error('pending_storage_invalid');
 return {v:1,key:p.key,token:p.token,fingerprint:p.fingerprint,cartFingerprint:p.cartFingerprint,createdAt:p.createdAt,expiresAt:p.expiresAt};
}
export async function createPendingIntent(storage,payload,cart){
 if(loadPendingIntent(storage))throw Error('intent_pending');
 const createdAt=Date.now();
 const p={v:1,key:crypto.randomUUID(),token:Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''),
 fingerprint:await intentFingerprint(payload),cartFingerprint:await intentFingerprint(cart),createdAt,expiresAt:createdAt+86400000};
 storage.setItem(pendingIntentStorageKey,JSON.stringify(p));return p;
}
export function clearPendingIntent(storage){storage.removeItem(pendingIntentStorageKey);}
