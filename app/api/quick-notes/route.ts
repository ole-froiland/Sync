import { createHash, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The notes list for a device that has no browser session: the Hjemskjerm
 * widget on Ole's iPhone. It authenticates with one long bearer token instead
 * of a Supabase login, and can only ever touch the one user named in
 * QUICK_NOTES_USER_ID. Same table as /notes, so both show the same list.
 */

function tokenMatches(header: string | null): boolean {
  const expected = process.env.QUICK_NOTES_TOKEN ?? ''
  const given = header?.startsWith('Bearer ') ? header.slice(7) : ''
  if (expected.length < 32 || !given) return false
  // Hash both sides so the comparison is constant-time regardless of length.
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

function admin(): Gate | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const userId = process.env.QUICK_NOTES_USER_ID
  if (!url || !key || !userId) return null
  return { db: createClient(url, key, { auth: { persistSession: false } }), userId }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Gate = { db: SupabaseClient<any>; userId: string }

function gate(request: Request): Gate | NextResponse {
  if (!tokenMatches(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const ctx = admin()
  if (!ctx) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  return ctx
}

const FIELDS = 'id,title,created_at,completed_at'

export async function GET(request: Request) {
  const ctx = gate(request)
  if (ctx instanceof NextResponse) return ctx

  const { data, error } = await ctx.db
    .from('notes')
    .select(FIELDS)
    .eq('user_id', ctx.userId)
    .is('completed_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notes: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const ctx = gate(request)
  if (ctx instanceof NextResponse) return ctx

  const body = (await request.json().catch(() => ({}))) as { title?: string }
  const title = body.title?.trim().slice(0, 500)
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const { data, error } = await ctx.db
    .from('notes')
    .insert({ title, user_id: ctx.userId })
    .select(FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data })
}

export async function PATCH(request: Request) {
  const ctx = gate(request)
  if (ctx instanceof NextResponse) return ctx

  const body = (await request.json().catch(() => ({}))) as { id?: string; completed?: boolean }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await ctx.db
    .from('notes')
    .update({ completed_at: body.completed === false ? null : new Date().toISOString() })
    .eq('id', body.id)
    .eq('user_id', ctx.userId)
    .select(FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data })
}
