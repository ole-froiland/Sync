-- Allow direct messages to carry project folder shares.

alter table public.direct_messages
  drop constraint if exists direct_messages_type_check;

alter table public.direct_messages
  add constraint direct_messages_type_check
  check (type in ('text', 'repo_share', 'project_folder_share'));
