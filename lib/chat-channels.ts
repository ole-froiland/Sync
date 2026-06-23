import type { Project } from '@/types'

export const CHAT_CHANNELS_STORAGE_KEY = 'sync-chat-channels-v1'
export const CHAT_CHANNEL_PREFIX = 'chat-channel:'

export type ChatChannel = {
  id: string
  name: string
  createdAt: string
}

// --- Pure helpers (unit-tested) ---

export function isChatChannelId(id: string): boolean {
  return id.startsWith(CHAT_CHANNEL_PREFIX)
}

function isValidChannel(value: unknown): value is ChatChannel {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ChatChannel).id === 'string' &&
    typeof (value as ChatChannel).name === 'string' &&
    typeof (value as ChatChannel).createdAt === 'string'
  )
}

export function parseChannels(raw: string | null): ChatChannel[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidChannel)
  } catch {
    return []
  }
}

export function addChannel(list: ChatChannel[], channel: ChatChannel): ChatChannel[] {
  return [channel, ...list]
}

export function removeChannel(list: ChatChannel[], id: string): ChatChannel[] {
  return list.filter((channel) => channel.id !== id)
}

export function channelToProject(channel: ChatChannel): Project {
  return {
    id: channel.id,
    name: channel.name,
    description: null,
    status: 'idea',
    tech_stack: null,
    github_url: null,
    demo_url: null,
    created_by: 'local',
    created_at: channel.createdAt,
    member_count: 0,
    task_count: 0,
    members: [],
  }
}

// --- localStorage wrappers (mirror lib/chat-meta.ts; not unit-tested) ---

export function readChatChannels(): ChatChannel[] {
  if (typeof window === 'undefined') return []
  return parseChannels(window.localStorage.getItem(CHAT_CHANNELS_STORAGE_KEY))
}

export function writeChatChannels(channels: ChatChannel[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CHAT_CHANNELS_STORAGE_KEY, JSON.stringify(channels))
}

export function createChatChannel(name: string): ChatChannel {
  const channel: ChatChannel = {
    id: `${CHAT_CHANNEL_PREFIX}${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  }
  writeChatChannels(addChannel(readChatChannels(), channel))
  return channel
}

export function deleteChatChannel(id: string): void {
  writeChatChannels(removeChannel(readChatChannels(), id))
}
