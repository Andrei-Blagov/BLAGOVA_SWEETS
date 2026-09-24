import type { Locale, Localized } from '~/data/atelier';
export interface BasketLine {
  key: string;
  productId: string;
  sku: string;
  name: Localized;
  image: string;
  price: number;
  quantity: number;
  detail: string;
  personalization: string;
  configuration: Record<string, string | number | boolean | Record<string,string>>;
  leadDays: number;
}
export function useAtelier() {
  // One shared state for every component; restore preferences after hydration.
  const locale = useState<Locale>('atelier-language', () => 'ru');
  const basket = useState<BasketLine[]>('atelier-basket', () => []);
  const hydrated = useState('atelier-hydrated', () => false);
  const toast = useState('atelier-toast', () => '');
  const t = (ru: string, en: string, th: string) => ({
    ru,
    en,
    th
  })[locale.value];
  const local = (value: Localized) => value[locale.value];
  const money = (value: number) => new Intl.NumberFormat(locale.value === 'th' ? 'th-TH' : locale.value === 'ru' ? 'ru-RU' : 'en-GB', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
  }).format(value);
  const count = computed(() => basket.value.reduce((n, item) => n + item.quantity, 0));
  const total = computed(() => basket.value.reduce((n, item) => n + item.price * item.quantity, 0));
  const leadDays = computed(() => Math.max(0, ...basket.value.map(i => i.leadDays)));
  function add(line: Omit<BasketLine, 'quantity'>) {
    const found = basket.value.find(i => i.key === line.key);
    if (found && found.quantity >= 20) {
      toast.value = t('Максимум 20 наборов одной позиции', 'Maximum 20 of each item', 'สูงสุด 20 ชุดต่อรายการ');
      return;
    }
    if (found) found.quantity++;else basket.value.push({
      ...line,
      quantity: 1
    });
    toast.value = t('Добавлено в вашу корзину', 'Added to your bag', 'เพิ่มลงในตะกร้าแล้ว');
  }
  function quantity(key: string, value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 20) return;
    if (value === 0) basket.value = basket.value.filter(i => i.key !== key);else {
      const row = basket.value.find(i => i.key === key);
      if (row) row.quantity = value;
    }
  }
  return {
    locale,
    basket,
    hydrated,
    toast,
    t,
    local,
    money,
    count,
    total,
    leadDays,
    add,
    quantity
  };
}
