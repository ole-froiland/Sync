-- Sync social layer: follows + connections (sync requests)

-- ─────────────────────────────────────────
-- FOLLOWS (one-way)
-- ─────────────────────────────────────────
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

drop policy if exists "Follows are viewable by authenticated users" on public.follows;
create policy "Follows are viewable by authenticated users"
  on public.follows for select using (auth.role() = 'authenticated');

drop policy if exists "Users can follow on their own behalf" on public.follows;
create policy "Users can follow on their own behalf"
  on public.follows for insert with check (auth.uid() = follower_id);

drop policy if exists "Users can unfollow on their own behalf" on public.follows;
create policy "Users can unfollow on their own behalf"
  on public.follows for delete using (auth.uid() = follower_id);

create index if not exists follows_following_idx on public.follows (following_id);

-- ─────────────────────────────────────────
-- CONNECTIONS (sync requests, mutual once accepted)
-- ─────────────────────────────────────────
create table if not exists public.connections (
  id            uuid primary key default uuid_generate_v4(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  addressee_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table public.connections enable row level security;

drop policy if exists "Connections viewable by participants" on public.connections;
create policy "Connections viewable by participants"
  on public.connections for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users can request a sync" on public.connections;
create policy "Users can request a sync"
  on public.connections for insert
  with check (auth.uid() = requester_id);

drop policy if exists "Participants can update their connection" on public.connections;
create policy "Participants can update their connection"
  on public.connections for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Participants can delete their connection" on public.connections;
create policy "Participants can delete their connection"
  on public.connections for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create index if not exists connections_addressee_idx on public.connections (addressee_id);
create index if not exists connections_requester_idx on public.connections (requester_id);
