create extension if not exists pgcrypto;

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  column_key text not null check (column_key in ('submission','sourcing','waiting','later')),
  title text not null,
  subtitle text not null default '',
  notes jsonb not null default '[]'::jsonb,
  paused boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deals enable row level security;

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
    insert into public.deals (column_key, title, subtitle, notes, paused, sort_order) values
      ('submission', 'Jeremy McAdams — Terra Firma', 'Submission approval', '[]', false, 0),
      ('sourcing', 'Dylan Brown — All N One Moving', 'Sourcing', '[]', false, 0),
      ('sourcing', 'Glenn — Dog Moving Ram Promasters with upfit', '', '["Adaptive cruise control and swivel chair are MUSTS","Not the 2500 or 3500 ext","Waiting to source adaptive cruise control 2500, then upfit with swivel"]', false, 1),
      ('sourcing', 'Joe Sheppard — 15 Passenger Van', 'Sourcing', '[]', false, 2),
      ('waiting', 'Alberto — Moving Company', 'Waiting on app', '[]', false, 0),
      ('waiting', 'Jacuzzi — 12'' box', 'Waiting on app', '[]', false, 1),
      ('later', 'Weir', '', '[]', false, 0),
      ('later', 'Biscuit', '', '[]', true, 1),
      ('later', 'Dom — Pest Control', 'Complicated order', '[]', false, 2);
  end if;
end $$;

-- Enable realtime updates where supported. If Supabase reports that this table is already
-- in the publication, that is harmless and this line can be skipped.
do $$
begin
  begin
    alter publication supabase_realtime add table public.deals;
  exception when duplicate_object then
    null;
  end;
end $$;
