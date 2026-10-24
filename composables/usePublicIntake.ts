import type { Locale } from '~/data/atelier';
import { validOrderContact } from '~/supabase/functions/_shared/orderContact';

export type StorefrontOrderInput = {
  requestKey: string;
  recoveryToken: string;
  source: 'website' | 'chat';
  locale: Locale;
  customerName: string;
  customerContact: string;
  date: string;
  slot: string;
  fulfillment: 'pickup' | 'delivery';
  deliveryAddress: string;
  deliveryZone: 'pickup' | 'central' | 'jomtien';
  note: string;
  items: Array<{ sku: string; personalization: string; description: string; configuration: Record<string, string | number | boolean | Record<string,string>>; quantity: number }>;
  messages?: never[];
  chatSessionToken?: string;
};

function schedule(date: string, slot: string) {
  const [start, end] = slot.split('–');
  if (!start || !end) throw new Error('invalid_request');
  return {
    scheduledStart: new Date(`${date}T${start}:00+07:00`).toISOString(),
    scheduledEnd: new Date(`${date}T${end}:00+07:00`).toISOString(),
  };
}

export function usePublicIntake() {
  const config = useRuntimeConfig();
  async function call(body:Record<string,unknown>){
    const response=await fetch(`${config.public.supabaseUrl}/functions/v1/storefront-order`,{
      method:'POST',headers:{apikey:config.public.supabasePublishableKey,'Content-Type':'application/json'},
      body:JSON.stringify(body),signal:AbortSignal.timeout(20000)
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(response.status===429?'rate_limit':result.error||'service_unavailable');
    return result;
  }
  async function resolveIntent(key:string,token:string,close=false){
    return call({action:close?'close':'resolve',requestKey:key,recoveryToken:token});
  }
  async function submitOrder(input: StorefrontOrderInput) {
    if (!validOrderContact(input.customerContact)) throw new Error('invalid_contact');
    // Every caller must own a recoverable pending intent before sending. Never
    // silently pair an old key/token with the caller's newly edited payload.
    if(!/^[0-9a-f]{64}$/.test(input.recoveryToken||''))throw Error('invalid_intent');
    const result=await call({...input,...schedule(input.date,input.slot)});
    if(typeof result.summary?.reference!=='string')throw Error('invalid_receipt');
    return {...result,...result.summary} as SavedReceipt;
  }
  return { submitOrder,resolveIntent };
}

export type SavedReceipt={state:'saved';duplicate:boolean;reference:string;scheduledStart:string;scheduledEnd:string;totalMinor:number;deliveryMinor:number;items:Array<{sku:string;name:string;quantity:number;unitPriceMinor:number;lineTotalMinor:number}>};
