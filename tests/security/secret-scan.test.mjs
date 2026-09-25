import assert from 'node:assert/strict';
import test from 'node:test';
import { blockedCredentialFile, scanText } from '../../scripts/secret-scan-rules.mjs';

const syntheticSecrets = [
  ['private key', ['-----BEGIN ', 'PRIVATE KEY-----'].join('')],
  ['GitHub token', ['gh', 'p_', 'a'.repeat(24)].join('')],
  ['OpenAI secret key', ['sk-', 'proj-', 'a'.repeat(24)].join('')],
  ['Resend API key', ['re_', 'a'.repeat(24)].join('')],
  ['Supabase secret key', ['sb_', 'secret_', 'a'.repeat(24)].join('')],
  ['AWS access key', ['AKIA', 'A'.repeat(16)].join('')],
  ['Slack token', ['xox', 'b-', 'a'.repeat(24)].join('')],
  ['npm token', ['npm_', 'a'.repeat(36)].join('')],
  ['Stripe secret key', ['sk_', 'live_', 'a'.repeat(24)].join('')],
  ['Google API key', ['AI', 'za', 'a'.repeat(35)].join('')],
  ['SendGrid API key', ['SG.', 'a'.repeat(18), '.', 'b'.repeat(18)].join('')],
  ['JWT', ['eyJ', 'a'.repeat(12), '.', 'b'.repeat(12), '.', 'c'.repeat(12)].join('')],
];

test('secret scanner detects every supported synthetic credential', () => {
  for (const [label, value] of syntheticSecrets) {
    assert.ok(scanText(value).includes(label), `missed ${label}`);
  }
});

test('secret scanner blocks credential files but allows the example env file', () => {
  assert.equal(blockedCredentialFile('.env'), 'tracked environment file');
  assert.equal(blockedCredentialFile('config/.env.local'), 'tracked environment file');
  assert.equal(blockedCredentialFile('supabase/functions/.dev.vars'), 'tracked Edge Function secrets file');
  assert.equal(blockedCredentialFile('.npmrc'), 'tracked credential configuration file');
  assert.equal(blockedCredentialFile('config/credentials.json'), 'tracked credential JSON file');
  assert.equal(blockedCredentialFile('.env.example'), '');
});

test('ordinary documentation and environment variable names are not treated as secrets', () => {
  assert.deepEqual(scanText('Read RESEND_API_KEY from Deno.env and never commit its value.'), []);
});
