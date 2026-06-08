const DEFAULT_SITE_URL = 'http://localhost:3000'

export function getSiteUrl(fallback = DEFAULT_SITE_URL) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const value = configured || fallback

  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/+$/, '')
  }

  const protocol = value.startsWith('localhost') || value.startsWith('127.0.0.1') ? 'http' : 'https'
  return `${protocol}://${value.replace(/^\/+|\/+$/g, '')}`
}
