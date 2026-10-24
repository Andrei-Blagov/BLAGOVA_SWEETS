import { validOrderContact } from '../_shared/orderContact.ts';

const allowedOrigins = new Set([
  'https://blagova-pattaya-atelier.blagovandrey1323.chatgpt.site',
  'https://blagovasweets.com',
  'https://www.blagovasweets.com',
  'https://preview.blagovasweets.com',
  'http://localhost:3000',
  'http://terminal.local:4173',
]);

function response(origin: string, status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
    },
  });
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function handleRequest(req: Request): Promise<Response> {
  const origin = req.headers.get('origin') || '';
  if (!allowedOrigins.has(origin)) return Response.json({ error: 'origin_not_allowed' }, { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    },
  });
  if (req.method !== 'POST') return response(origin, 405, { error: 'method_not_allowed' });
  if (Number(req.headers.get('content-length') || 0) > 50000) return response(origin, 413, { error: 'payload_too_large' });

  try {
    const publishable = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}') as Record<string, string>;
    if (!Object.values(publishable).includes(req.headers.get('apikey') || '')) return response(origin, 401, { error: 'invalid_client' });
    const rawText=await req.text();
    if(rawText.length>50000) return response(origin,413,{error:'payload_too_large'});
    const raw = JSON.parse(rawText);
    const payload = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const requestKey=typeof payload.requestKey==='string'?payload.requestKey:'';
    const recoveryToken=typeof payload.recoveryToken==='string'?payload.recoveryToken:'';
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)||!/^[0-9a-f]{64}$/.test(recoveryToken))return response(origin,400,{error:'invalid_intent'});
    const tokenHash=await sha256(recoveryToken);
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
    const rateKey = await sha256(`${origin}|${forwarded}`);
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>;
    const secret = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if(payload.action==='resolve'||payload.action==='close'){
      const lookup=await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/resolve_storefront_intent`,{
        method:'POST',headers:{apikey:secret,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),
        body:JSON.stringify({p_request_key:requestKey,p_token_hash:tokenHash,p_close:payload.action==='close',p_rate_key:rateKey})
      });
      const result=await lookup.json();
      if(!lookup.ok)return response(origin,JSON.stringify(result).includes('rate_limit')?429:404,{error:JSON.stringify(result).includes('rate_limit')?'rate_limit':'intent_unavailable'});
      return response(origin,200,result);
    }
    if(payload.action!==undefined&&payload.action!=='submit')return response(origin,400,{error:'invalid_intent'});
    const source = text(payload.source, 10);
    const locale = text(payload.locale, 2);
    const fulfillment = text(payload.fulfillment, 10);
    const customerName = text(payload.customerName, 80);
    const customerContact = text(payload.customerContact, 120);
    const deliveryAddress = text(payload.deliveryAddress, 200);
    const note = text(payload.note, 600);
    const deliveryZone = text(payload.deliveryZone, 20);
    // Chat history is read from server sessions, never imported from a browser
    // order payload under an assistant/manager role.
    if (payload.messages !== undefined && (!Array.isArray(payload.messages) || payload.messages.length !== 0)) return response(origin,400,{error:'invalid_request'});
    const items: IntakeItem[] = Array.isArray(payload.items) ? payload.items.slice(0, 26).map((item: Record<string, unknown>) => ({
      sku: text(item.sku, 100),
      personalization: text(item.personalization, 80),
      description: text(item.description, 500),
      configuration: item.configuration && typeof item.configuration === 'object' && !Array.isArray(item.configuration) ? item.configuration as Record<string, unknown> : {},
      quantity: Number(item.quantity),
    })) : [];
    const messages: IntakeMessage[] = Array.isArray(payload.messages) ? payload.messages.slice(-20).map((message: Record<string, unknown>) => ({
      id: text(message.id, 100),
      sender: message.sender === 'customer' ? 'customer' : 'assistant',
      body: text(message.body, 2500),
    })) : [];
    const chatSessionToken = text(payload.chatSessionToken, 100);
    const start = new Date(text(payload.scheduledStart, 40));
    const end = new Date(text(payload.scheduledEnd, 40));
    const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(payload.requestKey, 36)) &&
      ['website','chat'].includes(source) && ['ru','en','th'].includes(locale) &&
      customerName.length > 0 && validOrderContact(customerContact) &&
      ['pickup','delivery'].includes(fulfillment) && Number.isFinite(start.valueOf()) && Number.isFinite(end.valueOf()) &&
      (fulfillment === 'pickup' ? deliveryZone === 'pickup' : ['central','jomtien'].includes(deliveryZone)) &&
      (items.length >= 1 || source === 'chat') && items.length <= 25 && items.every(item => /^[a-z0-9][a-z0-9_-]{2,99}$/.test(item.sku) && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 100) &&
      messages.every(message => message.body && ['customer','assistant'].includes(message.sender));
    if (!valid) return response(origin, 400, { error: 'invalid_request' });

    const url = `${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/submit_storefront_intent`;
    const db = await fetch(url, {
      method: 'POST',
      headers: { apikey: secret, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      signal:AbortSignal.timeout(15000),
      body: JSON.stringify({
        p_request_key: requestKey,
        p_token_hash:tokenHash,
        p_payload:{source,locale,customerName,customerContact,fulfillment,deliveryAddress,deliveryZone,
          scheduledStart:start.toISOString(),scheduledEnd:end.toISOString(),note,items,messages},
        p_rate_key: rateKey,
      }),
    });
    const result = await db.json();
    if (!db.ok) {
      const detail = JSON.stringify(result);
      if(detail.includes('intent_payload_conflict'))return response(origin,409,{error:'intent_payload_conflict'});
      if(detail.includes('intent_closed'))return response(origin,409,{error:'intent_closed'});
      if(detail.includes('intent_unavailable'))return response(origin,404,{error:'intent_unavailable'});
      if (detail.includes('rate_limit')) return response(origin, 429, { error: 'rate_limit' });
      if (detail.includes('slot_capacity_full')) return response(origin, 409, { error: 'slot_capacity_full' });
      if (detail.includes('slot_unavailable')) return response(origin, 409, { error: 'slot_unavailable' });
      if (detail.includes('production_load_required')) return response(origin,409,{error:'production_load_required'});
      if (detail.includes('lead_time_unavailable')) return response(origin, 409, { error: 'lead_time_unavailable' });
      console.error('storefront_order_failed', db.status, result?.code || 'database_error');
      return response(origin, 400, { error: 'order_rejected' });
    }
    const summary=result.summary;
    const row={order_id:result.internalOrderId,reference:summary.reference,duplicate:result.duplicate,
      delivery_minor:summary.deliveryMinor,total_minor:summary.totalMinor,
      items:summary.items.map((i:{name:string;quantity:number;unitPriceMinor:number})=>({name:i.name,detail:'',quantity:i.quantity,unit_price_minor:i.unitPriceMinor}))};
    if (chatSessionToken) {
      try {
        const tokenHash = await sha256(chatSessionToken);
        const linked = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/attach_storefront_order_chat`, {
          method: 'POST',
          headers: { apikey: secret, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_order_id: row.order_id, p_token_hash: tokenHash }),
        });
        if (!linked.ok) console.error('storefront_order_chat_link_failed', linked.status);
      } catch (error) {
        console.error('storefront_order_chat_link_unavailable', error instanceof Error ? error.name : 'unknown');
      }
    }
    return response(origin, 200, {
      state:'saved',summary,
      reference: row.reference,
      duplicate: Boolean(row.duplicate),
      deliveryMinor: Number(row.delivery_minor),
      totalMinor: Number(row.total_minor),
    });
  } catch (error) {
    console.error('storefront_order_error', error instanceof Error ? error.name : 'unknown');
    return response(origin, 500, { error: 'service_unavailable' });
  }
}
if (typeof Deno !== 'undefined') Deno.serve(handleRequest);
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type IntakeItem = { sku: string; personalization: string; description: string; configuration: Record<string, unknown>; quantity: number };
type IntakeMessage = { id: string; sender: 'customer' | 'assistant'; body: string };
