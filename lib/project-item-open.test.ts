import { describe, expect, it } from 'vitest'
import { externalOpenTarget } from './project-item-open'

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
