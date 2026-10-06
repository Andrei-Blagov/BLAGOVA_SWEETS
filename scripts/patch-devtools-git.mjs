import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// DevTools 3.4.2 imports the removed simple-git default export. Keep stable
// DevTools, but use patched simple-git 4.0.2 and its documented named factory.
// Fail on upstream changes rather than silently leaving an incompatible install.
const entry = fileURLToPath(import.meta.resolve('@nuxt/devtools'));
const dist = dirname(entry);
const metadata = JSON.parse(await readFile(join(dist, '../package.json'), 'utf8'));
if (metadata.version !== '3.4.2') {
  throw new Error('Recheck the DevTools/simple-git compatibility patch before upgrading DevTools.');
}
// Resolve from DevTools so this checks the actual overridden dependency.
const gitEntry = createRequire(entry).resolve('simple-git');
const gitPackage = JSON.parse(await readFile(join(dirname(gitEntry), '../package.json'), 'utf8'));
if (gitPackage.version !== '4.0.2') {
  throw new Error('DevTools must resolve the reviewed simple-git 4.0.2 version.');
}
const target = join(dist, 'chunks/module-main.mjs');
const original = "import Git from 'simple-git';";
const replacement = "import { simpleGit as Git } from 'simple-git';";
const source = await readFile(target, 'utf8');
const matches = source.split(original).length - 1;
if (matches === 1 && !source.includes(replacement)) {
  await writeFile(target, source.replace(original, replacement));
} else if (matches !== 0 || source.split(replacement).length - 1 !== 1) {
  throw new Error('Unexpected DevTools Git import; review upstream before installing.');
}
console.log('DevTools 3.4.2 Git import adapted for simple-git 4.0.2.');
