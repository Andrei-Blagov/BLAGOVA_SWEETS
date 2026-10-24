import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../../supabase/functions/storefront-chat/index.ts';

const allowedOrigin = 'https://blagova-pattaya-atelier.blagovandrey1323.chatgpt.site';

test('storefront-chat returns a bodyless 204 for an allowed preflight', async () => {
  const response = await handleRequest(new Request('https://example.test/storefront-chat', {
    method: 'OPTIONS',
    headers: { Origin: allowedOrigin },
  }));

  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.equal(response.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  assert.match(response.headers.get('access-control-allow-headers') || '', /\bapikey\b/);
  assert.match(response.headers.get('access-control-allow-headers') || '', /\bcontent-type\b/);
  assert.equal(response.headers.get('content-type'), null);
});

test('storefront-chat does not grant CORS access to an unapproved origin', async () => {
  const response = await handleRequest(new Request('https://example.test/storefront-chat', {
    method: 'OPTIONS',
    headers: { Origin: 'https://attacker.example' },
  }));

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(await response.json(), { error: 'origin_not_allowed' });
});

test('storefront-chat rejects unsupported methods with CORS headers', async () => {
  const response = await handleRequest(new Request('https://example.test/storefront-chat', {
    method: 'GET',
    headers: { Origin: allowedOrigin },
  }));

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.deepEqual(await response.json(), { error: 'method_not_allowed' });
});
