export type Locale = 'ru' | 'en' | 'th';
export type Localized = Record<Locale, string>;
export const L = (ru: string, en: string, th: string): Localized => ({
  ru,
  en,
  th
});
export interface AtelierProduct {
  id: string;
  name: Localized;
  subtitle: Localized;
  description: Localized;
  category: string;
  image: string;
  price: number;
  unit: Localized;
  leadDays: number;
  allergens: Localized;
  variants?: AtelierVariant[];
  options?: CatalogOption[];
}
export interface CatalogOption {
  optionGroup: string;
  optionKey: string;
  label: Localized;
  priceDelta: number;
}
export interface AtelierVariant {
  sku: string;
  name: Localized;
  price: number;
  leadDays: number;
  minQuantity: number;
}
