-- Sync – Supabase Database Schema
-- Run this in the Supabase SQL editor to set up the database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text not null unique,
  name                 text not null default '',
  first_name           text,
  last_name            text,
  username             text unique,
  selected_avatar      text,
  avatar_url           text,
  role                 text,
  tools_used           text[],
  onboarding_completed boolean not null default false,
  created_at           timestamptz not null default now(),
  last_active_at       timestamptz
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by workspace members"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ─────────────────────────────────────────
-- INVITES
-- ─────────────────────────────────────────
create table if not exists public.invites (
  id          uuid primary key default uuid_generate_v4(),
  email       text not null,
  token       text not null unique default encode(gen_random_bytes(24), 'hex'),
  accepted    boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.invites enable row level security;

create policy "Invites are viewable by workspace members"
  on public.invites for select using (auth.role() = 'authenticated');

create policy "Members can create invites"
  on public.invites for insert with check (auth.role() = 'authenticated');

create policy "Members can update invites"
  on public.invites for update using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  status      text not null default 'idea' check (status in ('idea', 'building', 'live')),
  tech_stack  text[],
  github_url  text,
  demo_url    text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Projects viewable by workspace members"
  on public.projects for select using (auth.role() = 'authenticated');

create policy "Authenticated users can create projects"
  on public.projects for insert with check (auth.role() = 'authenticated');

create policy "Project creator can update"
  on public.projects for update using (auth.uid() = created_by);

-- ─────────────────────────────────────────
-- PROJECT MEMBERS
-- ─────────────────────────────────────────
create table if not exists public.project_members (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member',
  created_at  timestamptz not null default now(),
  unique(project_id, user_id)
);

alter table public.project_members enable row level security;

create policy "Project members viewable by workspace members"
  on public.project_members for select using (auth.role() = 'authenticated');

create policy "Members can join projects"
  on public.project_members for insert with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- TASKS
-- ─────────────────────────────────────────
create table if not exists public.tasks (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "Tasks viewable by workspace members"
  on public.tasks for select using (auth.role() = 'authenticated');

create policy "Authenticated users can create tasks"
  on public.tasks for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update tasks"
  on public.tasks for update using (auth.role() = 'authenticated');

create policy "Task creator can delete"
  on public.tasks for delete using (auth.uid() = created_by);

-- ─────────────────────────────────────────
-- POSTS (feed)
-- ─────────────────────────────────────────
create table if not exists public.posts (
  id          uuid primary key default uuid_generate_v4(),
  author_id   uuid references public.profiles(id) on delete set null,
  title       text not null,
  body        text not null,
  type        text not null default 'update' check (type in ('update', 'news', 'question', 'resource')),
  source_url  text,
  created_at  timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Posts viewable by workspace members"
  on public.posts for select using (auth.role() = 'authenticated');

create policy "Authenticated users can post"
  on public.posts for insert with check (auth.uid() = author_id);

create policy "Authors can update their posts"
  on public.posts for update using (auth.uid() = author_id);

-- ─────────────────────────────────────────
-- MESSAGES (chat)
-- ─────────────────────────────────────────
create table if not exists public.messages (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  sender_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Messages viewable by workspace members"
  on public.messages for select using (auth.role() = 'authenticated');

create policy "Authenticated users can send messages"
  on public.messages for insert with check (auth.uid() = sender_id);

-- Enable Realtime on messages and posts
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.posts;

-- ─────────────────────────────────────────
-- JOIN REQUESTS
-- ─────────────────────────────────────────
create table if not exists public.join_requests (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at  timestamptz not null default now(),
  unique(project_id, user_id)
);

alter table public.join_requests enable row level security;

create policy "Join requests viewable by workspace members"
  on public.join_requests for select using (auth.role() = 'authenticated');

create policy "Users can request to join"
  on public.join_requests for insert with check (auth.uid() = user_id);

create policy "Project creators can update join requests"
  on public.join_requests for update using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- TRIGGER: auto-create profile on signup
-- ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, avatar_url, onboarding_completed)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────
-- GITHUB CONNECTIONS
-- ─────────────────────────────────────────

-- See supabase/migrations/20240101_github_connections.sql for the full
-- idempotent migration to run in the Supabase SQL editor.
--
-- access_token is never read on the client — all reads happen inside
-- server-only API route handlers, and RLS restricts SELECT to the owning user.
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

alter table public.github_connections enable row level security;

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

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_github_connections_updated_at on public.github_connections;
create trigger set_github_connections_updated_at
  before update on public.github_connections
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────
-- CALENDAR CONNECTIONS
-- ─────────────────────────────────────────
create table if not exists public.calendar_connections (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users(id) on delete cascade,
  provider              text        not null check (provider in ('apple', 'microsoft', 'google')),
  provider_account_id   text,
  provider_account_name text,
  provider_email        text,
  access_token          text,
  refresh_token         text,
  token_type            text,
  scope                 text,
  expires_at            timestamptz,
  caldav_server_url     text,
  caldav_username       text,
  caldav_app_password   text,
  status                text        not null default 'connected' check (status in ('connected', 'error')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.calendar_connections enable row level security;

drop policy if exists "Users can view own calendar connections"   on public.calendar_connections;
drop policy if exists "Users can insert own calendar connections" on public.calendar_connections;
drop policy if exists "Users can update own calendar connections" on public.calendar_connections;
drop policy if exists "Users can delete own calendar connections" on public.calendar_connections;

create policy "Users can view own calendar connections"
  on public.calendar_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert own calendar connections"
  on public.calendar_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own calendar connections"
  on public.calendar_connections for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own calendar connections"
  on public.calendar_connections for delete
  using (auth.uid() = user_id);

drop trigger if exists set_calendar_connections_updated_at on public.calendar_connections;
create trigger set_calendar_connections_updated_at
  before update on public.calendar_connections
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────
-- FUNCTION: check if user has valid invite
-- ─────────────────────────────────────────
create or replace function public.has_valid_invite(user_email text)
returns boolean as $$
  select exists (
    select 1 from public.invites
    where email = user_email and accepted = false
  );
$$ language sql security definer;

-- ═════════════════════════════════════════
-- MIGRATION — run this in the Supabase SQL
-- editor if the profiles table already
-- existed before the onboarding feature
-- was added.  Safe to run more than once.
-- ═════════════════════════════════════════

alter table public.profiles
  add column if not exists first_name           text,
  add column if not exists last_name            text,
  add column if not exists username             text,
  add column if not exists selected_avatar      text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists last_active_at        timestamptz;

-- Add unique constraint on username only if it does not exist yet
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_username_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_username_key unique (username);
  end if;
end$$;

-- Rebuild the trigger function so it records onboarding_completed = false
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, avatar_url, onboarding_completed)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Recreate RLS policies (drop first so re-runs don't error)
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by workspace members" on public.profiles;
drop policy if exists "Users can update their own profile"         on public.profiles;
drop policy if exists "Users can insert their own profile"         on public.profiles;

create policy "Profiles are viewable by workspace members"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using  (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Optional: mark any users who signed up before onboarding was added
-- as already onboarded (so they aren't redirected to /onboarding).
-- Uncomment and run only if you have pre-existing users you want to skip:
-- update public.profiles set onboarding_completed = true where first_name is null;


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

-- Shared project folders are stored once and edited by every accepted collaborator.
-- Existing installations should run 20260721_shared_project_folder_collaboration.sql.
create table if not exists public.shared_project_folders (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  root_folder_id text not null,
  folders        jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (owner_id, root_folder_id)
);

create table if not exists public.shared_project_folder_members (
  shared_folder_id uuid not null references public.shared_project_folders(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  role             text not null default 'editor' check (role = 'editor'),
  status           text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (shared_folder_id, user_id)
);

create or replace function public.can_access_shared_project_folder(target_folder_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shared_project_folders folder
    where folder.id = target_folder_id
      and (
        folder.owner_id = auth.uid()
        or exists (
          select 1 from public.shared_project_folder_members member
          where member.shared_folder_id = folder.id
            and member.user_id = auth.uid()
            and member.status = 'accepted'
        )
      )
  );
$$;

create or replace function public.is_shared_project_folder_owner(target_folder_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shared_project_folders folder
    where folder.id = target_folder_id and folder.owner_id = auth.uid()
  );
$$;

grant execute on function public.can_access_shared_project_folder(uuid) to authenticated;
grant execute on function public.is_shared_project_folder_owner(uuid) to authenticated;

alter table public.shared_project_folders enable row level security;
alter table public.shared_project_folder_members enable row level security;

create policy "Collaborators can view shared project folders"
  on public.shared_project_folders for select
  using (public.can_access_shared_project_folder(id));
create policy "Owners can create shared project folders"
  on public.shared_project_folders for insert
  with check (auth.uid() = owner_id);
create policy "Collaborators can update shared project folders"
  on public.shared_project_folders for update
  using (public.can_access_shared_project_folder(id))
  with check (public.can_access_shared_project_folder(id));
create policy "Owners can delete shared project folders"
  on public.shared_project_folders for delete
  using (auth.uid() = owner_id);

create policy "Participants can view shared folder members"
  on public.shared_project_folder_members for select
  using (user_id = auth.uid() or public.can_access_shared_project_folder(shared_folder_id));
create policy "Owners can invite shared folder members"
  on public.shared_project_folder_members for insert
  with check (public.is_shared_project_folder_owner(shared_folder_id));
create policy "Participants can update shared folder membership"
  on public.shared_project_folder_members for update
  using (user_id = auth.uid() or public.is_shared_project_folder_owner(shared_folder_id))
  with check (user_id = auth.uid() or public.is_shared_project_folder_owner(shared_folder_id));
create policy "Owners can remove shared folder members"
  on public.shared_project_folder_members for delete
  using (public.is_shared_project_folder_owner(shared_folder_id));

create index if not exists shared_project_folder_members_user_idx
  on public.shared_project_folder_members (user_id, status);

drop trigger if exists set_shared_project_folders_updated_at on public.shared_project_folders;
create trigger set_shared_project_folders_updated_at
  before update on public.shared_project_folders
  for each row execute function public.set_updated_at();

drop trigger if exists set_shared_project_folder_members_updated_at on public.shared_project_folder_members;
create trigger set_shared_project_folder_members_updated_at
  before update on public.shared_project_folder_members
  for each row execute function public.set_updated_at();
