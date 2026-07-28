import { describe, expect, it } from 'vitest'
import { claudeAppDeepLink, codexDeepLink, localRepoFolder } from './codeAgentLinks'

describe('code agent deep links', () => {
  it('opens Codex in the workspace matching the clone remote', () => {
    expect(codexDeepLink('https://github.com/acme/payments.git')).toBe(
      'codex://threads/new?originUrl=https%3A%2F%2Fgithub.com%2Facme%2Fpayments.git'
    )
  })

  it('opens Claude Code directly in Claude Desktop with repository context', () => {
    expect(claudeAppDeepLink('acme/payments', 'main')).toBe(
      'claude://code/new?q=Work+in+the+GitHub+repository+acme%2Fpayments+on+branch+main.'
    )
  })

  it('omits the branch phrase when no default branch is available', () => {
    expect(claudeAppDeepLink('acme/payments', '')).toBe(
      'claude://code/new?q=Work+in+the+GitHub+repository+acme%2Fpayments.'
    )
  })

  it('encodes query-string control characters instead of leaking parameters', () => {
    expect(codexDeepLink('https://github.com/acme/payments.git?x=1&prompt=unsafe')).toBe(
      'codex://threads/new?originUrl=https%3A%2F%2Fgithub.com%2Facme%2Fpayments.git%3Fx%3D1%26prompt%3Dunsafe'
    )
    expect(claudeAppDeepLink('acme/repo&q=unsafe', 'main&folder=/tmp')).toBe(
      'claude://code/new?q=Work+in+the+GitHub+repository+acme%2Frepo%26q%3Dunsafe+on+branch+main%26folder%3D%2Ftmp.'
    )
  })

  it('opens the local checkout instead of an empty session when the folder is known', () => {
    expect(claudeAppDeepLink('acme/payments', 'main', '/Users/me/Projects/payments')).toBe(
      'claude://code/new?folder=%2FUsers%2Fme%2FProjects%2Fpayments'
    )
  })

  it('falls back to the prompt when no local folder is configured', () => {
    expect(claudeAppDeepLink('acme/payments', 'main', null)).toBe(
      'claude://code/new?q=Work+in+the+GitHub+repository+acme%2Fpayments+on+branch+main.'
    )
  })
})

describe('localRepoFolder', () => {
  it('joins the projects root with the repository name', () => {
    expect(localRepoFolder('/Users/me/Projects', 'acme/payments')).toBe(
      '/Users/me/Projects/payments'
    )
  })

  it('tolerates trailing slashes and surrounding whitespace', () => {
    expect(localRepoFolder('  /Users/me/Projects//  ', 'acme/payments')).toBe(
      '/Users/me/Projects/payments'
    )
  })

  it('rejects roots that are not absolute paths', () => {
    expect(localRepoFolder('Projects', 'acme/payments')).toBeNull()
    expect(localRepoFolder('', 'acme/payments')).toBeNull()
    expect(localRepoFolder('~/Projects', 'acme/payments')).toBeNull()
  })

  it('rejects a repository name that would escape the root', () => {
    expect(localRepoFolder('/Users/me/Projects', 'acme/')).toBeNull()
  })
})
