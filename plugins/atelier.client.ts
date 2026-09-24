import type { BasketLine } from '~/composables/useAtelier';
import { allowedBasketImage } from '~/utils/basketImage.mjs';
export default defineNuxtPlugin(nuxtApp => {
  const supabaseUrl = useRuntimeConfig().public.supabaseUrl;
  const {
    basket,
    hydrated,
    locale
  } = useAtelier();
  const language = useCookie('atelier-language', {
    sameSite: 'lax',
    maxAge: 31536000
  });
  const key = 'blagova-prototype-basket-v1';
  const normalize = (x: any): BasketLine | null => {
    if (!x || typeof x.key !== 'string' || typeof x.productId !== 'string' || typeof x.detail !== 'string' || !allowedBasketImage(x.image,supabaseUrl) || !x.name || !['ru', 'en', 'th'].every(l => typeof x.name[l] === 'string') || !Number.isFinite(x.price) || x.price < 0 || x.price > 100000 || !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 20 || !Number.isInteger(x.leadDays) || x.leadDays < 0) return null;
    if (['custom-gift','celebration-set'].includes(x.productId) && (!x.configuration || typeof x.configuration !== 'object')) return null;
    const legacyWeight = x.detail.match(/^(1(?:[.,]5)?|2)\s/iu)?.[1]?.replace(',', '_').replace('.', '_');
    const legacyCustomSku = ['custom-gift','celebration-set'].includes(x.productId) ? x.productId : '';
    const sku = typeof x.sku === 'string' && x.sku ? x.sku : legacyCustomSku || `${x.productId}-${legacyWeight ? `${legacyWeight}kg` : 'standard'}`;
    return { ...x, sku, personalization: typeof x.personalization === 'string' ? x.personalization.slice(0, 40) : '', configuration: x.configuration && typeof x.configuration === 'object' && !Array.isArray(x.configuration) ? x.configuration : {} } as BasketLine;
  };
  // Async layouts can still be hydrating at app:mounted.
  onNuxtReady(() => {
    if (language.value === 'ru' || language.value === 'en' || language.value === 'th') locale.value = language.value;
    watch(locale, value => {
      language.value = value;
    });
    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(data)) basket.value = data.map(normalize).filter((item): item is BasketLine => Boolean(item)).slice(0, 50);
    } catch {}
    hydrated.value = true;
    watch(basket, value => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    }, {
      deep: true
    });
  });
});
