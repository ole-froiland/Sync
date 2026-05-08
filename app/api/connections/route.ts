import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type SyncState = 'pending' | 'request_received' | 'synced'
export type SyncMap = Record<string, SyncState>

// Kept for backwards compatibility with existing consumers (chat, ShareRepoModal)
// that filter on `state === 'synced'`. Follow state is now returned separately
// in `follows` so a user can be following AND have any sync state.
export type ConnectionState = 'none' | 'following' | SyncState
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

  const sync: SyncMap = {}

  for (const row of (connectionsRes.data ?? []) as Array<{
    requester_id: string
    addressee_id: string
    status: 'pending' | 'accepted'
  }>) {
    const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id
    if (row.status === 'accepted') {
      sync[otherId] = 'synced'
    } else if (sync[otherId] !== 'synced') {
      sync[otherId] = row.requester_id === user.id ? 'pending' : 'request_received'
    }
  }

  const follows = (followsRes.data ?? []).map((row) => (row as { following_id: string }).following_id)

  // Mirror sync state into the legacy `connections` map for callers that only
  // care about the 'synced' filter. Follow is intentionally not merged in here.
  const connections: ConnectionMap = { ...sync }

  return NextResponse.json({ userId: user.id, connections, follows, sync })
}
