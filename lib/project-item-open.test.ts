import { describe, expect, it } from 'vitest'
import { externalOpenTarget, syncRepositoryHref } from './project-item-open'

describe('externalOpenTarget', () => {
  it('converts an uploaded data URL to a blob URL that can open in a new tab', async () => {
    const target = externalOpenTarget('data:image/png;base64,aGVsbG8=')

    expect(target.href).toMatch(/^blob:/)
    expect(await (await fetch(target.href)).text()).toBe('hello')

    target.revoke?.()
  })

  it('keeps ordinary URLs unchanged', () => {
    expect(externalOpenTarget('https://example.com/image.png')).toEqual({
      href: 'https://example.com/image.png',
    })
  })
})

describe('syncRepositoryHref', () => {
  it('returns the internal Sync route for a GitHub repository', () => {
    expect(syncRepositoryHref({ type: 'github', title: 'openai/codex' })).toBe('/repositories/openai/codex')
  })

  it('ignores non-repository items and incomplete repository names', () => {
    expect(syncRepositoryHref({ type: 'url', title: 'OpenAI' })).toBeNull()
    expect(syncRepositoryHref({ type: 'github', title: 'codex' })).toBeNull()
  })
})
