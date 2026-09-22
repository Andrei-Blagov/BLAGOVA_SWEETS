import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

const rules = [
  ['private key', /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['OpenAI secret key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['Resend API key', /\bre_[A-Za-z0-9]{20,}\b/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
];

const failures = [];
for (const file of files) {
  if (/(^|\/)\.env(?:\.[^/]+)?$/.test(file) && !file.endsWith('.env.example')) {
    failures.push(`${file}: tracked environment file`);
    continue;
  }

  const content = readFileSync(file);
  if (content.includes(0)) continue;
  const text = content.toString('utf8');
  for (const [label, pattern] of rules) {
    if (pattern.test(text)) failures.push(`${file}: possible ${label}`);
  }
}

if (failures.length) {
  console.error('Potential secrets found in tracked files:\n' + failures.join('\n'));
  process.exit(1);
}

console.log(`No common secret patterns found in ${files.length} tracked files.`);
