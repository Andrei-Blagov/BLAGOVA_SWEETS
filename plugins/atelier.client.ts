import type { BasketLine } from '~/composables/useAtelier';
export default defineNuxtPlugin(nuxtApp => {
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
  const valid = (x: any): x is BasketLine => x && typeof x.key === 'string' && typeof x.productId === 'string' && typeof x.detail === 'string' && typeof x.image === 'string' && x.image.startsWith('/') && x.name && ['ru', 'en', 'th'].every(l => typeof x.name[l] === 'string') && Number.isFinite(x.price) && x.price >= 0 && x.price <= 100000 && Number.isInteger(x.quantity) && x.quantity > 0 && x.quantity <= 20 && Number.isInteger(x.leadDays) && x.leadDays >= 0;
  // Async layouts can still be hydrating at app:mounted.
  onNuxtReady(() => {
    if (language.value === 'ru' || language.value === 'en' || language.value === 'th') locale.value = language.value;
    watch(locale, value => {
      language.value = value;
    });
    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(data)) basket.value = data.filter(valid).slice(0, 50);
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
