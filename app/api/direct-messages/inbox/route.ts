import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type InboxItem = {
  id: string
  sender_id: string
  receiver_id: string
  type: 'text' | 'repo_share' | 'project_folder_share'
  state: 'sent' | 'accepted' | 'rejected'
  created_at: string
  payload: { kind?: 'sync_request' } | null
}

type InboxSummaryItem = Omit<InboxItem, 'payload'> & {
  payload_kind: 'sync_request' | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const summary = new URL(request.url).searchParams.get('summary') === '1'
  const query = supabase
    .from('direct_messages')
    .select(
      summary
        ? 'id, sender_id, receiver_id, type, state, created_at, payload_kind:payload->>kind'
        : 'id, sender_id, receiver_id, type, state, created_at, payload'
    )
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(400)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    userId: user.id,
    items: (data ?? []) as unknown as InboxItem[] | InboxSummaryItem[],
  })
}
