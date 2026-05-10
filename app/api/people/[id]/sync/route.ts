import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SYNC_REQUEST_BODY = 'Wants to sync with you.'

async function upsertSyncRequestMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requesterId: string,
  addresseeId: string
) {
  const { data: existing, error: lookupError } = await supabase
    .from('direct_messages')
    .select('id, state')
    .eq('sender_id', requesterId)
    .eq('receiver_id', addresseeId)
    .contains('payload', { kind: 'sync_request' })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupError) return { error: lookupError }

  if (existing) {
    const { error } = await supabase
      .from('direct_messages')
      .update({
        body: SYNC_REQUEST_BODY,
        payload: { kind: 'sync_request' },
        state: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    return { error }
  }

  const { error } = await supabase.from('direct_messages').insert({
    sender_id: requesterId,
    receiver_id: addresseeId,
    type: 'text',
    body: SYNC_REQUEST_BODY,
    payload: { kind: 'sync_request' },
    state: 'sent',
  })

  return { error }
}

async function markIncomingSyncRequestAccepted(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requesterId: string,
  addresseeId: string
) {
  const { error } = await supabase
    .from('direct_messages')
    .update({ state: 'accepted', updated_at: new Date().toISOString() })
    .eq('sender_id', requesterId)
    .eq('receiver_id', addresseeId)
    .contains('payload', { kind: 'sync_request' })
    .eq('state', 'sent')

  return { error }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.id === id) {
    return NextResponse.json({ error: 'Cannot sync with yourself' }, { status: 400 })
  }

  // If the other person already requested a sync with us, accept it.
  const { data: incoming, error: incomingErr } = await supabase
    .from('connections')
    .select('id, status')
    .eq('requester_id', id)
    .eq('addressee_id', user.id)
    .maybeSingle()

  if (incomingErr) return NextResponse.json({ error: incomingErr.message }, { status: 500 })

  if (incoming) {
    if (incoming.status === 'accepted') {
      return NextResponse.json({ ok: true, status: 'synced' })
    }
    const { error } = await supabase
      .from('connections')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', incoming.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const { error: messageError } = await markIncomingSyncRequestAccepted(supabase, id, user.id)
    if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'synced' })
  }

  const { error } = await supabase
    .from('connections')
    .upsert(
      { requester_id: user.id, addressee_id: id, status: 'pending' },
      { onConflict: 'requester_id,addressee_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { error: messageError } = await upsertSyncRequestMessage(supabase, user.id, id)
  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 })
  return NextResponse.json({ ok: true, status: 'pending' })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('connections')
    .delete()
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: messageError } = await supabase
    .from('direct_messages')
    .delete()
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`
    )
    .contains('payload', { kind: 'sync_request' })

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
