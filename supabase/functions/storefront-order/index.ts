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

Deno.serve(async (req: Request) => {
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
    const raw = await req.json();
    const payload = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const source = text(payload.source, 10);
    const locale = text(payload.locale, 2);
    const fulfillment = text(payload.fulfillment, 10);
    const items: IntakeItem[] = Array.isArray(payload.items) ? payload.items.slice(0, 26).map((item: Record<string, unknown>) => ({
      name: text(item.name, 250),
      detail: text(item.detail, 500),
      quantity: Number(item.quantity),
      unit_price_minor: Math.round(Number(item.price) * 100),
    })) : [];
    const messages: IntakeMessage[] = Array.isArray(payload.messages) ? payload.messages.slice(-20).map((message: Record<string, unknown>) => ({
      id: text(message.id, 100),
      sender: message.sender === 'customer' ? 'customer' : 'assistant',
      body: text(message.body, 2500),
    })) : [];
    const start = new Date(text(payload.scheduledStart, 40));
    const end = new Date(text(payload.scheduledEnd, 40));
    const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(payload.requestKey, 36)) &&
      ['website','chat'].includes(source) && ['ru','en','th'].includes(locale) &&
      text(payload.customerName, 80).length > 0 && text(payload.customerContact, 120).length >= 3 &&
      ['pickup','delivery'].includes(fulfillment) && Number.isFinite(start.valueOf()) && Number.isFinite(end.valueOf()) &&
      items.length >= 1 && items.length <= 25 && items.every(item => item.name && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 20 && Number.isInteger(item.unit_price_minor) && item.unit_price_minor >= 0 && item.unit_price_minor <= 100000000) &&
      messages.every(message => message.body && ['customer','assistant'].includes(message.sender));
    if (!valid) return response(origin, 400, { error: 'invalid_request' });

    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
    const rateKey = await sha256(`${origin}|${forwarded}`);
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>;
    const secret = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const url = `${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/receive_storefront_order`;
    const db = await fetch(url, {
      method: 'POST',
      headers: { apikey: secret, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        p_request_key: payload.requestKey,
        p_source: source,
        p_locale: locale,
        p_customer_name: text(payload.customerName, 80),
        p_customer_contact: text(payload.customerContact, 120),
        p_fulfillment: fulfillment,
        p_delivery_address: text(payload.deliveryAddress, 200),
        p_delivery_minor: Math.round(Number(payload.delivery || 0) * 100),
        p_scheduled_start: start.toISOString(),
        p_scheduled_end: end.toISOString(),
        p_note: text(payload.note, 600),
        p_items: items,
        p_messages: messages,
        p_rate_key: rateKey,
      }),
    });
    const result = await db.json();
    if (!db.ok) {
      const detail = JSON.stringify(result);
      if (detail.includes('rate_limit')) return response(origin, 429, { error: 'rate_limit' });
      console.error('storefront_order_failed', db.status, result?.code || 'database_error');
      return response(origin, 400, { error: 'order_rejected' });
    }
    const row = Array.isArray(result) ? result[0] : result;
    return response(origin, 200, { reference: row.reference, duplicate: Boolean(row.duplicate) });
  } catch (error) {
    console.error('storefront_order_error', error instanceof Error ? error.message : 'unknown');
    return response(origin, 500, { error: 'service_unavailable' });
  }
});
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type IntakeItem = { name: string; detail: string; quantity: number; unit_price_minor: number };
type IntakeMessage = { id: string; sender: 'customer' | 'assistant'; body: string };
