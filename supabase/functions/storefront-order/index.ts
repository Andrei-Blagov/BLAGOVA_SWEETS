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

async function sendEmail(input: EmailInput) {
  const apiKey = Deno.env.get('RESEND_API_KEY') || '';
  const from = Deno.env.get('ORDER_EMAIL_FROM') || '';
  if (!apiKey || !from) return { sent: false, reason: 'not_configured' };
  const mail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      reply_to: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  if (!mail.ok) {
    console.error('order_email_provider_failed', mail.status);
    return { sent: false, reason: `provider_${mail.status}` };
  }
  return { sent: true };
}

async function notifyOrder(input: NotificationInput) {
  const managerEmail = Deno.env.get('ORDER_EMAIL_MANAGER_TO') || 'blagovandrey1323@gmail.com';
  const customerEmail = emailFromContact(input.customerContact);
  const schedule = formatSchedule(input.start, input.end, input.locale);
  const totalMinor = input.items.reduce((sum, item) => sum + item.unit_price_minor * item.quantity, input.deliveryMinor);
  const itemLines = input.items.map(item => `${item.name} × ${item.quantity} — ${formatMoney(item.unit_price_minor * item.quantity)}`);
  const itemsHtml = input.items.map(item => `<li>${escapeHtml(item.name)} × ${item.quantity} — ${escapeHtml(formatMoney(item.unit_price_minor * item.quantity))}</li>`).join('');
  const fulfillment = input.fulfillment === 'delivery' ? 'Доставка' : 'Самовывоз';
  const managerText = [
    `Новая тестовая заявка ${input.reference}`,
    `Клиент: ${input.customerName}`,
    `Контакт: ${input.customerContact}`,
    `Дата: ${schedule}`,
    `Получение: ${fulfillment}`,
    input.deliveryAddress ? `Адрес: ${input.deliveryAddress}` : '',
    ...itemLines,
    `Итого: ${formatMoney(totalMinor)}`,
    input.note ? `Комментарий: ${input.note}` : '',
  ].filter(Boolean).join('\n');
  const managerHtml = `<h2>Новая тестовая заявка ${escapeHtml(input.reference)}</h2>
    <p><strong>Клиент:</strong> ${escapeHtml(input.customerName)}<br>
    <strong>Контакт:</strong> ${escapeHtml(input.customerContact)}<br>
    <strong>Дата:</strong> ${escapeHtml(schedule)}<br>
    <strong>Получение:</strong> ${fulfillment}</p>
    ${input.deliveryAddress ? `<p><strong>Адрес:</strong> ${escapeHtml(input.deliveryAddress)}</p>` : ''}
    <ul>${itemsHtml}</ul><p><strong>Итого: ${escapeHtml(formatMoney(totalMinor))}</strong></p>
    ${input.note ? `<p><strong>Комментарий:</strong> ${escapeHtml(input.note)}</p>` : ''}
    <p>Заявка ожидает проверки в админке BLAGOVA SWEETS.</p>`;

  const requests: Promise<{ sent: boolean; reason?: string }>[] = [sendEmail({
    to: managerEmail,
    replyTo: customerEmail || undefined,
    subject: `Новая заявка ${input.reference} · ${input.customerName}`,
    html: managerHtml,
    text: managerText,
    idempotencyKey: `order-created/${input.orderId}/manager`,
  })];

  if (customerEmail) {
    const copy = customerCopy(input.locale, input.reference, input.customerName, schedule, itemLines, formatMoney(totalMinor));
    requests.push(sendEmail({
      to: customerEmail,
      replyTo: managerEmail,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      idempotencyKey: `order-created/${input.orderId}/customer`,
    }));
  }
  const results = await Promise.all(requests);
  const failed = results.filter(result => !result.sent);
  if (failed.length) console.warn('order_email_incomplete', failed.map(result => result.reason).join(','));
}

