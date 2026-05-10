import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type InboxItem = {
  id: string
  sender_id: string
  receiver_id: string
  type: 'text' | 'repo_share'
  state: 'sent' | 'accepted' | 'rejected'
  created_at: string
  payload: { kind?: 'sync_request' } | null
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('direct_messages')
    .select('id, sender_id, receiver_id, type, state, created_at, payload')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(400)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    userId: user.id,
    items: (data ?? []) as InboxItem[],
  })
}
