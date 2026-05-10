import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const { data: incoming, error: lookupError } = await supabase
    .from('connections')
    .select('id, status')
    .eq('requester_id', id)
    .eq('addressee_id', user.id)
    .maybeSingle()

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!incoming) {
    return NextResponse.json({ error: 'No pending request from this user.' }, { status: 404 })
  }
  if (incoming.status === 'accepted') {
    return NextResponse.json({ ok: true, status: 'synced' })
  }

  const { error } = await supabase
    .from('connections')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', incoming.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: messageError } = await supabase
    .from('direct_messages')
    .update({ state: 'accepted', updated_at: new Date().toISOString() })
    .eq('sender_id', id)
    .eq('receiver_id', user.id)
    .contains('payload', { kind: 'sync_request' })
    .eq('state', 'sent')

  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 })
  return NextResponse.json({ ok: true, status: 'synced' })
}
