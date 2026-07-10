export function codexDeepLink(originUrl: string) {
  const query = new URLSearchParams({ originUrl })
  return `codex://threads/new?${query.toString()}`
}

export function claudeAppDeepLink(repoFullName: string, defaultBranch: string) {
  const branchContext = defaultBranch ? ` on branch ${defaultBranch}` : ''
  const query = new URLSearchParams({
    q: `Work in the GitHub repository ${repoFullName}${branchContext}.`,
  })
  return `claude://code/new?${query.toString()}`
}
