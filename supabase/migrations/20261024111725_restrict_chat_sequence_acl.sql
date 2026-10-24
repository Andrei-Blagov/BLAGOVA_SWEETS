-- Hosted public-schema default privileges can grant browser roles sequence
-- SELECT/USAGE/UPDATE. Chat ordering is assigned only by the server/staff RPCs.
-- Do not reset the counter, rewrite messages or change project-wide defaults.
revoke all privileges on sequence public.messages_chat_sequence_seq from public,anon,authenticated;
grant usage on sequence public.messages_chat_sequence_seq to service_role;
