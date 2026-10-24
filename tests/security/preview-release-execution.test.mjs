import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,copyFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';

const bash=process.env.BLAGOVA_TEST_BASH || (process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash');
const posix=p=>p.replaceAll('\\','/').replace(/^([A-Za-z]):/,(_,drive)=>'/'+drive.toLowerCase());
const shaA='a'.repeat(40),shaB='b'.repeat(40),shaC='c'.repeat(40);
const image=sha=>'blagova-sweets-preview:'+sha;
const legacy='blagova-sweets-preview-legacy-20260923-153013';
function fixture(t,{mode='deploy',scenario='healthy',baseline='managed'}={}){
 const parent=resolve(tmpdir());
 const root=mkdtempSync(join(parent,'blagova-release-test-'));
 t.after(()=>{
  assert.equal(dirname(resolve(root)),parent,'Cleanup target must stay inside the test temp parent');
  assert.match(root.split(/[\\/]/).at(-1),/^blagova-release-test-/);
  rmSync(root,{recursive:true,force:true});
 });
 for(const dir of ['state','bin','mock','releases/'+shaB])mkdirSync(join(root,dir),{recursive:true});
 const put=(p,s)=>writeFileSync(join(root,p),s);
 const env=sha=>`PREVIEW_IMAGE=${image(sha)}\nPREVIEW_COMPOSE_PROJECT=blagova-test-preview\nPREVIEW_PROXY_NETWORK=test-net\n`;
 if(baseline!=='empty'&&baseline!=='legacy-deploy'){
  put('docker-compose.preview.yml','compose-A\n');put('.env',env(shaA));put('state/current-release',shaA+'\n');
  put('mock/runtime.image',image(shaA)+'\n');put('mock/managed.exists','');
 }
 if(baseline==='managed'){
  put('state/docker-compose.previous.yml','compose-C\n');put('state/env.previous',env(shaC));
 }
 if(baseline==='legacy-rollback'){put('state/legacy-container',legacy+'\n');put('mock/'+legacy+'.exists','');}
 if(baseline==='legacy-deploy')put('mock/blagova-sweets-preview.exists','');
 if(scenario==='stale-operation')put('state/operation-in-progress','interrupted\n');
 if(scenario==='recovery-required')put('state/recovery-required','unresolved\n');
 put('releases/'+shaB+'/docker-compose.preview.yml','compose-B\n');
 put('releases/'+shaB+'/preview-image.tar.gz',gzipSync('synthetic image'));
 copyFileSync('tests/deploy/mock-docker.sh',join(root,'bin/docker'));
 put('bin/sleep','#!/usr/bin/env bash\nexit 0\n');
 put('bin/flock','#!/usr/bin/env bash\n[ "$MOCK_SCENARIO" != lock-fail ]\n');
 if(process.platform==='win32'){
  // Git Bash cannot enforce Unix permission bits on these Node-created NTFS
  // fixtures. Only permissions are shimmed; copies and all release state stay
  // real. Linux CI executes the actual install/chmod commands.
  put('bin/install',[
   '#!/usr/bin/env bash','set -eu','directory=false',
   'while [ $# -gt 0 ]; do case "$1" in -d) directory=true; shift ;; -m) shift 2 ;; *) break ;; esac; done',
   'if [ "$directory" = true ]; then exec /usr/bin/mkdir -p "$@"; else exec /usr/bin/cp "$@"; fi',''
  ].join('\n'));
  put('bin/chmod','#!/usr/bin/env bash\nexit 0\n');
  for(const f of ['install','chmod'])chmodSync(join(root,'bin',f),0o755);
 }
 // Simulate one atomic marker write failure after healthy activation; recovery's
 // marker write then succeeds. File operations otherwise use real coreutils.
 put('bin/mv',[
  '#!/usr/bin/env bash',
  'if [ "$MOCK_SCENARIO" = config-fail ] && [ "${@: -1}" = "$TEST_ROOT/.env" ] && [ ! -e "$MOCK_DIR/config.failed" ]; then touch "$MOCK_DIR/config.failed"; exit 46; fi',
  'if [ "$MOCK_SCENARIO" = marker-fail ] && [ "${@: -1}" = "$TEST_ROOT/state/current-release" ] && [ ! -e "$MOCK_DIR/marker.failed" ]; then',
  ' touch "$MOCK_DIR/marker.failed"; exit 45',
  'fi',
  'exec /usr/bin/mv "$@"',''
 ].join('\n'));
 put('bin/cp',[
  '#!/usr/bin/env bash',
  'if [ "$MOCK_SCENARIO" = pointer-fail ] && [ "${@: -1}" = "$TEST_ROOT/state/env.previous" ] && [ ! -e "$MOCK_DIR/pointer.failed" ]; then touch "$MOCK_DIR/pointer.failed"; exit 47; fi',
  'exec /usr/bin/cp "$@"',''
 ].join('\n'));
 for(const f of ['docker','sleep','flock','mv','cp'])chmodSync(join(root,'bin',f),0o755);
 const args=mode==='deploy'?[posix(root),image(shaB),shaB,'test-net','blagova-test-preview']:[posix(root)];
 const target=mode==='deploy'?image(shaB):image(shaC);
 const result=spawnSync(bash,['--noprofile','--norc','-c','export PATH="$1/bin:$PATH"; shift; exec bash "$@"','fixture',posix(root),posix(resolve('scripts/'+(mode==='deploy'?'deploy':'rollback')+'-preview.sh')),...args],{
  encoding:'utf8',timeout:30000,env:{...process.env,MOCK_DIR:posix(join(root,'mock')),TEST_ROOT:posix(root),MOCK_SCENARIO:scenario,MOCK_TARGET_IMAGE:target}
 });
 assert.ifError(result.error);
 assert.notEqual(result.status,null,result.stderr);
 const read=p=>existsSync(join(root,p))?readFileSync(join(root,p),'utf8'):null;
 return {result,read,root,env,calls:read('mock/docker.calls')||''};
}
function recovered(f,upCount=2){
 assert.notEqual(f.result.status,0,f.result.stdout);
 assert.equal(f.read('docker-compose.preview.yml'),'compose-A\n');assert.equal(f.read('.env'),f.env(shaA));
 assert.equal(f.read('mock/runtime.image'),image(shaA)+'\n');assert.equal(f.read('state/current-release'),shaA+'\n');
 assert.equal(f.read('state/recovery-required'),null);assert.equal(f.read('state/operation-in-progress'),null);
 assert.equal((f.result.stderr.match(/attempting one recovery/g)||[]).length,1,f.result.stderr);
 assert.equal(f.read('mock/up.count'),upCount+'\n',f.calls);
 assert.doesNotMatch(f.calls,/n8n|caddy|postgres|prune|system/);
}
for(const mode of ['deploy','rollback']){
 test(`${mode}: healthy activation commits image/config/marker and rotates previous pair`,t=>{
  const f=fixture(t,{mode});assert.equal(f.result.status,0,f.result.stderr);
  const target=mode==='deploy'?shaB:shaC;
  assert.equal(f.read('state/current-release'),target+'\n');assert.equal(f.read('mock/runtime.image'),image(target)+'\n');
  assert.equal(f.read('state/docker-compose.previous.yml'),'compose-A\n');assert.equal(f.read('state/env.previous'),f.env(shaA));
  assert.equal(f.read('mock/up.count'),'1\n');assert.equal(f.read('state/operation-in-progress'),null);
  assert.doesNotMatch(f.result.stderr,/attempting one recovery/);
 });
 for(const scenario of ['unhealthy','timeout','up-fail','inspect-fail','empty-id','image-mismatch','marker-fail','pointer-fail']){
  test(`${mode}: ${scenario} restores current release exactly once`,t=>{
   const f=fixture(t,{mode,scenario});recovered(f);
   assert.equal(f.read('state/docker-compose.previous.yml'),'compose-C\n');assert.equal(f.read('state/env.previous'),f.env(shaC));
  });
 }
 test(`${mode}: recovery failure is nonrecursive and removes healthy marker`,t=>{
  const f=fixture(t,{mode,scenario:'recovery-up-fail'});
  assert.notEqual(f.result.status,0);assert.equal(f.read('mock/up.count'),'2\n');
  assert.equal(f.read('state/current-release'),null);assert.match(f.read('state/recovery-required'),/Recovery failed/);
  assert.equal((f.result.stderr.match(/attempting one recovery/g)||[]).length,1);
 });
 test(`${mode}: lock refusal never mutates runtime/config/marker`,t=>{
  const f=fixture(t,{mode,scenario:'lock-fail'});
  assert.notEqual(f.result.status,0);assert.equal(f.read('mock/up.count'),null);assert.equal(f.read('state/current-release'),shaA+'\n');
  assert.doesNotMatch(f.result.stderr,/attempting one recovery/);
 });
 for(const scenario of ['stale-operation','recovery-required']){
  test(`${mode}: refuses unresolved ${scenario} without mutation`,t=>{
   const f=fixture(t,{mode,scenario});assert.notEqual(f.result.status,0);assert.equal(f.read('mock/up.count'),null);
   assert.equal(f.read('state/current-release'),shaA+'\n');assert.match(f.result.stderr,/Unresolved Preview operation/);
  });
 }
}
test('deploy: failure during config write restores snapshot before activation',t=>{
 const f=fixture(t,{scenario:'config-fail'});recovered(f,1);
 assert.equal(f.read('state/env.previous'),f.env(shaC));
});
test('first deploy: config failure restores empty baseline without parsing incomplete Compose files',t=>{
 const f=fixture(t,{baseline:'empty',scenario:'config-fail'});assert.notEqual(f.result.status,0);
 assert.equal(f.read('mock/up.count'),null);assert.equal(f.read('.env'),null);assert.equal(f.read('docker-compose.preview.yml'),null);
 assert.equal(f.read('state/recovery-required'),null);assert.doesNotMatch(f.calls,/compose/);
});
test('first deploy with no predecessor restores the empty baseline on failure',t=>{
 const f=fixture(t,{baseline:'empty',scenario:'unhealthy'});assert.notEqual(f.result.status,0);
 assert.equal(f.read('.env'),null);assert.equal(f.read('docker-compose.preview.yml'),null);assert.equal(f.read('state/current-release'),null);
 assert.equal(f.read('mock/managed.exists'),null);assert.equal(f.read('state/recovery-required'),null);
 assert.equal(f.read('mock/up.count'),'1\n');assert.match(f.result.stderr,/empty baseline restored/);
});
test('legacy rollback accepts healthy only after verification and does not retain a managed SHA',t=>{
 const f=fixture(t,{mode:'rollback',baseline:'legacy-rollback'});assert.equal(f.result.status,0,f.result.stderr);
 assert.equal(f.read('state/current-release'),null);assert.equal(f.read('.env'),null);assert.equal(f.read('state/legacy-container'),null);
 assert.equal(f.read('state/legacy-container.restored'),legacy+'\n');
});
for(const scenario of ['legacy-unhealthy','legacy-timeout']){
 test(`legacy rollback ${scenario} reparks legacy and restores managed release`,t=>{
  const f=fixture(t,{mode:'rollback',baseline:'legacy-rollback',scenario});
  assert.notEqual(f.result.status,0,f.result.stderr);assert.equal(f.read('state/current-release'),shaA+'\n');
  assert.equal(f.read('mock/'+legacy+'.exists'),'');assert.equal(f.read('mock/blagova-sweets-preview.exists'),null);
  assert.equal(f.read('mock/up.count'),'1\n');assert.equal(f.read('state/recovery-required'),null);
 });
}
test('failed first managed deployment restores its preserved legacy runtime',t=>{
 const f=fixture(t,{baseline:'legacy-deploy',scenario:'unhealthy'});assert.notEqual(f.result.status,0,f.result.stderr);
 assert.equal(f.read('mock/blagova-sweets-preview.exists'),'');assert.equal(f.read('state/current-release'),null);
 assert.equal(f.read('.env'),null);assert.equal(f.read('state/recovery-required'),null);
 assert.equal(f.read('state/legacy-container.restored'),'blagova-sweets-preview\n');
});
