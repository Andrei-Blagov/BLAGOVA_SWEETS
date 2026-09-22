declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const allowedOrigins = new Set([
  'https://blagova-pattaya-atelier.blagovandrey1323.chatgpt.site',
  'https://blagovasweets.com',
  'https://www.blagovasweets.com',
  'https://preview.blagovasweets.com',
  'http://localhost:3000',
  'http://terminal.local:4173',
]);

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}

function response(origin: string, status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: corsHeaders(origin) });
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
  if (!allowedOrigins.has(origin)) return response('null', 403, { error: 'origin_not_allowed' });
  // 204 responses must not have a body. Response.json({}, { status: 204 }) throws
  // in the Edge Runtime before the CORS headers reach the browser.
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return response(origin, 405, { error: 'method_not_allowed' });

  try {
    const payload = await req.json();
    const action = text(payload.action, 10);
    const token = text(payload.token, 100);
    const locale = text(payload.locale, 2) || 'ru';
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!['start','poll','send'].includes(action) || !uuid.test(token) || !['ru','en','th'].includes(locale)) {
      return response(origin, 400, { error: 'invalid_request' });
    }

    const customerBody = text(payload.customerBody, 2500);
    const assistantBody = text(payload.assistantBody, 2500);
    const customerMessageId = text(payload.customerMessageId, 36);
    const assistantMessageId = text(payload.assistantMessageId, 36);
    if (action === 'send' && !customerBody && !assistantBody) return response(origin, 400, { error: 'empty_message' });
    if (customerBody && !uuid.test(customerMessageId)) return response(origin, 400, { error: 'invalid_customer_message' });
    if (assistantBody && !uuid.test(assistantMessageId)) return response(origin, 400, { error: 'invalid_assistant_message' });

    const tokenHash = await sha256(token);
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
    const rateKey = action === 'send' ? await sha256(`${origin}|${forwarded}|${tokenHash}`) : null;
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string,string>;
    const secret = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const db = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/storefront_chat_action`, {
      method: 'POST',
      headers: { apikey: secret, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        p_action: action,
        p_token_hash: tokenHash,
        p_locale: locale,
        p_rate_key: rateKey,
        p_customer_message_id: customerBody ? customerMessageId : null,
        p_customer_body: customerBody || null,
        p_assistant_message_id: assistantBody ? assistantMessageId : null,
        p_assistant_body: assistantBody || null,
        p_assistant_source: text(payload.assistantSource, 250) || null,
        p_request_manager: Boolean(payload.requestManager),
      }),
    });
    const result = await db.json();
    if (!db.ok) {
      const detail = JSON.stringify(result);
      if (detail.includes('rate_limit')) return response(origin, 429, { error: 'rate_limit' });
      if (detail.includes('chat_session_missing')) return response(origin, 401, { error: 'session_expired' });
      console.error('storefront_chat_failed', db.status, result?.code || 'database_error');
      return response(origin, 400, { error: 'chat_rejected' });
    }
    return response(origin, 200, result);
  } catch (error) {
    console.error('storefront_chat_error', error instanceof Error ? error.message : 'unknown');
    return response(origin, 500, { error: 'service_unavailable' });
  }
});
