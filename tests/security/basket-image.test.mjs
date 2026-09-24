import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { allowedBasketImage } from '../../utils/basketImage.mjs';

test('persisted cart accepts local and project Storage photos, rejects foreign URLs', () => {
  const project = 'https://example.supabase.co';
  const image = 'https://example.supabase.co/storage/v1/object/public/catalog-demo/products/12345678-1234-1234-1234-123456789abc/12345678-1234-1234-1234-123456789abc.webp';
  assert.equal(allowedBasketImage('/prototype/cake.webp',project),true);
  assert.equal(allowedBasketImage(image,project),true);
  assert.equal(allowedBasketImage(image.replace('example.supabase.co','elsewhere.test'),project),false);
  assert.equal(allowedBasketImage('//elsewhere.test/photo.webp',project),false);
  assert.equal(allowedBasketImage(image.replace('/catalog-demo/','/other-bucket/'),project),false);
});
