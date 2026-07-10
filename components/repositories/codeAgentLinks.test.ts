import { describe, expect, it } from 'vitest'
import { claudeCodeDeepLink, codexDeepLink } from './codeAgentLinks'

describe('code agent deep links', () => {
  it('opens Codex in the workspace matching the clone remote', () => {
    expect(codexDeepLink('https://github.com/acme/payments.git')).toBe(
      'codex://threads/new?originUrl=https%3A%2F%2Fgithub.com%2Facme%2Fpayments.git'
    )
  })

  it('opens Claude Code in a previously seen local clone', () => {
    expect(claudeCodeDeepLink('acme/payments')).toBe(
      'claude-cli://open?repo=acme%2Fpayments'
    )
  })

  it('encodes query-string control characters instead of leaking parameters', () => {
    expect(codexDeepLink('https://github.com/acme/payments.git?x=1&prompt=unsafe')).toBe(
      'codex://threads/new?originUrl=https%3A%2F%2Fgithub.com%2Facme%2Fpayments.git%3Fx%3D1%26prompt%3Dunsafe'
    )
    expect(claudeCodeDeepLink('acme/repo&q=unsafe')).toBe(
      'claude-cli://open?repo=acme%2Frepo%26q%3Dunsafe'
    )
  })
})
