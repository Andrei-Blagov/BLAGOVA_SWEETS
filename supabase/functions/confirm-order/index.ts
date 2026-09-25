const allowedOrigins = new Set([
  'https://blagova-pattaya-atelier.blagovandrey1323.chatgpt.site',
  'https://blagovasweets.com',
  'https://www.blagovasweets.com',
  'https://preview.blagovasweets.com',
  'http://localhost:3000',
]);

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

function reply(origin: string, status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { ...corsHeaders(origin), 'Cache-Control': 'no-store' } });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character] || character));
}

function emailFromContact(value: string) {
  return value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0].toLowerCase() || '';
}

function formatMoney(minor: number) {
  return `฿${new Intl.NumberFormat('en-US').format(minor / 100)}`;
}

function formatSchedule(start: Date, end: Date, locale: string) {
  const language = locale === 'th' ? 'th-TH' : locale === 'en' ? 'en-GB' : 'ru-RU';
  const date = new Intl.DateTimeFormat(language, {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric',
  }).format(start);
  const time = new Intl.DateTimeFormat(language, {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return `${date}, ${time.format(start)}–${time.format(end)}`;
}

async function rpc(name: string, body: Record<string, unknown>, key: string, authorization?: string) {
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      ...(authorization ? { Authorization: authorization } : {}),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${name}_${response.status}_${result?.code || 'error'}`);
  return result;
}

function emailCopy(order: ConfirmationOrder, schedule: string, itemLines: string[], total: string) {
  const safeItems = itemLines.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const fulfillmentRu = order.fulfillment === 'delivery'
    ? `Доставка${order.delivery_address ? `: ${order.delivery_address}` : ''}`
    : 'Самовывоз';
  if (order.locale === 'en') return {
    subject: `Order ${order.reference} confirmed`,
    text: `Hello ${order.customer_name}. Your order ${order.reference} is confirmed for ${schedule}.\n${itemLines.join('\n')}\nTotal: ${total}\nCollection: ${order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}.`,
    html: `<h2>Your order is confirmed</h2><p>Hello, ${escapeHtml(order.customer_name)}. Order <strong>${escapeHtml(order.reference)}</strong> is confirmed for ${escapeHtml(schedule)}.</p><ul>${safeItems}</ul><p><strong>Total: ${escapeHtml(total)}</strong></p><p>${order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}</p>`,
  };
  if (order.locale === 'th') return {
    subject: `ยืนยันออเดอร์ ${order.reference} แล้ว`,
    text: `สวัสดี ${order.customer_name} ยืนยันออเดอร์ ${order.reference} สำหรับ ${schedule} แล้ว\n${itemLines.join('\n')}\nยอดรวม: ${total}`,
    html: `<h2>ยืนยันออเดอร์แล้ว</h2><p>สวัสดี ${escapeHtml(order.customer_name)} ออเดอร์ <strong>${escapeHtml(order.reference)}</strong> สำหรับ ${escapeHtml(schedule)} ได้รับการยืนยันแล้ว</p><ul>${safeItems}</ul><p><strong>ยอดรวม: ${escapeHtml(total)}</strong></p>`,
  };
  return {
    subject: `Заказ ${order.reference} подтверждён`,
    text: `Здравствуйте, ${order.customer_name}. Заказ ${order.reference} подтверждён на ${schedule}.\n${itemLines.join('\n')}\nИтого: ${total}\nПолучение: ${fulfillmentRu}.`,
    html: `<h2>Заказ подтверждён</h2><p>Здравствуйте, ${escapeHtml(order.customer_name)}. Заказ <strong>${escapeHtml(order.reference)}</strong> подтверждён на ${escapeHtml(schedule)}.</p><ul>${safeItems}</ul><p><strong>Итого: ${escapeHtml(total)}</strong></p><p><strong>Получение:</strong> ${escapeHtml(fulfillmentRu)}</p>`,
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  if (!allowedOrigins.has(origin)) return Response.json({ error: 'origin_not_allowed' }, { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return reply(origin, 405, { error: 'method_not_allowed' });

  try {
    const authorization = req.headers.get('authorization') || '';
    const publishable = req.headers.get('apikey') || '';
    if (!authorization.startsWith('Bearer ') || !publishable) return reply(origin, 401, { error: 'authentication_required' });
    const payload = await req.json();
    const orderId = typeof payload?.orderId === 'string' ? payload.orderId : '';
    const revision = Number(payload?.revision);
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || !Number.isInteger(revision) || revision < 1) {
      return reply(origin, 400, { error: 'invalid_request' });
    }

    const order = await rpc('staff_confirm_order', { p_order_id: orderId, p_revision: revision }, publishable, authorization) as ConfirmationOrder;
    if (order.notification_status === 'sent') return reply(origin, 200, { status: 'sent', reference: order.reference });
    if (order.notification_status === 'manual_required') return reply(origin, 200, { status: 'manual_required', reference: order.reference });

    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>;
    const secret = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!secret) throw new Error('service_key_missing');
    const claimed = await rpc('claim_order_confirmation', { p_order_id: orderId }, secret) as boolean;
    if (!claimed) return reply(origin, 202, { status: 'sending', reference: order.reference });

    const customerEmail = emailFromContact(order.customer_contact);
    if (!customerEmail) {
      await rpc('complete_order_confirmation', {
        p_order_id: orderId, p_status: 'manual_required', p_provider_message_id: null, p_error: 'customer_email_missing',
      }, secret);
      return reply(origin, 200, { status: 'manual_required', reference: order.reference });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY') || '';
    const from = Deno.env.get('ORDER_EMAIL_FROM') || '';
    if (!resendKey || !from) throw new Error('email_not_configured');
    const schedule = formatSchedule(new Date(order.scheduled_start), new Date(order.scheduled_end), order.locale);
    const totalMinor = order.items.reduce((sum, item) => sum + item.unit_price_minor * item.quantity, order.delivery_minor);
    const itemLines = order.items.map(item => `${item.name} × ${item.quantity} — ${formatMoney(item.unit_price_minor * item.quantity)}`);
    const copy = emailCopy(order, schedule, itemLines, formatMoney(totalMinor));
    const managerEmail = Deno.env.get('ORDER_EMAIL_MANAGER_TO') || 'blagovandrey1323@gmail.com';
    const mail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `order-confirmed/${orderId}/customer`,
      },
      body: JSON.stringify({
        from, to: [customerEmail], reply_to: managerEmail,
        subject: copy.subject, html: copy.html, text: copy.text,
      }),
    });
    const mailResult = await mail.json().catch(() => ({}));
    if (!mail.ok) {
      await rpc('complete_order_confirmation', {
        p_order_id: orderId, p_status: 'failed', p_provider_message_id: null, p_error: `provider_${mail.status}`,
      }, secret);
      console.error('confirmation_email_failed', mail.status);
      return reply(origin, 502, { error: 'email_delivery_failed', status: 'failed', reference: order.reference });
    }
    await rpc('complete_order_confirmation', {
      p_order_id: orderId, p_status: 'sent', p_provider_message_id: mailResult.id || null, p_error: null,
    }, secret);
    return reply(origin, 200, { status: 'sent', reference: order.reference });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('confirm_order_failed', message);
    if (message.includes('slot_capacity_full')) return reply(origin, 409, { error: 'slot_capacity_full' });
    if (message.includes('slot_unavailable')) return reply(origin, 409, { error: 'slot_unavailable' });
    return reply(origin, 400, { error: 'confirmation_failed' });
  }
});

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type ConfirmationItem = { name: string; detail: string; quantity: number; unit_price_minor: number };
type ConfirmationOrder = {
  order_id: string;
  reference: string;
  revision: number;
  status: string;
  customer_name: string;
  customer_contact: string;
  locale: string;
  fulfillment: string;
  delivery_address: string | null;
  delivery_minor: number;
  scheduled_start: string;
  scheduled_end: string;
  notification_status: string;
  items: ConfirmationItem[];
};
