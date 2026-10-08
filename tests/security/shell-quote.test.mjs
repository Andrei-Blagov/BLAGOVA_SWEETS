import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';

// Resolve through the real consumer, including any future nested installation.
const devtoolsRequire = createRequire(fileURLToPath(import.meta.resolve('@nuxt/devtools')));
const launchEntry = devtoolsRequire.resolve('launch-editor');
const consumerRequire = createRequire(launchEntry);
const shellQuote = consumerRequire('shell-quote');

test('launch-editor uses the patched parser and preserves editor arguments', (t) => {
  const guessEditor = consumerRequire(join(dirname(launchEntry), 'guess.js'));
  const editor = '"/nonexistent/Blagova Editor" --wait --label "two words"';
  assert.deepEqual(guessEditor(editor), ['/nonexistent/Blagova Editor', '--wait', '--label', 'two words']);

  // Exercise launch-editor itself, but intercept every process API: no editor or
  // shell is executed. The ordinary existing fixture is this test file.
  const childProcess = consumerRequire('node:child_process');
  const calls = [];
  t.mock.method(childProcess, 'spawn', (command, args, options) => {
    calls.push({ command, args, options });
    return new EventEmitter();
  });
  for (const method of ['exec', 'execSync', 'spawnSync', 'execFile', 'execFileSync', 'fork']) {
    t.mock.method(childProcess, method, () => assert.fail(`Unexpected process API: ${method}`));
  }
  const fixture = fileURLToPath(import.meta.url);
  consumerRequire(launchEntry)(fixture, editor);
  assert.deepEqual(calls, [{
    command: '/nonexistent/Blagova Editor',
    args: ['--wait', '--label', 'two words', fixture],
    options: { stdio: 'inherit' },
  }]);
});

test('shell-quote rejects line terminators after comments without executing a shell', () => {
  for (const terminator of ['\n', '\r', '\u2028', '\u2029']) {
    const input = ['editor', { comment: 'safe-comment' }, `safe${terminator}sentinel`];
    assert.throws(() => shellQuote.quote(input), {
      name: 'TypeError', message: /after a `comment`.*line terminators/,
    });
    // Cover the actual parse -> append -> quote composition from the advisory.
    assert.throws(() => shellQuote.quote([
      ...shellQuote.parse('editor #safe-comment'), `safe${terminator}sentinel`,
    ]), TypeError);
  }
  const argumentsWithSpaces = ['editor', 'two words', 'a"b', "a'b", 'safe\ntext'];
  assert.deepEqual(shellQuote.parse(shellQuote.quote(argumentsWithSpaces)), argumentsWithSpaces);
  assert.equal(shellQuote.quote(['editor', { comment: 'safe-comment' }, 'ordinary']), 'editor #safe-comment ordinary');
});
