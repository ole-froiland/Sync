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
    return NextResponse.json({ ok: true, status: 'synced' })
  }

  const { error } = await supabase
    .from('connections')
    .upsert(
      { requester_id: user.id, addressee_id: id, status: 'pending' },
      { onConflict: 'requester_id,addressee_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
  return NextResponse.json({ ok: true })
}
