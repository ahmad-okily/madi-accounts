-- MADI Accounts: database setup.
-- Paste all of this into Supabase > SQL Editor > New query, then press Run. Run it once.

-- One table holds every record (products, customers, invoices, payments, settings).
create table if not exists public.docs (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (collection, id)
);
create index if not exists docs_updated_at_idx on public.docs (updated_at);

-- The server stamps the time and the user on every save, so devices sync in the right order.
create or replace function public.docs_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
for each row execute function public.docs_touch();

-- Security: only signed-in users (accounts you create) can read or write. Nobody else.
alter table public.docs enable row level security;
drop policy if exists "team can read" on public.docs;
drop policy if exists "team can add" on public.docs;
drop policy if exists "team can change" on public.docs;
create policy "team can read" on public.docs for select to authenticated using (true);
create policy "team can add" on public.docs for insert to authenticated with check (true);
create policy "team can change" on public.docs for update to authenticated using (true) with check (true);
-- No delete policy on purpose: deleting in the app marks a record as deleted, so other devices learn about it.

-- Live updates between your device and the manager's.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
