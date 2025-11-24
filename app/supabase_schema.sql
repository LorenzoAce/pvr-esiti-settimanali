-- Create the table
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

-- Enable Row Level Security (RLS)
alter table public.calculations enable row level security;

-- Create policies
create policy "Users can view their own calculations"
  on public.calculations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own calculations"
  on public.calculations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own calculations"
  on public.calculations for update
  using (auth.uid() = user_id);

create policy "Users can delete their own calculations"
  on public.calculations for delete
  using (auth.uid() = user_id);
