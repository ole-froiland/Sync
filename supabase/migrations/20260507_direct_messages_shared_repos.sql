-- ──────────────────────────────────────────────────────────────────────────────
-- Sync social layer + repository sharing
--
-- Creates / re-asserts everything needed for:
--   • sync_requests   → public.connections (status = 'pending' | 'accepted')
--   • synced_users    → public.connections (status = 'accepted'; mutual)
--   • follows         → public.follows (one-way)
--   • direct_messages → public.direct_messages (text + repo_share + project_folder_share)
--   • shared_repos    → public.shared_repos (accepted repo shares)
--
-- Safe to run more than once: every CREATE uses IF NOT EXISTS, every
-- policy is dropped before being re-created, and the realtime publication
-- membership is checked before adding.
-- ──────────────────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- updated_at helper (already in schema.sql, included here so this file
-- can be applied independently in the SQL editor).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- FOLLOWS (one-way "follow" relationship)
-- ──────────────────────────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────────────────────────
-- CONNECTIONS (sync requests + synced users in one row)
--   status = 'pending'  → request sent, awaiting accept
--   status = 'accepted' → mutual sync (friends)
-- ──────────────────────────────────────────────────────────────────────────────
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

drop trigger if exists set_connections_updated_at on public.connections;
create trigger set_connections_updated_at
  before update on public.connections
  for each row execute function public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- DIRECT MESSAGES (1:1, supports text + repo_share + project_folder_share)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.direct_messages (
  id          uuid primary key default uuid_generate_v4(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  type        text not null default 'text' check (type in ('text', 'repo_share', 'project_folder_share')),
  body        text,
  payload     jsonb,
  state       text not null default 'sent' check (state in ('sent', 'accepted', 'rejected')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

alter table public.direct_messages enable row level security;

drop policy if exists "Direct messages viewable by participants" on public.direct_messages;
create policy "Direct messages viewable by participants"
  on public.direct_messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Sender can send direct messages" on public.direct_messages;
create policy "Sender can send direct messages"
  on public.direct_messages for insert
  with check (auth.uid() = sender_id);

drop policy if exists "Receiver can update message state" on public.direct_messages;
create policy "Receiver can update message state"
  on public.direct_messages for update
  using (auth.uid() = receiver_id);

create index if not exists direct_messages_pair_idx
  on public.direct_messages (sender_id, receiver_id, created_at desc);
create index if not exists direct_messages_receiver_idx
  on public.direct_messages (receiver_id, created_at desc);

drop trigger if exists set_direct_messages_updated_at on public.direct_messages;
create trigger set_direct_messages_updated_at
  before update on public.direct_messages
  for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname    = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'direct_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.direct_messages';
  end if;
end$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- SHARED REPOS (accepted repo shares, owned by the receiver)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.shared_repos (
  id                uuid primary key default uuid_generate_v4(),
  owner_user_id     uuid not null references public.profiles(id) on delete cascade,
  source_user_id    uuid references public.profiles(id) on delete set null,
  source_message_id uuid references public.direct_messages(id) on delete set null,
  repo_full_name    text not null,
  repo_url          text not null,
  repo_owner        text,
  repo_description  text,
  repo_language     text,
  created_at        timestamptz not null default now(),
  unique (owner_user_id, repo_full_name)
);

alter table public.shared_repos enable row level security;

drop policy if exists "Shared repos viewable by owner" on public.shared_repos;
create policy "Shared repos viewable by owner"
  on public.shared_repos for select
  using (auth.uid() = owner_user_id);

drop policy if exists "Owner can insert shared repo" on public.shared_repos;
create policy "Owner can insert shared repo"
  on public.shared_repos for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "Owner can delete shared repo" on public.shared_repos;
create policy "Owner can delete shared repo"
  on public.shared_repos for delete
  using (auth.uid() = owner_user_id);

create index if not exists shared_repos_owner_idx
  on public.shared_repos (owner_user_id, created_at desc);
