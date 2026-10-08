import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { validOrderContact } from '../../supabase/functions/_shared/orderContact.ts';

test('orders accept reachable email or international/local phone formats', () => {
  for (const contact of ['demo@example.com', ' Demo+order@example.co.th ', '+66 81 234 5678', '081-234-5678']) {
    assert.equal(validOrderContact(contact), true, contact);
  }
});

test('orders reject blank, arbitrary text and malformed contacts', () => {
  for (const contact of ['', '   ', 'preview-a2e-codex', 'LINE: some-user', 'name@example', '1234', '+66 81 abc 5678', '0'.repeat(16)]) {
    assert.equal(validOrderContact(contact), false, contact);
  }
});
