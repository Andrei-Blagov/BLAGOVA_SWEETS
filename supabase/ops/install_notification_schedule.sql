-- Hosted demo infrastructure, separate from portable application migrations.
-- No secret value is returned. Replay preserves the existing credential.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.secrets where name='blagova_notification_worker_token') then
  perform vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'blagova_notification_worker_token','Dedicated notification scheduler credential');
 end if;
 if not exists(select 1 from vault.secrets where name='blagova_notification_worker_url') then
  perform vault.create_secret('https://upmmgdshvgyqivfsyqju.supabase.co/functions/v1/notification-worker','blagova_notification_worker_url','Demo project worker endpoint');
 end if;
end $$;
select cron.schedule('blagova-notification-worker','*/2 * * * *',$job$
 select net.http_post(url:=(select decrypted_secret from vault.decrypted_secrets where name='blagova_notification_worker_url'),headers:=jsonb_build_object('Content-Type','application/json','x-blagova-worker-token',(select decrypted_secret from vault.decrypted_secrets where name='blagova_notification_worker_token')),body:='{}'::jsonb,timeout_milliseconds:=60000);
$job$);
