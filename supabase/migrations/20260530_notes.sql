-- Per-user notes with active/history split.

create table if not exists public.notes (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  title         text        not null check (char_length(title) > 0),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  updated_at    timestamptz not null default now()
);

create index if not exists notes_user_active_idx
  on public.notes (user_id, created_at desc)
  where completed_at is null;

create index if not exists notes_user_completed_idx
  on public.notes (user_id, completed_at desc)
  where completed_at is not null;

alter table public.notes enable row level security;

drop policy if exists "Users can view own notes"   on public.notes;
drop policy if exists "Users can insert own notes" on public.notes;
drop policy if exists "Users can update own notes" on public.notes;
drop policy if exists "Users can delete own notes" on public.notes;

create policy "Users can view own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can insert own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Reuses public.set_updated_at() defined in 20260525_calendar_connections.sql.
drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- Stream INSERT/UPDATE/DELETE to clients (idempotent — safe for db reset).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;
end;
$$;
