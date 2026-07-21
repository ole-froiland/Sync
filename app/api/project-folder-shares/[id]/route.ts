import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { collaborationSnapshot } from '@/lib/project-folder-collaboration'
import { isUuid } from '@/lib/uuid'
import type { ProjectFolder } from '@/types'

function isProjectFolderArray(value: unknown): value is ProjectFolder[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (folder) =>
        typeof folder === 'object' &&
        folder !== null &&
        typeof (folder as ProjectFolder).id === 'string' &&
        typeof (folder as ProjectFolder).name === 'string' &&
        Array.isArray((folder as ProjectFolder).items)
    )
  )
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid collaboration id.' }, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { folders?: unknown } | null
  if (!isProjectFolderArray(body?.folders)) {
    return NextResponse.json({ error: 'Expected a non-empty folders array.' }, { status: 400 })
  }

  const { data: sharedFolder, error: readError } = await supabase
    .from('shared_project_folders')
    .select('root_folder_id')
    .eq('id', id)
    .maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!sharedFolder) return NextResponse.json({ error: 'Shared folder not found.' }, { status: 404 })

  const tree = collaborationSnapshot(body.folders, sharedFolder.root_folder_id)
  if (!tree.some((folder) => folder.id === sharedFolder.root_folder_id)) {
    return NextResponse.json({ error: 'The shared root folder cannot be removed.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('shared_project_folders')
    .update({ folders: tree })
    .eq('id', id)
    .select('updated_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ updatedAt: data.updated_at })
}
