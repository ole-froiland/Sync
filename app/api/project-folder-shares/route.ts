import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { collaborationFingerprint, collaborationSnapshot } from '@/lib/project-folder-collaboration'
import { isUuid } from '@/lib/uuid'
import type { ProjectFolder, ProjectFolderMember } from '@/types'

type ShareBody = {
  receiver_id?: string
  collaboration_id?: string
  root_folder_id?: string
  folders?: unknown
}

type ProfileRow = { id: string; name: string; avatar_url: string | null }
type MemberRow = {
  user_id: string
  role: 'editor'
  status: 'pending' | 'accepted' | 'rejected'
  profile: ProfileRow | ProfileRow[] | null
}

type SharedFolderRow = {
  id: string
  owner_id: string
  root_folder_id: string
  folders: unknown
  updated_at: string
  owner: ProfileRow | ProfileRow[] | null
  members: MemberRow[] | null
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function isMissingCollaborationTable(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ''
  return (
    error?.code === '42P01' ||
    message.includes('shared_project_folders') ||
    message.includes('shared_project_folder_members')
  )
}

function isTypeConstraintError(error: { code?: string; message?: string } | null) {
  return error?.code === '23514' && (error.message ?? '').includes('direct_messages_type_check')
}

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

function collaborationJson(row: SharedFolderRow, currentUserId: string) {
  const owner = relationOne(row.owner)
  const ownerMember: ProjectFolderMember | null = owner
    ? { id: owner.id, name: owner.name, avatar_url: owner.avatar_url, role: 'creator' }
    : null
  const members = new Map<string, ProjectFolderMember>()
  if (ownerMember) members.set(ownerMember.id, ownerMember)

  for (const member of row.members ?? []) {
    if (member.status !== 'accepted') continue
    const profile = relationOne(member.profile)
    if (!profile) continue
    members.set(profile.id, {
      id: profile.id,
      name: profile.name,
      avatar_url: profile.avatar_url,
      role: 'member',
    })
  }

  return {
    id: row.id,
    ownerId: row.owner_id,
    rootFolderId: row.root_folder_id,
    folders: isProjectFolderArray(row.folders) ? row.folders : [],
    updatedAt: row.updated_at,
    members: [...members.values()],
    sharedFrom: row.owner_id !== currentUserId ? ownerMember ?? undefined : undefined,
  }
}

async function ensureSynced(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  receiverId: string
) {
  const { data, error } = await supabase
    .from('connections')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${receiverId}),and(requester_id.eq.${receiverId},addressee_id.eq.${userId})`
    )
    .maybeSingle()

  if (error) return { ok: false as const, status: 500, error: error.message }
  if (!data) return { ok: false as const, status: 403, error: 'You are not synced with this user.' }
  return { ok: true as const }
}

const COLLABORATION_SELECT = `
  id,
  owner_id,
  root_folder_id,
  folders,
  updated_at,
  owner:profiles!shared_project_folders_owner_id_fkey(id, name, avatar_url),
  members:shared_project_folder_members(
    user_id,
    role,
    status,
    profile:profiles!shared_project_folder_members_user_id_fkey(id, name, avatar_url)
  )
`

// Billig endringssjekk: `updated_at` per rad er noen få byte, mot et helt
// mappetre med notatinnhold og logoer i det fulle svaret.
const CHANGE_PROBE_SELECT = 'id, updated_at'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const knownFingerprint = new URL(request.url).searchParams.get('fingerprint')

  const { data: stamps, error: stampsError } = await supabase
    .from('shared_project_folders')
    .select(CHANGE_PROBE_SELECT)

  if (isMissingCollaborationTable(stampsError)) {
    return NextResponse.json({ collaborations: [], sync: 'unavailable' })
  }
  if (stampsError) return NextResponse.json({ error: stampsError.message }, { status: 500 })

  const fingerprint = collaborationFingerprint((stamps ?? []) as { id: string; updated_at: string }[])
  if (knownFingerprint && knownFingerprint === fingerprint) {
    return NextResponse.json({ unchanged: true, fingerprint })
  }

  const { data, error } = await supabase
    .from('shared_project_folders')
    .select(COLLABORATION_SELECT)
    .order('updated_at', { ascending: false })

  if (isMissingCollaborationTable(error)) {
    return NextResponse.json({ collaborations: [], sync: 'unavailable' })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    fingerprint,
    collaborations: ((data ?? []) as unknown as SharedFolderRow[]).map((row) =>
      collaborationJson(row, user.id)
    ),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as ShareBody | null
  const receiverId = body?.receiver_id
  const rootFolderId = body?.root_folder_id?.trim()
  if (!receiverId || !isUuid(receiverId) || receiverId === user.id) {
    return NextResponse.json({ error: 'receiver_id must be another valid user id.' }, { status: 400 })
  }
  if (!rootFolderId || !isProjectFolderArray(body?.folders)) {
    return NextResponse.json({ error: 'A root folder and folder tree are required.' }, { status: 400 })
  }

  const tree = collaborationSnapshot(body.folders, rootFolderId)
  const rootFolder = tree.find((folder) => folder.id === rootFolderId)
  if (!rootFolder) {
    return NextResponse.json({ error: 'The shared root folder was not found.' }, { status: 400 })
  }

  const sync = await ensureSynced(supabase, user.id, receiverId)
  if (!sync.ok) return NextResponse.json({ error: sync.error }, { status: sync.status })

  let sharedFolder: { id: string; owner_id: string } | null = null
  if (body.collaboration_id) {
    if (!isUuid(body.collaboration_id)) {
      return NextResponse.json({ error: 'Invalid collaboration id.' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('shared_project_folders')
      .update({ folders: tree })
      .eq('id', body.collaboration_id)
      .eq('owner_id', user.id)
      .select('id, owner_id')
      .maybeSingle()
    if (isMissingCollaborationTable(error)) {
      return NextResponse.json(
        { error: 'Live folder collaboration is not installed.', code: 'collaboration_unavailable' },
        { status: 503 }
      )
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Only the folder owner can invite collaborators.' }, { status: 403 })
    sharedFolder = data
  } else {
    const { data, error } = await supabase
      .from('shared_project_folders')
      .upsert(
        { owner_id: user.id, root_folder_id: rootFolderId, folders: tree },
        { onConflict: 'owner_id,root_folder_id' }
      )
      .select('id, owner_id')
      .single()
    if (isMissingCollaborationTable(error)) {
      return NextResponse.json(
        { error: 'Live folder collaboration is not installed.', code: 'collaboration_unavailable' },
        { status: 503 }
      )
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    sharedFolder = data
  }

  const { data: existingMember, error: memberReadError } = await supabase
    .from('shared_project_folder_members')
    .select('status')
    .eq('shared_folder_id', sharedFolder.id)
    .eq('user_id', receiverId)
    .maybeSingle()
  if (memberReadError) return NextResponse.json({ error: memberReadError.message }, { status: 500 })

  const memberStatus = existingMember?.status === 'accepted' ? 'accepted' : 'pending'
  const { error: memberError } = await supabase.from('shared_project_folder_members').upsert(
    {
      shared_folder_id: sharedFolder.id,
      user_id: receiverId,
      role: 'editor',
      status: memberStatus,
    },
    { onConflict: 'shared_folder_id,user_id' }
  )
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  const messagePayload = {
    kind: 'project_folder_share',
    collaboration_id: sharedFolder.id,
    root_folder_id: rootFolderId,
    name: rootFolder.name,
    description: rootFolder.description,
    color: rootFolder.color,
    logo: rootFolder.logo ?? null,
    items: rootFolder.items,
    folders: tree,
    item_count: tree.reduce((count, folder) => count + folder.items.length, 0),
  }
  const insertPayload = {
    sender_id: user.id,
    receiver_id: receiverId,
    type: 'project_folder_share',
    body: null,
    payload: messagePayload,
    state: memberStatus === 'accepted' ? 'accepted' : 'sent',
  }
  let { error: messageError } = await supabase.from('direct_messages').insert(insertPayload)
  if (isTypeConstraintError(messageError)) {
    const retry = await supabase.from('direct_messages').insert({ ...insertPayload, type: 'repo_share' })
    messageError = retry.error
  }
  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 })

  return NextResponse.json({
    collaboration_id: sharedFolder.id,
    root_folder_id: rootFolderId,
    status: memberStatus,
  })
}
