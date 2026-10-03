export function safeInternalRedirect(
  value: string | null | undefined,
  fallback = '/dashboard'
) {
  if (!value?.startsWith('/') || value.startsWith('//')) return fallback

  try {
    const url = new URL(value, 'https://sync.local')
    if (url.origin !== 'https://sync.local') return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
