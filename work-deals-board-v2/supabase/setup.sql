create extension if not exists pgcrypto;

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  column_key text not null check (column_key in ('submission','sourcing','waiting','later')),
  title text not null,
  subtitle text not null default '',
  notes jsonb not null default '[]'::jsonb,
  paused boolean not null default false,
  sort_order integer not null default 0,
  record_state text not null default 'active',
  archived_at timestamptz,
  archived_from_column text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe migration for projects that already ran the original setup.sql.
alter table public.deals add column if not exists record_state text not null default 'active';
alter table public.deals add column if not exists archived_at timestamptz;
alter table public.deals add column if not exists archived_from_column text;

update public.deals set record_state = 'active' where record_state is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'deals_record_state_check'
      and conrelid = 'public.deals'::regclass
  ) then
    alter table public.deals
      add constraint deals_record_state_check
      check (record_state in ('active','completed','trash'));
  end if;
end $$;

alter table public.deals enable row level security;

-- Make the table usable by the browser-side publishable/anon key.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.deals to anon, authenticated;

drop policy if exists "public read deals" on public.deals;
drop policy if exists "public insert deals" on public.deals;
drop policy if exists "public update deals" on public.deals;
drop policy if exists "public delete deals" on public.deals;

create policy "public read deals" on public.deals for select using (true);
create policy "public insert deals" on public.deals for insert with check (true);
create policy "public update deals" on public.deals for update using (true) with check (true);
create policy "public delete deals" on public.deals for delete using (true);

-- Initial board content from the reference screenshot. Runs only when the table is empty.
do $$
begin
  if not exists (select 1 from public.deals limit 1) then
    insert into public.deals (column_key, title, subtitle, notes, paused, sort_order, record_state) values
      ('submission', 'Jeremy McAdams — Terra Firma', 'Submission approval', '[]', false, 0, 'active'),
      ('sourcing', 'Dylan Brown — All N One Moving', 'Sourcing', '[]', false, 0, 'active'),
      ('sourcing', 'Glenn — Dog Moving Ram Promasters with upfit', '', '["Adaptive cruise control and swivel chair are MUSTS","Not the 2500 or 3500 ext","Waiting to source adaptive cruise control 2500, then upfit with swivel"]', false, 1, 'active'),
      ('sourcing', 'Joe Sheppard — 15 Passenger Van', 'Sourcing', '[]', false, 2, 'active'),
      ('waiting', 'Alberto — Moving Company', 'Waiting on app', '[]', false, 0, 'active'),
      ('waiting', 'Jacuzzi — 12'' box', 'Waiting on app', '[]', false, 1, 'active'),
      ('later', 'Weir', '', '[]', false, 0, 'active'),
      ('later', 'Biscuit', '', '[]', true, 1, 'active'),
      ('later', 'Dom — Pest Control', 'Complicated order', '[]', false, 2, 'active');
  end if;
end $$;

-- Enable realtime updates where supported.
do $$
begin
  begin
    alter publication supabase_realtime add table public.deals;
  exception when duplicate_object then
    null;
  end;
end $$;
