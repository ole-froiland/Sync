export function codexDeepLink(originUrl: string) {
  const query = new URLSearchParams({ originUrl })
  return `codex://threads/new?${query.toString()}`
}

export function claudeCodeDeepLink(repoFullName: string) {
  const query = new URLSearchParams({ repo: repoFullName })
  return `claude-cli://open?${query.toString()}`
}