function customerCopy(locale: string, reference: string, name: string, schedule: string, items: string[], total: string) {
  const safeItems = items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  if (locale === 'en') return {
    subject: `We received your request ${reference}`,
    text: `Hello ${name}. We received request ${reference} for ${schedule}.\n${items.join('\n')}\nTotal: ${total}\nThis is not a confirmed production order yet. A manager will contact you after review.`,
    html: `<h2>Thank you, ${escapeHtml(name)}</h2><p>We received request <strong>${escapeHtml(reference)}</strong> for ${escapeHtml(schedule)}.</p><ul>${safeItems}</ul><p><strong>Total: ${escapeHtml(total)}</strong></p><p>This is not a confirmed production order yet. A manager will contact you after review.</p>`,
  };
  if (locale === 'th') return {
    subject: `เราได้รับคำขอของคุณ ${reference}`,
    text: `สวัสดี ${name} เราได้รับคำขอ ${reference} สำหรับ ${schedule}\n${items.join('\n')}\nยอดรวม: ${total}\nคำขอนี้ยังไม่ใช่ออเดอร์ที่ยืนยัน ผู้จัดการจะติดต่อกลับหลังตรวจสอบ`,
    html: `<h2>ขอบคุณ ${escapeHtml(name)}</h2><p>เราได้รับคำขอ <strong>${escapeHtml(reference)}</strong> สำหรับ ${escapeHtml(schedule)}</p><ul>${safeItems}</ul><p><strong>ยอดรวม: ${escapeHtml(total)}</strong></p><p>คำขอนี้ยังไม่ใช่ออเดอร์ที่ยืนยัน ผู้จัดการจะติดต่อกลับหลังตรวจสอบ</p>`,
  };
  return {
    subject: `Мы получили вашу заявку ${reference}`,
    text: `Здравствуйте, ${name}. Мы получили заявку ${reference} на ${schedule}.\n${items.join('\n')}\nИтого: ${total}\nЭто ещё не подтверждённый производством заказ. Менеджер свяжется с вами после проверки.`,
    html: `<h2>Спасибо, ${escapeHtml(name)}</h2><p>Мы получили заявку <strong>${escapeHtml(reference)}</strong> на ${escapeHtml(schedule)}.</p><ul>${safeItems}</ul><p><strong>Итого: ${escapeHtml(total)}</strong></p><p>Это ещё не подтверждённый производством заказ. Менеджер свяжется с вами после проверки.</p>`,
  };
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
    const customerName = text(payload.customerName, 80);
    const customerContact = text(payload.customerContact, 120);
    const deliveryAddress = text(payload.deliveryAddress, 200);
    const note = text(payload.note, 600);
    const deliveryZone = text(payload.deliveryZone, 20);
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
      customerName.length > 0 && customerContact.length >= 3 &&
      ['pickup','delivery'].includes(fulfillment) && Number.isFinite(start.valueOf()) && Number.isFinite(end.valueOf()) &&
      (fulfillment === 'pickup' ? deliveryZone === 'pickup' : ['central','jomtien'].includes(deliveryZone)) &&
      items.length >= 1 && items.length <= 25 && items.every(item => /^[a-z0-9][a-z0-9_-]{2,99}$/.test(item.sku) && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 20) &&
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
        p_customer_name: customerName,
        p_customer_contact: customerContact,
        p_fulfillment: fulfillment,
        p_delivery_address: deliveryAddress,
        p_delivery_zone: deliveryZone,
        p_scheduled_start: start.toISOString(),
        p_scheduled_end: end.toISOString(),
        p_note: note,
        p_items: items,
        p_messages: messages,
        p_rate_key: rateKey,
      }),
    });
    const result = await db.json();
    if (!db.ok) {
      const detail = JSON.stringify(result);
      if (detail.includes('rate_limit')) return response(origin, 429, { error: 'rate_limit' });
      if (detail.includes('slot_capacity_full')) return response(origin, 409, { error: 'slot_capacity_full' });
      if (detail.includes('slot_unavailable')) return response(origin, 409, { error: 'slot_unavailable' });
      if (detail.includes('lead_time_unavailable')) return response(origin, 409, { error: 'lead_time_unavailable' });
      console.error('storefront_order_failed', db.status, result?.code || 'database_error');
      return response(origin, 400, { error: 'order_rejected' });
    }
    const row = Array.isArray(result) ? result[0] : result;
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
    if (!row.duplicate) {
      try {
        await notifyOrder({
          orderId: row.order_id,
          reference: row.reference,
          locale,
          customerName,
          customerContact,
          fulfillment,
          deliveryAddress,
          deliveryMinor: Number(row.delivery_minor),
          note,
          start,
          end,
          items: row.items,
        });
      } catch (error) {
        console.error('order_email_unavailable', error instanceof Error ? error.name : 'unknown');
      }
    }
    return response(origin, 200, {
      reference: row.reference,
      duplicate: Boolean(row.duplicate),
      deliveryMinor: Number(row.delivery_minor),
      totalMinor: Number(row.total_minor),
    });
  } catch (error) {
    console.error('storefront_order_error', error instanceof Error ? error.message : 'unknown');
    return response(origin, 500, { error: 'service_unavailable' });
  }
});
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type IntakeItem = { sku: string; personalization: string; description: string; configuration: Record<string, unknown>; quantity: number };
type CanonicalItem = { name: string; detail: string; quantity: number; unit_price_minor: number };
type IntakeMessage = { id: string; sender: 'customer' | 'assistant'; body: string };
type EmailInput = { to: string; replyTo?: string; subject: string; html: string; text: string; idempotencyKey: string };
type NotificationInput = {
  orderId: string;
  reference: string;
  locale: string;
  customerName: string;
  customerContact: string;
  fulfillment: string;
  deliveryAddress: string;
  deliveryMinor: number;
  note: string;
  start: Date;
  end: Date;
  items: CanonicalItem[];
};
