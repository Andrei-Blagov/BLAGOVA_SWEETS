export type StorefrontSlot = {
  label: string;
  capacity: number;
  used: number;
  available: boolean;
};

export function useAvailability() {
  const config = useRuntimeConfig();
  async function getAvailability(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const response = await fetch(`${config.public.supabaseUrl}/functions/v1/storefront-availability`, {
      method: 'POST',
      headers: { apikey: config.public.supabasePublishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(result.slots)) throw new Error(result.error || 'availability_unavailable');
    return result.slots as StorefrontSlot[];
  }
  return { getAvailability };
}
