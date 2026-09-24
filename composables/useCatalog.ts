import type { AtelierProduct, Localized } from '~/data/atelier';
import { mapPublishedCatalog, mapPublicCategories } from '~/utils/catalogMapper.mjs';

interface PublicCategory { id:string; name:Localized }
interface BuilderProduct { name:Localized; image:string; sku:string; leadDays:number }
const staleAfterMs = 60000;
let inflight: Promise<void>|null = null;
export function useCatalog() {
  const products = useState<AtelierProduct[]>('public-catalog-products',() => []);
  const categories = useState<PublicCategory[]>('public-catalog-categories',() => []);
  const rules = useState<Record<string,number>>('public-catalog-rules',() => ({}));
  const builders = useState<Record<string,BuilderProduct>>('public-catalog-builders',() => ({}));
  const loadedAt = useState<number>('public-catalog-loaded-at',() => 0);
  const loading = useState<boolean>('public-catalog-loading',() => false);
  const error = useState<string>('public-catalog-error',() => '');
  async function load(force = false) {
    if (!import.meta.client) return;
    if (!force && loadedAt.value && Date.now()-loadedAt.value < staleAfterMs) return;
    if (inflight) return inflight;
    loading.value = true; error.value = '';
    inflight = (async () => {
      try {
        const db = useNuxtApp().$catalogDb;
        const [productResult,categoryResult,ruleResult] = await Promise.all([
          db.from('products').select('slug,category,status,name,subtitle,description,allergens,image_path,sort_order,product_variants(sku,name,price_minor,lead_days,min_quantity,sort_order,active),product_images(storage_path,alt,is_primary,sort_order)').eq('status','published').order('sort_order'),
          db.from('catalog_categories').select('id,name,active,sort_order').eq('active',true).order('sort_order'),
          db.from('catalog_price_rules').select('rule_key,amount_minor')
        ]);
        if (productResult.error || categoryResult.error || ruleResult.error) throw productResult.error || categoryResult.error || ruleResult.error;
        const activeCategories = new Set((categoryResult.data || []).map(row => row.id));
        const mapped = mapPublishedCatalog((productResult.data || []).filter(row => activeCategories.has(row.category)),
          (path: string) => db.storage.from('catalog-demo').getPublicUrl(path).data.publicUrl) as AtelierProduct[];
        if (!mapped.length) throw new Error('No published products');
        products.value = mapped;
        builders.value = Object.fromEntries((productResult.data || []).filter(row => ['custom-gift','celebration-set'].includes(row.slug))
          .map(row => { const primary = row.product_images?.find(image => image.is_primary);
            const active = row.product_variants?.find(variant => variant.active);
            return [row.slug,{ name:row.name as Localized,
              image:primary ? db.storage.from('catalog-demo').getPublicUrl(primary.storage_path).data.publicUrl : row.image_path || '',
              sku:active?.sku || '', leadDays:active?.lead_days || 0 }]; }));
        categories.value = mapPublicCategories(categoryResult.data || [],mapped) as PublicCategory[];
        rules.value = Object.fromEntries((ruleResult.data || []).map(row => [row.rule_key,row.amount_minor/100]));
        loadedAt.value = Date.now();
      } catch {
        // Never silently show stale prices or fall back to a code catalog.
        products.value = []; categories.value = []; rules.value = {}; builders.value = {}; loadedAt.value = 0;
        error.value = 'Каталог временно недоступен. Попробуйте обновить страницу.';
      } finally { loading.value = false; inflight = null; }
    })();
    return inflight;
  }
  return { products,categories,rules,builders,loading,error,load };
}
