-- Calendar provider connections for Google, Microsoft Outlook, and Apple CalDAV.

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
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own calendar connections"
  on public.calendar_connections for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_calendar_connections_updated_at on public.calendar_connections;
create trigger set_calendar_connections_updated_at
  before update on public.calendar_connections
  for each row execute function public.set_updated_at();
