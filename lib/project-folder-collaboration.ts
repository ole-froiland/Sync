import type { ProjectFolder, ProjectFolderMember } from '@/types'

export type ProjectFolderCollaboration = {
  id: string
  ownerId: string
  rootFolderId: string
  folders: ProjectFolder[]
  updatedAt: string
  members: ProjectFolderMember[]
  sharedFrom?: ProjectFolderMember
}

function descendantFolderIds(folders: ProjectFolder[], rootFolderId: string) {
  const ids = new Set([rootFolderId])
  const pending = [rootFolderId]

  while (pending.length > 0) {
    const parentId = pending.pop()
    for (const folder of folders) {
      if (folder.parentId !== parentId || ids.has(folder.id)) continue
      ids.add(folder.id)
      pending.push(folder.id)
    }
  }

  return ids
}

/** Returns the selected folder and every nested project folder below it. */
export function extractProjectFolderTree(folders: ProjectFolder[], rootFolderId: string) {
  const ids = descendantFolderIds(folders, rootFolderId)
  return folders.filter((folder) => ids.has(folder.id))
}

/** Removes client-only collaboration metadata before persisting the shared snapshot. */
export function collaborationSnapshot(folders: ProjectFolder[], rootFolderId: string) {
  return extractProjectFolderTree(folders, rootFolderId).map((folder) => {
    const snapshot = { ...folder }
    delete snapshot.collaborationId
    delete snapshot.collaborationOwnerId
    delete snapshot.collaborationRootId
    return snapshot
  })
}

export function collaborationSnapshotHash(folders: ProjectFolder[], rootFolderId: string) {
  return JSON.stringify(collaborationSnapshot(folders, rootFolderId))
}

function annotateCollaborationFolders(collaboration: ProjectFolderCollaboration) {
  return collaboration.folders.map((folder) => ({
    ...folder,
    parentId:
      folder.id === collaboration.rootFolderId && collaboration.sharedFrom
        ? undefined
        : folder.parentId,
    collaborationId: collaboration.id,
    collaborationOwnerId: collaboration.ownerId,
    collaborationRootId: collaboration.rootFolderId,
    members: collaboration.members,
    sharedFrom: collaboration.sharedFrom,
  }))
}

/** Replaces cached collaboration trees with the latest shared server snapshots. */
export function mergeProjectFolderCollaborations(
  current: ProjectFolder[],
  collaborations: ProjectFolderCollaboration[]
) {
  const incomingIds = new Set(collaborations.flatMap((item) => item.folders.map((folder) => folder.id)))
  const personal = current.filter(
    (folder) => !folder.collaborationId && !incomingIds.has(folder.id)
  )
  return [
    ...personal,
    ...collaborations.flatMap(annotateCollaborationFolders),
  ]
}

/** Received collaboration trees are stored only in the shared table, never in a user's private blob. */
export function personalProjectFolders(
  folders: ProjectFolder[],
  collaborations: ProjectFolderCollaboration[],
  userId: string
) {
  const receivedIds = new Set(
    collaborations
      .filter((collaboration) => collaboration.ownerId !== userId)
      .flatMap((collaboration) =>
        extractProjectFolderTree(folders, collaboration.rootFolderId).map((folder) => folder.id)
      )
  )
  return folders.filter(
    (folder) =>
      !receivedIds.has(folder.id) &&
      (!folder.collaborationOwnerId || folder.collaborationOwnerId === userId)
  )
}
