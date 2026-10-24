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

export function corsHeaders(origin: string) {
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

function rejectedOrigin() {
  return Response.json({ error: 'origin_not_allowed' }, {
    status: 403,
    headers: {
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
    },
  });
}

const maxBodyBytes = 16384;

// Enforce bytes while streaming, including absent/false Content-Length. Cancel a
// stalled body; do not buffer an unbounded request before checking its size.
async function readBody(req: Request) {
  if (Number(req.headers.get('content-length') || 0) > maxBodyBytes) throw new Error('payload_too_large');
  const reader = req.body?.getReader();
  if (!reader) throw new Error('invalid_request');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new Error('body_timeout')); }, 5000);
    });
    const read = async () => {
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBodyBytes) { void reader.cancel().catch(() => {}); throw new Error('payload_too_large'); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    };
    return await Promise.race([read(), timeout]);
  } finally { if (timer) clearTimeout(timer); reader.releaseLock(); }
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function handleRequest(req: Request) {
  const origin = req.headers.get('origin') || '';
  if (!allowedOrigins.has(origin)) return rejectedOrigin();
  // 204 responses must not have a body. Response.json({}, { status: 204 }) throws
  // in the Edge Runtime before the CORS headers reach the browser.
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return response(origin, 405, { error: 'method_not_allowed' });

  try {
    const publishable = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}') as Record<string,string>;
    if (!Object.values(publishable).includes(req.headers.get('apikey') || '')) return response(origin, 401, { error: 'invalid_client' });
    let payload;
    try { payload = await readBody(req); }
    catch (error) {
      const code = error instanceof Error ? error.message : '';
      return response(origin, code === 'payload_too_large' ? 413 : code === 'body_timeout' ? 408 : 400,
        { error: ['payload_too_large','body_timeout'].includes(code) ? code : 'invalid_request' });
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return response(origin, 400, { error: 'invalid_request' });
    const action = payload.action;
    const token = typeof payload.token === 'string' ? payload.token : '';
    const locale = payload.locale ?? 'ru';
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!['start','poll','send'].includes(action) || !uuid.test(token) || !['ru','en','th'].includes(locale)) {
      return response(origin, 400, { error: 'invalid_request' });
    }

    // Reject rather than silently accepting forged server fields or role claims.
    const fields = new Set(['action','token','locale','customerBody','customerMessageId','requestManager']);
    if (Object.keys(payload).some(key => !fields.has(key))) return response(origin, 400, { error: 'invalid_request' });
    if (payload.requestManager !== undefined && typeof payload.requestManager !== 'boolean') return response(origin, 400, { error: 'invalid_request' });
    const customerBody = typeof payload.customerBody === 'string' ? payload.customerBody.trim() : '';
    const customerMessageId = typeof payload.customerMessageId === 'string' ? payload.customerMessageId : '';
    if (action === 'send' && (!uuid.test(customerMessageId) || (!customerBody && !payload.requestManager) || customerBody.length > 2500 || (payload.customerBody !== undefined && typeof payload.customerBody !== 'string'))) return response(origin, 400, { error: 'invalid_customer_message' });
    if (action !== 'send' && (payload.customerBody !== undefined || payload.customerMessageId !== undefined || payload.requestManager !== undefined)) return response(origin, 400, { error: 'invalid_request' });

    const tokenHash = await sha256(token);
    // No verified ingress/header rewriting contract is available. SQL uses a
    // fixed application-wide budget plus token budgets, never a claimed IP.
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string,string>;
    const secret = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const db = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/storefront_chat_action`, {
      method: 'POST',
      headers: { apikey: secret, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        p_action: action,
        p_token_hash: tokenHash,
        p_locale: locale,
        p_customer_message_id: action === 'send' ? customerMessageId : null,
        p_customer_body: customerBody || null,
        p_request_manager: Boolean(payload.requestManager),
      }),
    });
    const result = await db.json();
    if (!db.ok || result.error) {
      const detail = result.error || '';
      if (detail === 'rate_limit') return new Response(JSON.stringify({error:'rate_limit',retryAfterSeconds:result.retryAfterSeconds}), {status:429,headers:{...corsHeaders(origin),'Content-Type':'application/json','Retry-After':String(result.retryAfterSeconds || 60)}});
      if (detail === 'session_expired') return response(origin, 401, { error: 'session_expired' });
      if (['message_conflict','conversation_closed'].includes(detail)) return response(origin, 409, { error: detail });
      console.error('storefront_chat_failed', db.status, result?.code || 'database_error');
      return response(origin, 400, { error: 'chat_rejected' });
    }
    return response(origin, 200, result);
  } catch (error) {
    console.error('storefront_chat_error', error instanceof Error ? error.name : 'unknown');
    return response(origin, 500, { error: 'service_unavailable' });
  }
}

if (typeof Deno !== 'undefined') Deno.serve(handleRequest);
