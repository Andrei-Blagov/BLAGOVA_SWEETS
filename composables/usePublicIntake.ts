import type { Locale } from '~/data/atelier';

export type StorefrontOrderInput = {
  requestKey: string;
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
  items: Array<{ sku: string; personalization: string; description: string; configuration: Record<string, string | number | boolean>; quantity: number }>;
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
  async function submitOrder(input: StorefrontOrderInput) {
    const response = await fetch(`${config.public.supabaseUrl}/functions/v1/storefront-order`, {
      method: 'POST',
      headers: {
        apikey: config.public.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...input,
        ...schedule(input.date, input.slot),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.reference !== 'string') {
      throw new Error(response.status === 429 ? 'rate_limit' : result.error || 'service_unavailable');
    }
    return result as { reference: string; duplicate: boolean; totalMinor: number; deliveryMinor: number };
  }
  return { submitOrder };
}
