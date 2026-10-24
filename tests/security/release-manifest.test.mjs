import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('release manifest hashes match all local backend sources without claiming live parity',()=>{
 const output=execFileSync(process.execPath,['scripts/check-release-manifest.mjs'],{encoding:'utf8'});
 assert.match(output,/\d+ local source hashes/);
 assert.match(output,/live schema\/Edge parity remains explicitly unverified/);
});
