import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(readFileSync(join(root,'docs/RELEASE_MANIFEST.json'),'utf8'));
assert.equal(manifest.schemaVersion,1);
assert.equal(manifest.candidate.deploymentStatus,'not_deployed');
assert.equal(manifest.backend.schema.liveParity,'not_verified');
assert.equal(manifest.backend.edge.deployedSourceParity,'not_verified');
const inventory=manifest.localSourceInventory;
assert.equal(manifest.inventoryHashFormat,'sha256-utf8-normalized-lf');
for(const {path,sha256} of inventory){
 assert.match(sha256,/^[a-f0-9]{64}$/);
 assert.equal(createHash('sha256').update(readFileSync(join(root,path),'utf8').replace(/\r\n/g,'\n')).digest('hex'),sha256,'Source inventory changed: '+path);
}
const migrations=readdirSync(join(root,'supabase/migrations')).filter(p=>p.endsWith('.sql')).sort();
assert.deepEqual(inventory.filter(x=>x.path.startsWith('supabase/migrations/')).map(x=>x.path.split('/').at(-1)).sort(),migrations);
const walk=dir=>readdirSync(join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
assert.deepEqual(inventory.map(x=>x.path).sort(),[...walk('supabase/migrations'),...walk('supabase/functions'),'supabase/ops/install_notification_schedule.sql'].sort());
assert.equal(manifest.backend.schema.liveHistoryObserved.versions.length,21);
assert.equal(manifest.backend.edge.metadataObserved.functions.length,6);
console.log(`Release manifest valid: ${inventory.length} local source hashes; live schema/Edge parity remains explicitly unverified.`);
