import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_LIMIT = 200

type RepoSharePayload = {
  full_name?: string
  name?: string
  url?: string
  owner?: string
  description?: string | null
  language?: string | null
}

type ProjectFolderSharePayload = {
  kind?: 'project_folder_share'
  name?: string
  description?: string
  color?: string
  logo?: unknown
  members?: unknown[]
  shared_from?: unknown
  items?: unknown[]
  item_count?: number
}

type SendBody = {
  receiver_id?: string
  type?: 'text' | 'repo_share' | 'project_folder_share'
  body?: string
  payload?: RepoSharePayload | ProjectFolderSharePayload
}

function isTypeConstraintError(error: { code?: string; message?: string } | null) {
  return (
    error?.code === '23514' &&
    (error.message ?? '').includes('direct_messages_type_check')
  )
}

async function ensureSynced(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  otherId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase
    .from('connections')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`
    )
    .maybeSingle()

  if (error) return { ok: false, status: 500, error: error.message }
  if (!data) return { ok: false, status: 403, error: 'You are not synced with this user.' }
  return { ok: true }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const otherId = searchParams.get('with')
  if (!otherId) {
    return NextResponse.json({ error: 'with required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('direct_messages')
    .select('*, sender:profiles!direct_messages_sender_id_fkey(id, name, avatar_url)')
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`
    )
    .order('created_at', { ascending: true })
    .limit(MAX_LIMIT)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: SendBody
  try {
    body = (await request.json()) as SendBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const receiverId = body.receiver_id
  if (!receiverId) {
    return NextResponse.json({ error: 'receiver_id required' }, { status: 400 })
  }
  if (receiverId === user.id) {
    return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
  }

  const type =
    body.type === 'repo_share' || body.type === 'project_folder_share'
      ? body.type
      : 'text'

  if (type === 'text') {
    const text = (body.body ?? '').trim()
    if (!text) {
      return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 })
    }
  } else if (type === 'repo_share') {
    const payload = body.payload as RepoSharePayload | undefined
    if (!payload?.url || !(payload.full_name || payload.name)) {
      return NextResponse.json(
        { error: 'Repo share requires url and name.' },
        { status: 400 }
      )
    }
  } else {
    const payload = body.payload as ProjectFolderSharePayload | undefined
    if (!payload?.name || !Array.isArray(payload.items)) {
      return NextResponse.json(
        { error: 'Project folder share requires name and items.' },
        { status: 400 }
      )
    }
  }

  const sync = await ensureSynced(supabase, user.id, receiverId)
  if (!sync.ok) return NextResponse.json({ error: sync.error }, { status: sync.status })

  const insertPayload = {
    sender_id: user.id,
    receiver_id: receiverId,
    type,
    body: type === 'text' ? body.body!.trim() : null,
    payload:
      type === 'project_folder_share'
        ? { ...(body.payload ?? {}), kind: 'project_folder_share' }
        : type !== 'text'
          ? body.payload ?? null
          : null,
    state: 'sent',
  }

  let { data, error } = await supabase
    .from('direct_messages')
    .insert(insertPayload)
    .select('*, sender:profiles!direct_messages_sender_id_fkey(id, name, avatar_url)')
    .single()

  if (type === 'project_folder_share' && isTypeConstraintError(error)) {
    const retry = await supabase
      .from('direct_messages')
      .insert({ ...insertPayload, type: 'repo_share' })
      .select('*, sender:profiles!direct_messages_sender_id_fkey(id, name, avatar_url)')
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
