import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type ConnectionState =
  | 'none'
  | 'following'
  | 'pending'
  | 'request_received'
  | 'synced'

export type ConnectionMap = Record<string, ConnectionState>

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [followsRes, connectionsRes] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', user.id),
    supabase
      .from('connections')
      .select('requester_id, addressee_id, status')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
  ])

  if (followsRes.error) {
    return NextResponse.json({ error: followsRes.error.message }, { status: 500 })
  }
  if (connectionsRes.error) {
    return NextResponse.json({ error: connectionsRes.error.message }, { status: 500 })
  }

  const map: ConnectionMap = {}

  for (const row of (connectionsRes.data ?? []) as Array<{
    requester_id: string
    addressee_id: string
    status: 'pending' | 'accepted'
  }>) {
    const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id
    if (row.status === 'accepted') {
      map[otherId] = 'synced'
    } else if (map[otherId] !== 'synced') {
      map[otherId] = row.requester_id === user.id ? 'pending' : 'request_received'
    }
  }

  for (const row of (followsRes.data ?? []) as Array<{ following_id: string }>) {
    if (!map[row.following_id]) {
      map[row.following_id] = 'following'
    }
  }

  return NextResponse.json({ userId: user.id, connections: map })
}
