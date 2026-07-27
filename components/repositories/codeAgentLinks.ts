export function codexDeepLink(originUrl: string) {
  const query = new URLSearchParams({ originUrl })
  return `codex://threads/new?${query.toString()}`
}

export function claudeAppDeepLink(
  repoFullName: string,
  defaultBranch: string,
  folder?: string
) {
  const branchContext = defaultBranch ? ` on branch ${defaultBranch}` : ''
  const query = new URLSearchParams({
    q: `Work in the GitHub repository ${repoFullName}${branchContext}.`,
  })
  if (folder) query.set('folder', folder)

  return `claude://code/new?${query.toString()}`
}
