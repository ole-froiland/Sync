-- Fix RLS gaps that made parts of the sync-request flow silent no-ops.
--
-- direct_messages previously had no DELETE policy and only a receiver-side
-- UPDATE policy. Three API routes rely on operations those policies block
-- (RLS filters the rows out, so the calls "succeed" while touching 0 rows):
--
--   • POST /api/people/[id]/sync          — the SENDER re-marks an existing
--     sync_request message as 'sent' when re-requesting after an unsync.
--   • DELETE /api/people/[id]/sync        — unsync deletes sync_request
--     messages in both directions.
--   • POST /api/people/[id]/sync/reject and
--     POST /api/direct-messages/[id]/respond (reject) — the receiver deletes
--     the sync_request message.
--
-- Both new policies are scoped to payload kind 'sync_request' so ordinary
-- chat messages stay immutable/undeletable by the other participant.
--
-- Safe to run more than once.

drop policy if exists "Sender can re-send their sync request" on public.direct_messages;
create policy "Sender can re-send their sync request"
  on public.direct_messages for update
  using (auth.uid() = sender_id and payload->>'kind' = 'sync_request');

drop policy if exists "Participants can delete sync request messages" on public.direct_messages;
create policy "Participants can delete sync request messages"
  on public.direct_messages for delete
  using (
    (auth.uid() = sender_id or auth.uid() = receiver_id)
    and payload->>'kind' = 'sync_request'
  );
