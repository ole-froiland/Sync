import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RespondBody = { action?: 'accept' | 'reject' }

type RepoSharePayload = {
  kind?: string
  full_name?: string
  name?: string
  url?: string
  owner?: string
  description?: string | null
  language?: string | null
}

type ProjectFolderSharePayload = {
  kind?: string
  name?: string
  items?: unknown[]
}

type SyncRequestPayload = {
  kind?: 'sync_request'
}

function isProjectFolderShare(type: string, payload: unknown) {
  const share = (payload ?? {}) as ProjectFolderSharePayload
  return type === 'project_folder_share' || share.kind === 'project_folder_share' || Array.isArray(share.items)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: RespondBody
  try {
    body = (await request.json()) as RespondBody
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (body.action !== 'accept' && body.action !== 'reject') {
    return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 })
  }

  const { data: message, error: lookupError } = await supabase
    .from('direct_messages')
    .select('id, sender_id, receiver_id, type, payload, state')
    .eq('id', id)
    .maybeSingle()

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  if (message.receiver_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the receiver can respond to this message.' },
      { status: 403 }
    )
  }
  if (message.state !== 'sent') {
    return NextResponse.json({ error: 'This share has already been answered.' }, { status: 409 })
  }

  const nextState = body.action === 'accept' ? 'accepted' : 'rejected'
  const projectFolderShare = isProjectFolderShare(message.type, message.payload)
  const isSyncRequest =
    message.type === 'text' && ((message.payload ?? {}) as SyncRequestPayload).kind === 'sync_request'

  if (message.type !== 'repo_share' && message.type !== 'project_folder_share' && !isSyncRequest) {
    return NextResponse.json({ error: 'This message cannot be answered.' }, { status: 400 })
  }

  if (isSyncRequest) {
    if (body.action === 'accept') {
      const { data: incomingConnection, error: connectionLookupError } = await supabase
        .from('connections')
        .select('id, status')
        .eq('requester_id', message.sender_id)
        .eq('addressee_id', user.id)
        .maybeSingle()

      if (connectionLookupError) {
        return NextResponse.json({ error: connectionLookupError.message }, { status: 500 })
      }
      if (!incomingConnection) {
        return NextResponse.json({ error: 'No pending sync request found.' }, { status: 404 })
      }

      const { error: acceptError } = await supabase
        .from('connections')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', incomingConnection.id)

      if (acceptError) {
        return NextResponse.json({ error: acceptError.message }, { status: 500 })
      }

      const { error: updateError } = await supabase
        .from('direct_messages')
        .update({ state: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', message.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, state: 'accepted' })
    }

    const { error: rejectConnectionError } = await supabase
      .from('connections')
      .delete()
      .eq('requester_id', message.sender_id)
      .eq('addressee_id', user.id)
      .eq('status', 'pending')

    if (rejectConnectionError) {
      return NextResponse.json({ error: rejectConnectionError.message }, { status: 500 })
    }

    const { error: deleteMessageError } = await supabase
      .from('direct_messages')
      .delete()
      .eq('id', message.id)

    if (deleteMessageError) {
      return NextResponse.json({ error: deleteMessageError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, state: 'rejected' })
  }

  if (nextState === 'accepted' && message.type === 'repo_share' && !projectFolderShare) {
    const payload = (message.payload ?? {}) as RepoSharePayload
    const fullName = payload.full_name ?? payload.name
    const url = payload.url
    if (!fullName || !url) {
      return NextResponse.json(
        { error: 'Repo share is missing required fields.' },
        { status: 400 }
      )
    }

    const { error: insertError } = await supabase.from('shared_repos').upsert(
      {
        owner_user_id: user.id,
        source_user_id: message.sender_id,
        source_message_id: message.id,
        repo_full_name: fullName,
        repo_url: url,
        repo_owner: payload.owner ?? fullName.split('/')[0] ?? null,
        repo_description: payload.description ?? null,
        repo_language: payload.language ?? null,
      },
      { onConflict: 'owner_user_id,repo_full_name' }
    )

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  const { error: updateError } = await supabase
    .from('direct_messages')
    .update({ state: nextState, updated_at: new Date().toISOString() })
    .eq('id', message.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, state: nextState })
}
