-- Append-only audit trail for Sync AI planned and executed actions.

create table if not exists public.ai_audit_events (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  session_id    text,
  tool_name     text,
  status        text        not null check (status in ('planned', 'confirmed', 'executed', 'failed')),
  redacted_args jsonb,
  model         text,
  error_code    text,
  created_at    timestamptz not null default now()
);

create index if not exists ai_audit_events_user_created_idx
  on public.ai_audit_events (user_id, created_at desc);

alter table public.ai_audit_events enable row level security;

drop policy if exists "Users can view own AI audit events" on public.ai_audit_events;
drop policy if exists "Users can insert own AI audit events" on public.ai_audit_events;

create policy "Users can view own AI audit events"
  on public.ai_audit_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own AI audit events"
  on public.ai_audit_events for insert
  with check (auth.uid() = user_id);
