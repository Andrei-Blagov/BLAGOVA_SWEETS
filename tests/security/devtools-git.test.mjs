import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const devtoolsEntry = fileURLToPath(import.meta.resolve('@nuxt/devtools'));
const gitEntry = createRequire(devtoolsEntry).resolve('simple-git');
const { simpleGit } = await import(pathToFileURL(gitEntry).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('stable DevTools loads with patched Git and its build-name Git calls work', async () => {
  // Import the actual lazy chunk: devtools.enabled=false would otherwise hide
  // the removed-default-export error from build/typecheck alone.
  await import(pathToFileURL(join(dirname(devtoolsEntry), 'chunks/module-main.mjs')).href);
  const git = simpleGit(root);
  assert.equal(typeof (await git.branch()).current, 'string');
  assert.match(await git.revparse(['--short', 'HEAD']), /^[a-f0-9]+$/);
  assert.equal(typeof (await git.status()).isClean(), 'boolean');
});

test('overridden Git rejects unsafe editor, trailer command and configuration includes', async () => {
  const attempts = [
    [() => simpleGit(root).env({ VISUAL: '/nonexistent/blagova-editor' }).raw(['status']), /VISUAL.*not permitted.*allowUnsafeEditor/],
    [() => simpleGit(root).raw(['-c', 'trailer.test.command=/nonexistent/blagova-command', 'status']), /not permitted.*allowUnsafe/],
    [() => simpleGit(root).raw(['-c', 'include.path=/nonexistent/blagova-config', 'status']), /not permitted.*allowUnsafe/],
  ];
  for (const [attempt, message] of attempts) {
    await assert.rejects(attempt(), message);
  }
});
