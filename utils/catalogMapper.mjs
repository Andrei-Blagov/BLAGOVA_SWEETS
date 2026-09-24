const locales = ['ru','en','th'];
const localized = value => Object.fromEntries(locales.map(lang => [lang, value?.[lang] || value?.ru || '']));
const category = { cake:'cakes', cupcake:'cupcakes', gingerbread:'gingerbread', chocolate:'chocolate' };

export function mapPublishedCatalog(rows, publicImageUrl) {
  return rows.filter(row => row.status === 'published' && !['custom-gift','celebration-set'].includes(row.slug))
    .map(row => {
      const variants = (row.product_variants || []).filter(v => v.active)
        .sort((a,b) => a.sort_order-b.sort_order || a.price_minor-b.price_minor)
        .map(v => ({ sku:v.sku, name:localized(v.name), price:v.price_minor/100, leadDays:v.lead_days, minQuantity:v.min_quantity }));
      const primary = (row.product_images || []).find(image => image.is_primary);
      const image = primary ? publicImageUrl(primary.storage_path) : row.image_path || '';
      const options = (row.catalog_options || []).filter(option => option.active)
        .sort((a,b) => a.sort_order-b.sort_order || a.option_key.localeCompare(b.option_key))
        .map(option => ({ optionGroup:option.option_group, optionKey:option.option_key,
          label:localized(option.label), priceDelta:option.price_delta_minor/100 }));
      return { id:row.slug, name:localized(row.name), subtitle:localized(row.subtitle), description:localized(row.description),
        allergens:localized(row.allergens), category:category[row.category] || row.category, image, price:variants[0]?.price || 0,
        unit:variants[0]?.name || localized({ru:'',en:'',th:''}), leadDays:variants[0]?.leadDays || 0, variants, options };
    }).filter(row => row.variants.length > 0 && row.image);
}

export function mapPublicCategories(rows, products) {
  const used = new Set(products.map(p => p.category));
  return [{id:'all',name:{ru:'Все десерты',en:'All treats',th:'ขนมทั้งหมด'}},
    ...rows.filter(row => row.active && used.has(category[row.id] || row.id)).sort((a,b) => a.sort_order-b.sort_order)
      .map(row => ({id:category[row.id] || row.id,name:localized(row.name)}))];
}
