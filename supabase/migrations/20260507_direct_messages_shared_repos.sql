-- Direct messages between users (used for Sync social layer + repo sharing)

create table if not exists public.direct_messages (
  id          uuid primary key default uuid_generate_v4(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  type        text not null default 'text' check (type in ('text', 'repo_share')),
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
  perform 1
    from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
     and tablename  = 'direct_messages';
  if not found then
    execute 'alter publication supabase_realtime add table public.direct_messages';
  end if;
end$$;

-- Repositories shared TO a user that they have accepted
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
