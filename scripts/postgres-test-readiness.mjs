import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

// Official-image initialization uses a socket-only temporary server. A successful
// loopback TCP query identifies the final post-init server, not that transient one.
export async function waitForPostgresTcp(container,{
 exec=execFileSync,timeoutMs=15000,intervalMs=100,now=Date.now,
 delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
}={}){
 assert.match(container,/^[a-f0-9]{64}$/,'Expected exact disposable container ID');
 assert.ok(Number.isFinite(timeoutMs)&&timeoutMs>0);
 const deadline=now()+timeoutMs;let lastError;
 while(true){
  try{
   const output=exec('docker',['exec','-e','PGCONNECT_TIMEOUT=1',container,'psql','-X','-q','-t','-A',
    '-h','127.0.0.1','-p','5432','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c','select 1;'],
   {encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:Math.max(1,Math.min(2000,deadline-now()))});
   if(output.trim()==='1')return;
   lastError=new Error('Unexpected PostgreSQL TCP readiness response');
  }catch(error){lastError=error;}
  const remaining=deadline-now();
  if(remaining<=0)throw new Error('Final PostgreSQL TCP server not ready within '+timeoutMs+'ms',{cause:lastError});
  await delay(Math.min(intervalMs,remaining));
 }
}
