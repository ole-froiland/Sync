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

  const { error } = await supabase
    .from('connections')
    .delete()
    .eq('requester_id', id)
    .eq('addressee_id', user.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: messageError } = await supabase
    .from('direct_messages')
    .delete()
    .eq('sender_id', id)
    .eq('receiver_id', user.id)
    .contains('payload', { kind: 'sync_request' })

  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
