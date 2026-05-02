-- ─────────────────────────────────────────────────────────────────────────────
-- github_connections — stores per-user GitHub OAuth tokens for repo access.
-- Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Table
create table if not exists public.github_connections (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  github_user_id   bigint,
  github_username  text,
  github_email     text,
  access_token     text        not null,
  token_type       text,
  scope            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id)
);

-- 2. RLS
alter table public.github_connections enable row level security;

-- 3. Policies (drop first so re-runs don't error)
drop policy if exists "Users can view own github connection"   on public.github_connections;
drop policy if exists "Users can insert own github connection" on public.github_connections;
drop policy if exists "Users can update own github connection" on public.github_connections;
drop policy if exists "Users can delete own github connection" on public.github_connections;

create policy "Users can view own github connection"
  on public.github_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert own github connection"
  on public.github_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own github connection"
  on public.github_connections for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own github connection"
  on public.github_connections for delete
  using (auth.uid() = user_id);

-- 4. Auto-update updated_at on every row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_github_connections_updated_at on public.github_connections;
create trigger set_github_connections_updated_at
  before update on public.github_connections
  for each row execute function public.set_updated_at();
