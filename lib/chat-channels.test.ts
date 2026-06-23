import { describe, expect, it } from 'vitest'
import {
  CHAT_CHANNEL_PREFIX,
  addChannel,
  channelToProject,
  isChatChannelId,
  parseChannels,
  removeChannel,
  type ChatChannel,
} from './chat-channels'

const sample: ChatChannel = {
  id: `${CHAT_CHANNEL_PREFIX}1`,
  name: 'Marketing',
  createdAt: '2026-06-24T10:00:00.000Z',
}

describe('isChatChannelId', () => {
  it('matches ids with the channel prefix', () => {
    expect(isChatChannelId(`${CHAT_CHANNEL_PREFIX}abc`)).toBe(true)
  })
  it('rejects folder ids and other ids', () => {
    expect(isChatChannelId('project-folder:abc')).toBe(false)
    expect(isChatChannelId('proj-1')).toBe(false)
  })
})

describe('parseChannels', () => {
  it('returns [] for null', () => {
    expect(parseChannels(null)).toEqual([])
  })
  it('returns [] for invalid JSON', () => {
    expect(parseChannels('{not json')).toEqual([])
  })
  it('returns [] for non-array JSON', () => {
    expect(parseChannels('{"id":"x"}')).toEqual([])
  })
  it('drops malformed entries and keeps valid ones', () => {
    const raw = JSON.stringify([
      sample,
      { name: 'no id' },
      { id: 'only-id' },
      { id: 'x', name: 'no date' },
      42,
    ])
    expect(parseChannels(raw)).toEqual([sample])
  })
})

describe('addChannel', () => {
  it('prepends the new channel', () => {
    const other: ChatChannel = {
      id: `${CHAT_CHANNEL_PREFIX}2`,
      name: 'HR',
      createdAt: '2026-06-24T11:00:00.000Z',
    }
    expect(addChannel([sample], other)).toEqual([other, sample])
  })
})

describe('removeChannel', () => {
  it('removes the matching channel', () => {
    expect(removeChannel([sample], sample.id)).toEqual([])
  })
  it('leaves the list unchanged when the id is absent', () => {
    expect(removeChannel([sample], 'nope')).toEqual([sample])
  })
})

describe('channelToProject', () => {
  it('maps a channel into the Project shape', () => {
    expect(channelToProject(sample)).toEqual({
      id: sample.id,
      name: 'Marketing',
      description: null,
      status: 'idea',
      tech_stack: null,
      github_url: null,
      demo_url: null,
      created_by: 'local',
      created_at: sample.createdAt,
      member_count: 0,
      task_count: 0,
      members: [],
    })
  })
})
