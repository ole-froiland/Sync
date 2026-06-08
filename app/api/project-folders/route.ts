import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isFoldersPayload(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function mergeFolders(existing: unknown[], incoming: unknown[]) {
  const byId = new Map<string, unknown>()
  for (const folder of existing) {
    const id = typeof folder === 'object' && folder !== null ? (folder as { id?: unknown }).id : null
    if (typeof id === 'string') byId.set(id, folder)
  }
  for (const folder of incoming) {
    const id = typeof folder === 'object' && folder !== null ? (folder as { id?: unknown }).id : null
    if (typeof id === 'string') byId.set(id, folder)
  }
  return [...byId.values()]
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  return (
    error?.code === '42P01' ||
    error?.message?.toLowerCase().includes('project_folder_states') ||
    error?.message?.toLowerCase().includes('does not exist')
  )
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('project_folder_states')
    .select('folders, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (isMissingTableError(error)) return NextResponse.json({ folders: [], updated_at: null, sync: 'unavailable' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    folders: isFoldersPayload(data?.folders) ? data.folders : [],
    updated_at: data?.updated_at ?? null,
  })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!isFoldersPayload(body?.folders)) {
    return NextResponse.json({ error: 'Expected folders array.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_folder_states')
    .upsert(
      {
        user_id: user.id,
        folders: body.folders,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('folders, updated_at')
    .single()

  if (isMissingTableError(error)) {
    return NextResponse.json({ folders: body.folders, updated_at: null, sync: 'unavailable' }, { status: 202 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!isFoldersPayload(body?.folders)) {
    return NextResponse.json({ error: 'Expected folders array.' }, { status: 400 })
  }

  const { data: existing, error: readError } = await supabase
    .from('project_folder_states')
    .select('folders')
    .eq('user_id', user.id)
    .maybeSingle()

  if (isMissingTableError(readError)) {
    return NextResponse.json({ folders: body.folders, updated_at: null, sync: 'unavailable' }, { status: 202 })
  }
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })

  const merged = mergeFolders(isFoldersPayload(existing?.folders) ? existing.folders : [], body.folders)
  const { data, error } = await supabase
    .from('project_folder_states')
    .upsert(
      {
        user_id: user.id,
        folders: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('folders, updated_at')
    .single()

  if (isMissingTableError(error)) {
    return NextResponse.json({ folders: merged, updated_at: null, sync: 'unavailable' }, { status: 202 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
