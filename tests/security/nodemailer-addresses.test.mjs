import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import addressparser from 'nodemailer/lib/addressparser';
import net from 'node:net';
import tls from 'node:tls';

const cases=[
 ['nested comment','Synthetic (x(y) <fake@outside.invalid>) <recipient@example.invalid>','recipient@example.invalid'],
 ['group comment semicolon','Group: (a; <fake@outside.invalid>) <recipient@example.invalid>;','recipient@example.invalid'],
 ['quoted group semicolon','Group: "a;" "<fake@outside.invalid>" <recipient@example.invalid>;','recipient@example.invalid'],
 ['quoted local part angle','<"part@outside.invalid>"@example.invalid>','"part@outside.invalid>"@example.invalid','"part@outside.invalid "@example.invalid'],
];
for(const [label,to,expected,normalized=expected]of cases)test('Nodemailer keeps the intended synthetic recipient domain: '+label,async t=>{
 for(const [module,key]of [[net,'connect'],[net,'createConnection'],[tls,'connect']])t.mock.method(module,key,()=>assert.fail('No real network or SMTP allowed'));
 const transport=nodemailer.createTransport({streamTransport:true,buffer:true});
 try{
  const info=await transport.sendMail({from:'sender@example.invalid',to,subject:'Synthetic regression',text:'Synthetic content only'});
  const flatten=items=>items.flatMap(item=>item.group?flatten(item.group):[item.address]);
  assert.deepEqual(flatten(addressparser(to)),[expected],'RFC parser must not extract the address hidden in display text');
  // mime-node explicitly normalizes <> and control bytes to spaces. Assert its
  // exact safe envelope as well as the unmodified parser mailbox above.
  assert.deepEqual(info.envelope.to,[normalized]);assert.ok(Buffer.isBuffer(info.message));
 }finally{transport.close();}
});
