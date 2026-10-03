import type { Locale } from '@/lib/i18n'

export const ACTIVE_NOW_WINDOW_MS = 2 * 60 * 1000

export type PresenceInfo =
  | { state: 'active'; lastActiveAt: Date }
  | { state: 'away'; lastActiveAt: Date }
  | { state: 'unknown'; lastActiveAt: null }

export function getPresenceInfo(
  lastActiveAt: string | null | undefined,
  now = Date.now()
): PresenceInfo {
  if (!lastActiveAt) return { state: 'unknown', lastActiveAt: null }

  const parsed = new Date(lastActiveAt)
  if (Number.isNaN(parsed.getTime())) return { state: 'unknown', lastActiveAt: null }

  const elapsed = Math.max(0, now - parsed.getTime())
  return {
    state: elapsed <= ACTIVE_NOW_WINDOW_MS ? 'active' : 'away',
    lastActiveAt: parsed,
  }
}

export function formatLastActiveValue(
  lastActiveAt: Date,
  locale: Locale,
  now = Date.now()
): string {
  const elapsed = Math.max(0, now - lastActiveAt.getTime())
  const minutes = Math.max(1, Math.floor(elapsed / 60_000))

  if (minutes < 60) {
    return locale === 'no' ? `${minutes} min siden` : `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return locale === 'no' ? `${hours} t siden` : `${hours}h ago`
  }

  const days = Math.floor(hours / 24)
  if (days < 7) {
    return locale === 'no' ? `${days} d siden` : `${days}d ago`
  }

  return new Intl.DateTimeFormat(locale === 'no' ? 'nb-NO' : 'en-US', {
    day: 'numeric',
    month: 'short',
  }).format(lastActiveAt)
}

export function formatMemberSince(createdAt: string, locale: Locale): string {
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return '—'

  return new Intl.DateTimeFormat(locale === 'no' ? 'nb-NO' : 'en-US', {
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}
