'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { Check, Copy, Search, Send, Users } from 'lucide-react'
import type { Profile } from '@/types'

export type RepoShareInfo = {
  full_name: string
  name?: string
  url: string
  owner?: string
  description?: string | null
  language?: string | null
}

type ShareRepoModalProps = {
  open: boolean
  onClose: () => void
  repo: RepoShareInfo
  onToast?: (message: string, tone?: 'success' | 'error') => void
}

type SendStatus = 'idle' | 'sending' | 'sent' | 'error'

type SyncedUserMap = Record<string, SendStatus>

export default function ShareRepoModal({
  open,
  onClose,
  repo,
  onToast,
}: ShareRepoModalProps) {
  const [synced, setSynced] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusByUser, setStatusByUser] = useState<SyncedUserMap>({})
  const [linkCopied, setLinkCopied] = useState(false)

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/repositories/${repo.full_name}`
    return `${window.location.origin}/repositories/${repo.full_name}`
  }, [repo.full_name])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load() {
      if (!cancelled) {
        setStatusByUser({})
        setSearch('')
        setLinkCopied(false)
        setLoading(true)
        setError(null)
      }
      try {
        const [profilesRes, connectionsRes] = await Promise.all([
          fetch('/api/people'),
          fetch('/api/connections'),
        ])
        if (!profilesRes.ok) throw new Error('Failed to load people')
        const peopleData = (await profilesRes.json()) as Profile[]
        const connData = connectionsRes.ok
          ? ((await connectionsRes.json()) as {
              userId: string
              connections: Record<string, string>
            })
          : { userId: null, connections: {} as Record<string, string> }

        if (cancelled) return
        const syncedIds = new Set(
          Object.entries(connData.connections ?? {})
            .filter(([, state]) => state === 'synced')
            .map(([id]) => id)
        )
        setSynced(peopleData.filter((p) => syncedIds.has(p.id)))
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load synced users.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return synced
    return synced.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q)
    )
  }, [synced, search])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      onToast?.('Link copied')
      setTimeout(() => setLinkCopied(false), 1600)
    } catch {
      onToast?.('Could not copy link', 'error')
    }
  }, [shareUrl, onToast])

  const handleSend = useCallback(
    async (profile: Profile) => {
      setStatusByUser((prev) => ({ ...prev, [profile.id]: 'sending' }))
      try {
        const res = await fetch('/api/direct-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiver_id: profile.id,
            type: 'repo_share',
            payload: {
              full_name: repo.full_name,
              name: repo.name ?? repo.full_name.split('/')[1] ?? repo.full_name,
              url: repo.url,
              owner: repo.owner ?? repo.full_name.split('/')[0],
              description: repo.description ?? null,
              language: repo.language ?? null,
            },
          }),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error ?? 'Failed to send')
        }
        setStatusByUser((prev) => ({ ...prev, [profile.id]: 'sent' }))
        onToast?.(`Sent ${repo.name ?? repo.full_name} to ${profile.name}`)
      } catch (e) {
        setStatusByUser((prev) => ({ ...prev, [profile.id]: 'error' }))
        onToast?.(e instanceof Error ? e.message : 'Failed to send', 'error')
      }
    },
    [repo, onToast]
  )

  return (
    <Modal open={open} onClose={onClose} title="Share repository">
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Copy link
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 bg-transparent text-xs text-gray-600 outline-none dark:text-gray-300"
            />
            <button
              onClick={handleCopyLink}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                linkCopied
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-800'
              )}
            >
              {linkCopied ? <Check size={12} /> : <Copy size={12} />}
              {linkCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
              Share with synced users
            </p>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {synced.length}
            </span>
          </div>

          <div className="relative mb-3">
            <Search
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search synced people..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/40"
                >
                  <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="h-7 w-14 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          ) : synced.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 px-3 py-8 text-center dark:border-gray-800">
              <Users size={20} className="text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                No synced users yet
              </p>
              <p className="max-w-xs text-xs text-gray-400 dark:text-gray-500">
                Sync with people from the People page to share repositories with them.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
              No matches.
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {filtered.map((profile) => {
                const status = statusByUser[profile.id] ?? 'idle'
                const sent = status === 'sent'
                const sending = status === 'sending'
                return (
                  <li
                    key={profile.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <Avatar name={profile.name} src={profile.avatar_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                        {profile.name}
                      </p>
                      {profile.role && (
                        <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                          {profile.role}
                        </p>
                      )}
                    </div>
                    <button
                      disabled={sending || sent}
                      onClick={() => handleSend(profile)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all',
                        sent
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                          : sending
                            ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                            : 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white shadow-sm hover:from-purple-600 hover:to-fuchsia-600'
                      )}
                    >
                      {sent ? (
                        <>
                          <Check size={12} />
                          Sent
                        </>
                      ) : sending ? (
                        'Sending…'
                      ) : (
                        <>
                          <Send size={12} />
                          Send
                        </>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
