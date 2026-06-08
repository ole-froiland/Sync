-- Persist the Projects page folder tree per user.
-- The client keeps localStorage as a cache, but Supabase is the source of truth.

create table if not exists public.project_folder_states (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  folders    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.project_folder_states enable row level security;

drop policy if exists "Users can view own project folder state" on public.project_folder_states;
drop policy if exists "Users can insert own project folder state" on public.project_folder_states;
drop policy if exists "Users can update own project folder state" on public.project_folder_states;

create policy "Users can view own project folder state"
  on public.project_folder_states for select
  using (auth.uid() = user_id);

create policy "Users can insert own project folder state"
  on public.project_folder_states for insert
  with check (auth.uid() = user_id);

create policy "Users can update own project folder state"
  on public.project_folder_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
