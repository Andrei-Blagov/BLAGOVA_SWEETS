import type { Locale } from '~/data/atelier';
import { validOrderContact } from '~/supabase/functions/_shared/orderContact';

export type StorefrontOrderInput = {
  requestKey: string;
  recoveryToken?: string;
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
  messages?: Array<{ id: string; sender: 'customer' | 'assistant'; body: string }>;
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
  const chatTokens = useState<Record<string,string>>('intake-memory-tokens',()=>({}));
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
    const recoveryToken=input.recoveryToken||(chatTokens.value[input.requestKey] ||= Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''));
    const result=await call({...input,recoveryToken,...schedule(input.date,input.slot)});
    if(typeof result.summary?.reference!=='string')throw Error('invalid_receipt');
    return {...result,...result.summary} as SavedReceipt;
  }
  return { submitOrder,resolveIntent };
}

export type SavedReceipt={state:'saved';duplicate:boolean;reference:string;scheduledStart:string;scheduledEnd:string;totalMinor:number;deliveryMinor:number;items:Array<{sku:string;name:string;quantity:number;unitPriceMinor:number;lineTotalMinor:number}>};
