import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { blockedCredentialFile, scanText } from './secret-scan-rules.mjs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

const failures = [];
for (const file of files) {
  const blockedReason = blockedCredentialFile(file);
  if (blockedReason) {
    failures.push(`${file}: ${blockedReason}`);
    continue;
  }

  const content = readFileSync(file);
  if (content.includes(0)) continue;
  const text = content.toString('utf8');
  for (const label of scanText(text)) failures.push(`${file}: possible ${label}`);
}

if (failures.length) {
  console.error('Potential secrets found in tracked files:\n' + failures.join('\n'));
  process.exit(1);
}

console.log(`No common secret patterns found in ${files.length} tracked files.`);
