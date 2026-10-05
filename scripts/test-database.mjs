import { PGlite } from '@electric-sql/pglite';
import { readFileSync,readdirSync } from 'node:fs';
const root=new URL('..',import.meta.url).pathname;
// Isolated PostgreSQL WASM harness; auth/storage stubs and test randomness stay here.
// Real cross-session concurrency is tested separately against the demo project.
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create function public.gen_random_bytes(n integer) returns bytea language sql as $$ select decode(repeat(md5(random()::text),ceil(n/16.0)::int),'hex') $$;
`);
for(const file of readdirSync(root+'/supabase/migrations').sort()){
 const text=readFileSync(root+'/supabase/migrations/'+file,'utf8');
 try{await db.exec(text);process.stdout.write('OK '+file+'\n');}catch(e){process.stderr.write('FAIL '+file+': '+e.message+'\n');console.log(e.where);process.exit(1);}
}
try {await db.exec(readFileSync(root+'/supabase/tests/structured_order_capacity.sql','utf8'));console.log('SQL TESTS PASS');} catch(e) {console.log('TEST FAIL:',e.message,e.where);process.exit(1);}
await db.close();
