import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mapPublishedCatalog } from '../../utils/catalogMapper.mjs';
import { optionConfiguration, optionTotal, selectedOptions } from '../../utils/catalogOptions.mjs';

test('active product options map to the storefront and selected extras affect display price', () => {
  const [product] = mapPublishedCatalog([{slug:'cake',category:'cake',status:'published',image_path:'/cake.webp',
    name:{ru:'Торт'}, product_variants:[{active:true,sku:'cake-1',name:{ru:'1 кг'},price_minor:10000,lead_days:2,sort_order:0}],
    catalog_options:[{active:true,option_group:'decoration',option_key:'candle',label:{ru:'Свеча'},price_delta_minor:5000,sort_order:10},
      {active:false,option_group:'decoration',option_key:'old',label:{ru:'Скрыто'},price_delta_minor:1,sort_order:0}]}],path=>path);
  assert.equal(product.options.length,1);
  const selection = optionConfiguration({decoration:'candle',wrapping:''});
  assert.deepEqual(selection,{decoration:'candle'});
  assert.equal(optionTotal(product.options,selection),50);
  assert.equal(selectedOptions(product.options,selection)[0].label.ru,'Свеча');
});
