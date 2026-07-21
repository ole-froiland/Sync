-- Turn project-folder shares into live collaborative folder trees.

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
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shared_project_folders folder
    where folder.id = target_folder_id
      and (
        folder.owner_id = auth.uid()
        or exists (
          select 1
          from public.shared_project_folder_members member
          where member.shared_folder_id = folder.id
            and member.user_id = auth.uid()
            and member.status = 'accepted'
        )
      )
  );
$$;

create or replace function public.is_shared_project_folder_owner(target_folder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shared_project_folders folder
    where folder.id = target_folder_id
      and folder.owner_id = auth.uid()
  );
$$;

grant execute on function public.can_access_shared_project_folder(uuid) to authenticated;
grant execute on function public.is_shared_project_folder_owner(uuid) to authenticated;

alter table public.shared_project_folders enable row level security;
alter table public.shared_project_folder_members enable row level security;

drop policy if exists "Collaborators can view shared project folders" on public.shared_project_folders;
create policy "Collaborators can view shared project folders"
  on public.shared_project_folders for select
  using (public.can_access_shared_project_folder(id));

drop policy if exists "Owners can create shared project folders" on public.shared_project_folders;
create policy "Owners can create shared project folders"
  on public.shared_project_folders for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Collaborators can update shared project folders" on public.shared_project_folders;
create policy "Collaborators can update shared project folders"
  on public.shared_project_folders for update
  using (public.can_access_shared_project_folder(id))
  with check (public.can_access_shared_project_folder(id));

drop policy if exists "Owners can delete shared project folders" on public.shared_project_folders;
create policy "Owners can delete shared project folders"
  on public.shared_project_folders for delete
  using (auth.uid() = owner_id);

drop policy if exists "Participants can view shared folder members" on public.shared_project_folder_members;
create policy "Participants can view shared folder members"
  on public.shared_project_folder_members for select
  using (user_id = auth.uid() or public.can_access_shared_project_folder(shared_folder_id));

drop policy if exists "Owners can invite shared folder members" on public.shared_project_folder_members;
create policy "Owners can invite shared folder members"
  on public.shared_project_folder_members for insert
  with check (public.is_shared_project_folder_owner(shared_folder_id));

drop policy if exists "Participants can update shared folder membership" on public.shared_project_folder_members;
create policy "Participants can update shared folder membership"
  on public.shared_project_folder_members for update
  using (user_id = auth.uid() or public.is_shared_project_folder_owner(shared_folder_id))
  with check (user_id = auth.uid() or public.is_shared_project_folder_owner(shared_folder_id));

drop policy if exists "Owners can remove shared folder members" on public.shared_project_folder_members;
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

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shared_project_folders'
  ) then
    alter publication supabase_realtime add table public.shared_project_folders;
  end if;
end
$$;
