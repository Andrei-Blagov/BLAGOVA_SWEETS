import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForPostgresTcp} from '../../scripts/postgres-test-readiness.mjs';

const container='a'.repeat(64);

test('readiness ignores accepting init sockets and waits through shutdown for the final TCP server',async()=>{
 let phase=0,time=0,calls=0;
 await waitForPostgresTcp(container,{
  exec(command,args){
   assert.equal(command,'docker');assert.ok(args.includes(container));calls++;
   const tcp=args[args.indexOf('-h')+1]==='127.0.0.1';
   // Phase 0 is an accepting Unix init server; phase 1 is its shutdown gap.
   if(phase===0&&!tcp)return '1\n';
   if(phase<2)throw Error('connection refused during init/shutdown');
   return '1\n';
  },
  timeoutMs:30,intervalMs:10,now:()=>time,
  delay:async ms=>{time+=ms;phase++;},
 });
 assert.equal(phase,2,'CREATE DATABASE may proceed only after final startup');
 assert.equal(calls,3);
});

test('readiness returns immediately for a final TCP server without a stabilizing sleep',async()=>{
 let calls=0;
 await waitForPostgresTcp(container,{
  exec(command,args,options){calls++;assert.equal(args[args.indexOf('-h')+1],'127.0.0.1');assert.ok(options.timeout>0);return '1\n';},
  delay:async()=>assert.fail('a ready final server needs no sleep'),
 });
 assert.equal(calls,1);
});

test('readiness times out when only a Unix server is available and preserves the probe cause',async()=>{
 let time=0,calls=0;const refusal=Error('final TCP listener unavailable');
 await assert.rejects(waitForPostgresTcp(container,{
  exec(command,args){calls++;if(!args.includes('-h'))return '1\n';throw refusal;},
  timeoutMs:20,intervalMs:10,now:()=>time,delay:async ms=>{time+=ms;},
 }),error=>/Final PostgreSQL TCP server not ready/.test(error.message)&&error.cause===refusal);
 assert.equal(time,20);assert.equal(calls,3);
});
