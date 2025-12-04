create table public.calculations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  name text not null,
  negativo numeric default 0,
  cauzione numeric default 0,
  versamenti_settimanali numeric default 0,
  disponibilita numeric default 0
);

alter table public.calculations enable row level security;

drop policy if exists "Users can view their own calculations" on public.calculations;
drop policy if exists "Users can insert their own calculations" on public.calculations;
drop policy if exists "Users can update their own calculations" on public.calculations;
drop policy if exists "Users can delete their own calculations" on public.calculations;

create policy "Authenticated can select calculations"
  on public.calculations for select
  using (auth.role() = 'authenticated');

create policy "Authenticated can insert calculations"
  on public.calculations for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated can update calculations"
  on public.calculations for update
  using (auth.role() = 'authenticated');

create policy "Authenticated can delete calculations"
  on public.calculations for delete
  using (auth.role() = 'authenticated');

create table if not exists public.archives (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  snapshot jsonb not null
);

alter table public.archives enable row level security;

drop policy if exists "Authenticated can select archives" on public.archives;
drop policy if exists "Authenticated can insert archives" on public.archives;
drop policy if exists "Authenticated can delete archives" on public.archives;

create policy "Authenticated can select archives"
  on public.archives for select
  using (auth.role() = 'authenticated');

create policy "Authenticated can insert archives"
  on public.archives for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated can delete archives"
  on public.archives for delete
  using (auth.role() = 'authenticated');
