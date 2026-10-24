import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';

// Resolve through the real consumer, including any future nested installation.
const devtoolsRequire = createRequire(fileURLToPath(import.meta.resolve('@nuxt/devtools')));
const launchEntry = devtoolsRequire.resolve('launch-editor');
const consumerRequire = createRequire(launchEntry);
const shellQuote = consumerRequire('shell-quote');

test('patched editor rejects CMD expansion/separators and canonicalizes flag-like filenames without executing',()=>{
  const construct=consumerRequire(join(dirname(launchEntry),'construct-windows-launch-command.js'));
  for(const argument of ['synthetic%VARIABLE%.vue','synthetic\rnext.vue','synthetic\nnext.vue'])assert.throws(()=>construct('editor',[argument]),/Cannot launch an editor/);
  const parseFile=consumerRequire(join(dirname(launchEntry),'parse-file.js'));
  const getArgs=consumerRequire(join(dirname(launchEntry),'get-args.js'));
  const parsed=parseFile('-synthetic-flag.vue:12:3');assert.ok(isAbsolute(parsed.fileName));assert.equal(basename(parsed.fileName),'-synthetic-flag.vue');
  const args=getArgs('unknown-editor',parsed.fileName,parsed.lineNumber,parsed.columnNumber);assert.ok(args.every(value=>!value.startsWith('-')),'untrusted filename cannot become an editor CLI flag');
});

test('launch-editor uses the patched parser and preserves editor arguments', (t) => {
  const guessEditor = consumerRequire(join(dirname(launchEntry), 'guess.js'));
  const editor = '"/nonexistent/Blagova Editor" --wait --label "two words"';
  assert.deepEqual(guessEditor(editor), ['/nonexistent/Blagova Editor', '--wait', '--label', 'two words']);

  // Exercise launch-editor itself, but intercept every process API: no editor or
  // shell is executed. The ordinary existing fixture is this test file.
  const childProcess = consumerRequire('node:child_process');
  const calls = [];
  t.mock.method(childProcess, 'spawn', (command, args, options) => {
    assert.notEqual(process.platform, 'win32', 'Windows consumer must use its explicit shell branch');
    calls.push({ command, args, options });
    return new EventEmitter();
  });
  t.mock.method(childProcess, 'exec', (command, options) => {
    assert.equal(process.platform, 'win32', 'Unix consumer must spawn argv directly');
    calls.push({ command, options });
    return new EventEmitter();
  });
  for (const method of ['execSync', 'spawnSync', 'execFile', 'execFileSync', 'fork']) {
    t.mock.method(childProcess, method, () => assert.fail(`Unexpected process API: ${method}`));
  }
  const fixture = fileURLToPath(import.meta.url);
  consumerRequire(launchEntry)(fixture, editor);
  assert.deepEqual(calls, process.platform === 'win32' ? [{
    command: `"/nonexistent/Blagova Editor" --wait --label "two words" ${fixture.includes(' ') ? `"${fixture}"` : fixture}`,
    options: { stdio: 'inherit', shell: true },
  }] : [{
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
