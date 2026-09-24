import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mapPublishedCatalog, mapPublicCategories } from '../../utils/catalogMapper.mjs';

test('storefront uses only active published variants and the primary image', () => {
  const rows = [
    { slug:'draft',category:'cake',status:'draft',image_path:'/old.webp',name:{ru:'Draft'},product_variants:[{active:true,price_minor:1}] },
    { slug:'berry',category:'cake',status:'published',image_path:'/old.webp',name:{ru:'Ягода',en:'Berry',th:'เบอร์รี'},
      subtitle:{ru:'Тест'},description:{ru:'Описание'},allergens:{ru:'Молоко'},
      product_variants:[{active:false,sku:'old',name:{ru:'Old'},price_minor:10,sort_order:0},
        {active:true,sku:'new',name:{ru:'1 кг'},price_minor:145000,lead_days:2,min_quantity:1,sort_order:10}],
      product_images:[{is_primary:true,storage_path:'products/p/photo.webp'}] }
  ];
  const products = mapPublishedCatalog(rows, path => `https://storage.example/${path}`);
  assert.equal(products.length,1);
  assert.equal(products[0].price,1450);
  assert.equal(products[0].variants[0].sku,'new');
  assert.equal(products[0].image,'https://storage.example/products/p/photo.webp');
  assert.equal(products[0].name.th,'เบอร์รี');
  assert.deepEqual(mapPublicCategories([{id:'cake',active:true,sort_order:1,name:{ru:'Торты'}}],products).map(c=>c.id),['all','cakes']);
  const trifle = mapPublishedCatalog([{...rows[1],slug:'trifle',category:'trifle'}],path => path);
  assert.equal(trifle[0].category,'trifle');
  assert.deepEqual(mapPublicCategories([{id:'trifle',active:true,sort_order:1,name:{ru:'Трайфлы'}}],trifle).map(c=>c.id),['all','trifle']);
});
