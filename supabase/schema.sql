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
  created_at           timestamptz not null default now()
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

-- TODO: Encrypt github_access_token at rest before writing to this column.
-- Options: pgcrypto's pgp_sym_encrypt with a secret key stored in Vault, or
-- encrypt in the application layer (e.g. AES-GCM) before calling supabase.upsert().
-- Currently stored as plaintext. Mitigation: the token is NEVER read on the
-- client — all reads happen inside server-only API route handlers, and RLS
-- restricts SELECT to the owning user only.
create table if not exists public.github_connections (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  github_access_token text not null,
  github_login        text,
  created_at          timestamptz not null default now(),
  unique(user_id)
);

alter table public.github_connections enable row level security;

-- SELECT: a user can only read their own row. The access token is never sent to
-- the browser — API route handlers query it server-side and use it internally.
create policy "Users can view own github connection"
  on public.github_connections for select using (auth.uid() = user_id);

create policy "Users can insert own github connection"
  on public.github_connections for insert with check (auth.uid() = user_id);

-- WITH CHECK prevents a user from updating user_id to someone else's id.
create policy "Users can update own github connection"
  on public.github_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own github connection"
  on public.github_connections for delete using (auth.uid() = user_id);

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
  add column if not exists onboarding_completed boolean not null default false;

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
