import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { allowedStaffTabs, canManageCatalog } from '../../utils/staffAccess.mjs';

test('manager keeps operational tabs and cannot manage content', () => {
  assert.deepEqual([...allowedStaffTabs('manager')], ['orders', 'conversations', 'calendar']);
  assert.equal(canManageCatalog('manager'), false);
});

test('owner manages content; revoked or unknown roles see no workspace', () => {
  assert.deepEqual([...allowedStaffTabs('owner')], ['orders', 'conversations', 'calendar', 'catalog', 'knowledge', 'integrations']);
  assert.equal(canManageCatalog('owner'), true);
  for (const role of [null, undefined, 'revoked', 'customer']) {
    assert.deepEqual([...allowedStaffTabs(role)], []);
    assert.equal(canManageCatalog(role), false);
  }
});
