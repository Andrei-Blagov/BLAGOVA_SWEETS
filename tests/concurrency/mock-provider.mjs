import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

// An in-memory boundary. No DNS, socket, external credentials or real recipient.
export function mockProvider({failFirst=false}={}) {
  const calls=[];
  return {
    calls,
    async send(url,init) {
      assert.equal(url,'https://api.resend.com/emails');
      assert.equal(init.method,'POST');
      assert.equal(init.headers.Authorization,'Bearer local-mock-provider-key');
      const key=init.headers['Idempotency-Key'];
      assert.match(key,/^blagova\/(confirmation|change)\/[0-9a-f-]{36}$/);
      const body=JSON.parse(init.body);
      assert.deepEqual(body.to,['concurrency@example.invalid']);
      assert.equal(body.from,'local-mock@example.invalid');
      assert.equal(body.reply_to,'local-manager@example.invalid');
      const status=failFirst && calls.length===0?429:200;
      calls.push({key,body_sha256:createHash('sha256').update(init.body).digest('hex'),status});
      return Response.json(status===200?{id:'local-mock-'+calls.length}:{error:'local fixture 429'},{status});
    },
  };
}
