import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { scanText } from './secret-scan-rules.mjs';

const root = '.output/public';
const forbiddenNames = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEYS',
  'RESEND_API_KEY',
  'SMTP_PASS',
  'TELEGRAM_BOT_TOKEN',
  'PREVIEW_SSH_PRIVATE_KEY',
];
const failures = [];
let scanned = 0;

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }
    const content = readFileSync(path);
    if (content.includes(0)) continue;
    scanned += 1;
    const text = content.toString('utf8');
    for (const label of scanText(text)) failures.push(`${relative(root, path)}: possible ${label}`);
    for (const name of forbiddenNames) {
      if (text.includes(name)) failures.push(`${relative(root, path)}: contains server-only variable ${name}`);
    }
  }
}

walk(root);
if (failures.length) {
  console.error('Potential server-side secrets found in generated assets:\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`No server-side secret patterns found in ${scanned} generated text assets.`);
