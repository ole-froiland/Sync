export const chatReadStorageKey = (profileId: string) => `sync-chat-last-read:${profileId}`
export const chatMuteStorageKey = (profileId: string) => `sync-chat-muted:${profileId}`
export const CHAT_META_EVENT = 'sync-chat-meta-changed'

export function readChatReadMap(profileId: string): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(chatReadStorageKey(profileId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeChatReadMap(profileId: string, value: Record<string, string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(chatReadStorageKey(profileId), JSON.stringify(value))
  } catch {
    // ignore storage quota errors
  }
  window.dispatchEvent(new CustomEvent(CHAT_META_EVENT))
}

export function readMutedUserIds(profileId: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(chatMuteStorageKey(profileId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeMutedUserIds(profileId: string, userIds: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(chatMuteStorageKey(profileId), JSON.stringify(userIds))
  } catch {
    // ignore storage quota errors
  }
  window.dispatchEvent(new CustomEvent(CHAT_META_EVENT))
}
