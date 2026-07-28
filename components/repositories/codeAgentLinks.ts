export const LOCAL_PROJECTS_ROOT_STORAGE_KEY = 'sync-local-projects-root'

export function codexDeepLink(originUrl: string) {
  const query = new URLSearchParams({ originUrl })
  return `codex://threads/new?${query.toString()}`
}

/**
 * Claude Desktop opens a new Claude Code session for `claude://code/new`.
 * With a `folder` it starts directly in that working directory; without one it
 * can only land on an empty session, so we fall back to describing the repo.
 */
export function claudeAppDeepLink(
  repoFullName: string,
  defaultBranch: string,
  localFolder?: string | null
) {
  const query = new URLSearchParams()

  if (localFolder) {
    query.set('folder', localFolder)
  } else {
    const branchContext = defaultBranch ? ` on branch ${defaultBranch}` : ''
    query.set('q', `Work in the GitHub repository ${repoFullName}${branchContext}.`)
  }

  return `claude://code/new?${query.toString()}`
}

/**
 * Maps a repository to its checkout below the user's local projects root,
 * assuming the folder is named after the repository. Returns null when the
 * root is unusable, so callers can ask for it instead of building a bad path.
 */
export function localRepoFolder(projectsRoot: string, repoFullName: string) {
  const root = projectsRoot.trim().replace(/\/+$/, '')
  if (!root.startsWith('/')) return null

  const repoName = repoFullName.split('/').pop()?.trim()
  if (!repoName) return null

  return `${root}/${repoName}`
}

// --- localStorage wrappers (mirror lib/chat-channels.ts; not unit-tested) ---

export function readLocalProjectsRoot() {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(LOCAL_PROJECTS_ROOT_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeLocalProjectsRoot(projectsRoot: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_PROJECTS_ROOT_STORAGE_KEY, projectsRoot)
  } catch {
    // ignore
  }
}
