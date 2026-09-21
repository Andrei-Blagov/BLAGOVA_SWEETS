const allowedOrigins = new Set([
  'https://blagova-pattaya-atelier.blagovandrey1323.chatgpt.site',
  'https://blagovasweets.com',
  'https://www.blagovasweets.com',
  'https://preview.blagovasweets.com',
  'http://localhost:3000',
  'http://terminal.local:4173',
]);

function response(origin: string, status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  }});
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  if (!allowedOrigins.has(origin)) return Response.json({ error: 'origin_not_allowed' }, { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }});
  if (req.method !== 'POST') return response(origin, 405, { error: 'method_not_allowed' });
  try {
    const publishable = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}') as Record<string,string>;
    if (!Object.values(publishable).includes(req.headers.get('apikey') || '')) return response(origin, 401, { error: 'invalid_client' });
    const payload = await req.json();
    const date = typeof payload?.date === 'string' ? payload.date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return response(origin, 400, { error: 'invalid_date' });
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string,string>;
    const secret = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const db = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/get_storefront_availability`, {
      method: 'POST', headers: { apikey: secret, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_date: date }),
    });
    const slots = await db.json().catch(() => []);
    if (!db.ok) return response(origin, 503, { error: 'availability_unavailable' });
    return response(origin, 200, { slots: slots.map((slot: Record<string,unknown>) => ({
      label: slot.label,
      capacity: Number(slot.capacity),
      used: Number(slot.used),
      available: Boolean(slot.available),
    })) });
  } catch {
    return response(origin, 503, { error: 'availability_unavailable' });
  }
});

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
