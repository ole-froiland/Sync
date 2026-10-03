-- Lightweight workspace presence. Clients refresh this timestamp while the
-- app is visible; the UI considers a recent heartbeat "active now".
alter table public.profiles
  add column if not exists last_active_at timestamptz;
