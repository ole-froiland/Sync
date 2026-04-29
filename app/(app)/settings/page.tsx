'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { useUser } from '@/context/UserContext'
import { useGitHub } from '@/context/GitHubContext'
import { GitBranch, CheckCircle, AlertCircle, X } from 'lucide-react'

const TOOL_OPTIONS = [
  'Claude', 'Cursor', 'GitHub', 'Figma', 'Codex',
  'VS Code', 'ChatGPT', 'Copilot', 'Vercel', 'Linear',
]

const GITHUB_ERROR_MESSAGES: Record<string, string> = {
  denied: 'GitHub authorization was cancelled.',
  missing_params: 'GitHub returned an unexpected response.',
  invalid_state: 'OAuth state mismatch — please try again.',
  not_configured: 'GitHub OAuth is not configured on this server.',
  token_failed: 'Failed to exchange GitHub authorization code for a token.',
}

export default function SettingsPage() {
  const profile = useUser()
  const github = useGitHub()

  const [name, setName] = useState(profile?.name ?? '')
  const [role, setRole] = useState(profile?.role ?? '')
  const [tools, setTools] = useState<string[]>(profile?.tools_used ?? [])
  const [saved, setSaved] = useState(false)

  // Optimistic GitHub state (updated after disconnect)
  const [githubConnected, setGithubConnected] = useState(github.connected)
  const [githubLogin, setGithubLogin] = useState(github.login)
  const [disconnecting, setDisconnecting] = useState(false)

  // Flash messages from OAuth redirect query params
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('github_connected')) {
      setGithubConnected(true)
      setFlash({ type: 'success', message: 'GitHub connected successfully!' })
      // Clean URL without reload
      window.history.replaceState({}, '', '/settings')
    } else if (params.get('github_error')) {
      const code = params.get('github_error') ?? 'unknown'
      setFlash({
        type: 'error',
        message: GITHUB_ERROR_MESSAGES[code] ?? 'GitHub connection failed. Please try again.',
      })
      window.history.replaceState({}, '', '/settings')
    }
  }, [])

  function toggleTool(tool: string) {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase
        .from('profiles')
        .update({ name, role: role || null, tools_used: tools })
        .eq('id', profile.id)
    } catch {}

    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleDisconnectGitHub() {
    setDisconnecting(true)
    try {
      await fetch('/api/github/disconnect', { method: 'DELETE' })
      setGithubConnected(false)
      setGithubLogin(null)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <>
      <TopBar title="Settings" />
      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-2xl">

        {/* Flash message */}
        {flash && (
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-5 text-sm ${
              flash.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50'
                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50'
            }`}
          >
            {flash.type === 'success' ? (
              <CheckCircle size={15} className="flex-shrink-0" />
            ) : (
              <AlertCircle size={15} className="flex-shrink-0" />
            )}
            <span className="flex-1">{flash.message}</span>
            <button onClick={() => setFlash(null)} className="opacity-60 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Profile</h2>
            <div className="flex items-center gap-4 mb-5">
              <Avatar name={name || 'User'} src={profile?.avatar_url} size="lg" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{name || 'User'}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{profile?.email}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Input
                label="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
              <Input
                label="Role / title"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Full-stack developer"
              />
            </div>
          </Card>

          {/* Connected accounts */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Connected accounts
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Manage third-party integrations. Tokens are stored server-side only.
            </p>

            {/* Google — always connected (it's how you log in) */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Google</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{profile?.email}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full">
                Connected
              </span>
            </div>

            {/* GitHub */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-900 dark:bg-gray-100 flex items-center justify-center">
                  <GitBranch size={14} className="text-white dark:text-gray-900" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">GitHub</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {githubConnected && githubLogin
                      ? `@${githubLogin}`
                      : 'Not connected — required for repository creation'}
                  </p>
                </div>
              </div>
              {githubConnected ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full">
                    Connected
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnectGitHub}
                    loading={disconnecting}
                    className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-300"
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <a href="/api/github/connect">
                  <Button type="button" variant="secondary" size="sm">
                    <GitBranch size={13} />
                    Connect
                  </Button>
                </a>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Tools I use
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              These show on your profile and help teammates find collaborators.
            </p>
            <div className="flex flex-wrap gap-2">
              {TOOL_OPTIONS.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => toggleTool(tool)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    tools.includes(tool)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <p
              className={`text-sm transition-opacity ${
                saved ? 'text-emerald-600 dark:text-emerald-400 opacity-100' : 'opacity-0'
              }`}
            >
              ✓ Saved
            </p>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </div>
    </>
  )
}
