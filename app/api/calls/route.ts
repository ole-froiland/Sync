import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  CALL_SIGNAL_MAX_AGE_MS,
  isCallSignalKind,
  parseCallSignalPayload,
  type CallSignalKind,
} from '@/lib/call-signaling'
import { isUuid } from '@/lib/uuid'

export const dynamic = 'force-dynamic'

type SignalBody = {
  call_id?: string
  receiver_id?: string
  kind?: CallSignalKind
  payload?: unknown
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Each visit clears only this participant's expired signaling metadata.
  await supabase
    .from('call_signals')
    .delete()
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString())

  const { searchParams } = new URL(request.url)
  const callId = searchParams.get('call_id')
  if (callId) {
    if (!isUuid(callId)) {
      return NextResponse.json({ error: 'call_id must be a valid UUID' }, { status: 400 })
    }

    const afterIdValue = searchParams.get('after_id') ?? '0'
    const afterId = Number(afterIdValue)
    if (!Number.isSafeInteger(afterId) || afterId < 0) {
      return NextResponse.json({ error: 'after_id must be a positive integer' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('call_signals')
      .select('*')
      .eq('call_id', callId)
      .eq('receiver_id', user.id)
      .gt('id', afterId)
      .order('id', { ascending: true })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  const cutoff = new Date(Date.now() - CALL_SIGNAL_MAX_AGE_MS).toISOString()
  const { data: offers, error } = await supabase
    .from('call_signals')
    .select('*, sender:profiles!call_signals_sender_id_fkey(id, name, avatar_url)')
    .eq('receiver_id', user.id)
    .eq('kind', 'offer')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!offers?.length) return NextResponse.json(null)

  const callIds = offers.map((offer) => offer.call_id)
  const { data: terminalSignals, error: terminalError } = await supabase
    .from('call_signals')
    .select('call_id, created_at')
    .in('call_id', callIds)
    .in('kind', ['answer', 'reject', 'end'])

  if (terminalError) return NextResponse.json({ error: terminalError.message }, { status: 500 })

  const pending = offers.find(
    (offer) =>
      !terminalSignals?.some(
        (signal) =>
          signal.call_id === offer.call_id &&
          new Date(signal.created_at).getTime() >= new Date(offer.created_at).getTime()
      )
  )

  return NextResponse.json(pending ?? null)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: SignalBody
  try {
    body = (await request.json()) as SignalBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.call_id || !isUuid(body.call_id)) {
    return NextResponse.json({ error: 'call_id must be a valid UUID' }, { status: 400 })
  }
  if (!body.receiver_id || !isUuid(body.receiver_id)) {
    return NextResponse.json({ error: 'receiver_id must be a valid user id' }, { status: 400 })
  }
  if (body.receiver_id === user.id) {
    return NextResponse.json({ error: 'Cannot call yourself' }, { status: 400 })
  }
  if (!isCallSignalKind(body.kind)) {
    return NextResponse.json({ error: 'Invalid call signal kind' }, { status: 400 })
  }

  const payload = parseCallSignalPayload(body.payload, body.kind)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid call signal payload' }, { status: 400 })
  }

  const sync = await ensureSynced(supabase, user.id, body.receiver_id)
  if (!sync.ok) return NextResponse.json({ error: sync.error }, { status: sync.status })

  const { data, error } = await supabase
    .from('call_signals')
    .insert({
      call_id: body.call_id,
      sender_id: user.id,
      receiver_id: body.receiver_id,
      kind: body.kind,
      payload,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
