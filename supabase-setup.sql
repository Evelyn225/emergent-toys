-- Run once in your Supabase project's SQL Editor.
create table if not exists public.ottawa_trip_fields (
 key text primary key,
 value jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.ottawa_trip_fields enable row level security;
revoke all on public.ottawa_trip_fields from anon, authenticated;
grant select, insert, update on public.ottawa_trip_fields to service_role;
-- No browser key or public database policy is needed: Vercel talks to this table.
