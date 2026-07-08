import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const completed = searchParams.get('completed') === '1'

  let query = auth.supabase
    .from('notes')
    .select('*')
    .eq('user_id', auth.user.id)

  query = completed
    ? query.not('completed_at', 'is', null).order('completed_at', { ascending: false })
    : query.is('completed_at', null).order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { title?: string }
  const title = body.title?.trim()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('notes')
    .insert({ title, user_id: auth.user.id })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { id?: string; completed?: boolean }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('notes')
    .update({ completed_at: body.completed === false ? null : new Date().toISOString() })
    .eq('id', body.id)
    .eq('user_id', auth.user.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await auth.supabase
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
