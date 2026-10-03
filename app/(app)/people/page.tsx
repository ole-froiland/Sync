'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { PersonCardSkeleton } from '@/components/ui/Skeleton'
import { useLanguage } from '@/context/LanguageContext'
import { useUser } from '@/context/UserContext'
import { mockProfiles, mockProjects } from '@/lib/mock-data'
import {
  formatLastActiveValue,
  formatMemberSince,
  getPresenceInfo,
} from '@/lib/people-presence'
import type { Locale } from '@/lib/i18n'
import type { Profile, Project } from '@/types'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

const TOOL_COLORS: Record<string, string> = {
  Claude: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Cursor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  GitHub: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  Figma: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Codex: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'VS Code': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  ChatGPT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Copilot: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

type SyncState = 'none' | 'pending' | 'request_received' | 'synced'
type SyncMap = Record<string, SyncState>
type FollowSet = Record<string, true>
type Toast = { id: number; tone: 'success' | 'error'; message: string }
type SyncBusyAction = 'sync' | 'accept' | 'reject'

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body?.error ?? fallback
  } catch {
    return fallback
  }
}

export default function PeoplePage() {
  const currentUser = useUser()
  const { locale } = useLanguage()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsAvailable, setProjectsAvailable] = useState(true)
  const [follows, setFollows] = useState<FollowSet>({})
  const [syncStates, setSyncStates] = useState<SyncMap>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [pendingByUser, setPendingByUser] = useState<Record<string, 'follow' | SyncBusyAction | null>>({})
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [presenceNow, setPresenceNow] = useState(() => Date.now())

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, tone, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2800)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      if (!SUPABASE_CONFIGURED) {
        if (cancelled) return
        setProfiles(withMockPresence(mockProfiles))
        setProjects(mockProjects)
        setProjectsAvailable(true)
        setFollows({})
        setSyncStates({})
        setCurrentUserId(currentUser?.id ?? 'mock-current-user')
        setLoading(false)
        return
      }

      try {
        const [peopleRes, projectsRes, connectionsRes, presenceRes] = await Promise.all([
          fetch('/api/people', { cache: 'no-store' }),
          fetch('/api/projects'),
          fetch('/api/connections'),
          fetch('/api/presence', { method: 'POST' }),
        ])

        if (!peopleRes.ok) throw new Error('Failed to load people')
        const people = (await peopleRes.json()) as Profile[] | { error: string }
        const projs = projectsRes.ok ? ((await projectsRes.json()) as Project[]) : []
        const connData = connectionsRes.ok
          ? ((await connectionsRes.json()) as {
              userId: string
              follows?: string[]
              sync?: SyncMap
            })
          : { userId: null, follows: [], sync: {} as SyncMap }
        const presenceData = presenceRes.ok
          ? ((await presenceRes.json()) as { user_id: string; last_active_at: string })
          : null
        const activeUserId = presenceData?.user_id ?? connData.userId ?? currentUser?.id ?? null
        const activeAt = presenceData?.last_active_at ?? new Date().toISOString()

        if (cancelled) return
        setProfiles(
          Array.isArray(people)
            ? people.map((profile) =>
                profile.id === activeUserId
                  ? { ...profile, last_active_at: activeAt }
                  : profile
              )
            : []
        )
        setProjects(Array.isArray(projs) ? projs : [])
        setProjectsAvailable(projectsRes.ok)
        const followSet: FollowSet = {}
        for (const id of connData.follows ?? []) followSet[id] = true
        setFollows(followSet)
        setSyncStates(connData.sync ?? {})
        setCurrentUserId(activeUserId)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Something went wrong loading people.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentUser])

  useEffect(() => {
    const tick = window.setInterval(() => setPresenceNow(Date.now()), 30_000)
    return () => window.clearInterval(tick)
  }, [])

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return

    let cancelled = false

    async function refreshPresence() {
      if (document.visibilityState !== 'visible') return

      try {
        const [presenceRes, peopleRes] = await Promise.all([
          fetch('/api/presence', { method: 'POST' }),
          fetch('/api/people', { cache: 'no-store' }),
        ])
        if (cancelled || !peopleRes.ok) return

        const people = (await peopleRes.json()) as Profile[] | { error: string }
        if (!Array.isArray(people)) return

        const presenceData = presenceRes.ok
          ? ((await presenceRes.json()) as { user_id: string; last_active_at: string })
          : null
        const activeUserId = presenceData?.user_id ?? currentUserId ?? currentUser?.id ?? null
        const activeAt = presenceData?.last_active_at ?? new Date().toISOString()

        setProfiles(
          people.map((profile) =>
            profile.id === activeUserId
              ? { ...profile, last_active_at: activeAt }
              : profile
          )
        )
        setPresenceNow(Date.now())
      } catch {
        // Presence is supplemental; keep the last successful people data visible.
      }
    }

    const interval = window.setInterval(refreshPresence, 60_000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshPresence()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [currentUser, currentUserId])

  const effectiveCurrentUserId = currentUserId ?? currentUser?.id ?? null

  const currentProfile = useMemo(() => {
    const fromList = profiles.find((p) => p.id === effectiveCurrentUserId)
    if (fromList) return fromList
    if (currentUser) return currentUser
    if (effectiveCurrentUserId) return buildFallbackCurrentProfile(effectiveCurrentUserId)
    return null
  }, [profiles, effectiveCurrentUserId, currentUser])

  const visibleProfiles = useMemo(() => {
    const others = profiles
      .filter((p) => p.id !== currentProfile?.id)
      .sort(
        (a, b) =>
          new Date(b.last_active_at ?? 0).getTime() - new Date(a.last_active_at ?? 0).getTime()
      )
    return currentProfile ? [currentProfile, ...others] : others
  }, [profiles, currentProfile])

  const selectedProfile = useMemo(
    () => visibleProfiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [visibleProfiles, selectedProfileId]
  )

  function getProjectsForUser(userId: string) {
    return projects.filter((p) =>
      p.members?.some(
        (m) =>
          (m as unknown as { id?: string; user_id?: string }).id === userId ||
          (m as unknown as { id?: string; user_id?: string }).user_id === userId
      )
    )
  }

  const setFollow = useCallback((userId: string, isFollowing: boolean) => {
    setFollows((prev) => {
      const next = { ...prev }
      if (isFollowing) next[userId] = true
      else delete next[userId]
      return next
    })
  }, [])

  const setSyncState = useCallback((userId: string, state: SyncState) => {
    setSyncStates((prev) => {
      const next = { ...prev }
      if (state === 'none') delete next[userId]
      else next[userId] = state
      return next
    })
  }, [])

  const setBusy = useCallback((userId: string, action: 'follow' | SyncBusyAction | null) => {
    setPendingByUser((prev) => ({ ...prev, [userId]: action }))
  }, [])

  const handleFollow = useCallback(
    async (profile: Profile) => {
      const wasFollowing = !!follows[profile.id]
      const next = !wasFollowing

      setBusy(profile.id, 'follow')
      setFollow(profile.id, next)

      if (!SUPABASE_CONFIGURED) {
        showToast(wasFollowing ? 'Unfollowed' : 'Following')
        setBusy(profile.id, null)
        return
      }

      try {
        const res = await fetch(`/api/people/${profile.id}/follow`, {
          method: wasFollowing ? 'DELETE' : 'POST',
        })
        if (!res.ok) {
          const message = await readApiError(res, 'Could not update follow.')
          throw new Error(message)
        }
        showToast(wasFollowing ? 'Unfollowed' : 'Following')
      } catch (e) {
        setFollow(profile.id, wasFollowing)
        showToast(e instanceof Error ? e.message : 'Could not update follow.', 'error')
      } finally {
        setBusy(profile.id, null)
      }
    },
    [follows, setBusy, setFollow, showToast]
  )

  const handleSync = useCallback(
    async (profile: Profile) => {
      const current = syncStates[profile.id] ?? 'none'
      const isActive = current === 'pending' || current === 'synced'
      const optimisticNext: SyncState = isActive ? 'none' : 'pending'

      setBusy(profile.id, 'sync')
      setSyncState(profile.id, optimisticNext)

      if (!SUPABASE_CONFIGURED) {
        showToast(isActive ? 'Sync request cancelled' : 'Sync request sent')
        setBusy(profile.id, null)
        return
      }

      try {
        const res = await fetch(`/api/people/${profile.id}/sync`, {
          method: isActive ? 'DELETE' : 'POST',
        })
        if (!res.ok) {
          const message = await readApiError(res, 'Could not update Sync.')
          throw new Error(message)
        }
        const body = (await res.json().catch(() => ({}))) as { status?: SyncState }
        if (!isActive && body.status) {
          setSyncState(profile.id, body.status)
          showToast(body.status === 'synced' ? 'Sync accepted' : 'Sync request sent')
        } else {
          showToast(current === 'synced' ? 'Sync removed' : 'Sync request cancelled')
        }
      } catch (e) {
        setSyncState(profile.id, current)
        showToast(e instanceof Error ? e.message : 'Could not update Sync.', 'error')
      } finally {
        setBusy(profile.id, null)
      }
    },
    [syncStates, setBusy, setSyncState, showToast]
  )

  const handleAccept = useCallback(
    async (profile: Profile) => {
      setBusy(profile.id, 'accept')
      setSyncState(profile.id, 'synced')
      try {
        const res = await fetch(`/api/people/${profile.id}/sync/accept`, { method: 'POST' })
        if (!res.ok) {
          const message = await readApiError(res, 'Could not accept Sync.')
          throw new Error(message)
        }
        showToast('Sync accepted')
      } catch (e) {
        setSyncState(profile.id, 'request_received')
        showToast(e instanceof Error ? e.message : 'Could not accept Sync.', 'error')
      } finally {
        setBusy(profile.id, null)
      }
    },
    [setBusy, setSyncState, showToast]
  )

  const handleReject = useCallback(
    async (profile: Profile) => {
      setBusy(profile.id, 'reject')
      setSyncState(profile.id, 'none')
      try {
        const res = await fetch(`/api/people/${profile.id}/sync/reject`, { method: 'POST' })
        if (!res.ok) {
          const message = await readApiError(res, 'Could not reject request.')
          throw new Error(message)
        }
        showToast('Sync rejected')
      } catch (e) {
        setSyncState(profile.id, 'request_received')
        showToast(e instanceof Error ? e.message : 'Could not reject request.', 'error')
      } finally {
        setBusy(profile.id, null)
      }
    },
    [setBusy, setSyncState, showToast]
  )

  return (
    <>
      <TopBar title="People" />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <PersonCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        ) : visibleProfiles.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProfiles.map((profile) => {
              const userProjects = getProjectsForUser(profile.id)
              const isCurrentUser = profile.id === currentProfile?.id
              const isFollowing = !!follows[profile.id]
              const syncState = syncStates[profile.id] ?? 'none'
              const busy = pendingByUser[profile.id] ?? null
              return (
                <PersonCard
                  key={profile.id}
                  profile={profile}
                  projects={userProjects}
                  projectsAvailable={projectsAvailable}
                  isFollowing={isFollowing}
                  isCurrentUser={isCurrentUser}
                  syncState={syncState}
                  busy={busy}
                  locale={locale}
                  now={presenceNow}
                  onOpen={() => setSelectedProfileId(profile.id)}
                  onFollow={() => handleFollow(profile)}
                  onSync={() => handleSync(profile)}
                  onAccept={() => handleAccept(profile)}
                  onReject={() => handleReject(profile)}
                />
              )
            })}
          </div>
        )}
      </div>

      <ProfileModal
        profile={selectedProfile}
        open={!!selectedProfile}
        onClose={() => setSelectedProfileId(null)}
        projects={selectedProfile ? getProjectsForUser(selectedProfile.id) : []}
        projectsAvailable={projectsAvailable}
        isCurrentUser={selectedProfile?.id === currentProfile?.id}
        locale={locale}
        now={presenceNow}
      />

      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm transition-all ${
              t.tone === 'success'
                ? 'bg-gray-900/95 text-white border-gray-800 dark:bg-gray-100/95 dark:text-gray-900 dark:border-gray-200'
                : 'bg-red-600/95 text-white border-red-700'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  )
}

function PersonCard({
  profile,
  projects,
  projectsAvailable,
  isFollowing,
  isCurrentUser,
  syncState,
  busy,
  locale,
  now,
  onOpen,
  onFollow,
  onSync,
  onAccept,
  onReject,
}: {
  profile: Profile
  projects: Project[]
  projectsAvailable: boolean
  isFollowing: boolean
  isCurrentUser: boolean
  syncState: SyncState
  busy: 'follow' | SyncBusyAction | null
  locale: Locale
  now: number
  onOpen: () => void
  onFollow: () => void
  onSync: () => void
  onAccept: () => void
  onReject: () => void
}) {
  const followLabel = isFollowing ? 'Following' : 'Follow'

  const followClassName = isFollowing
    ? 'border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30'
    : ''

  const openOnKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  const renderSyncControl = () => {
    if (isCurrentUser) {
      return (
        <Badge className="justify-center bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
          Your profile
        </Badge>
      )
    }

    if (syncState === 'synced') {
      return (
        <Button
          size="sm"
          loading={busy === 'sync'}
          disabled={busy !== null}
          onClick={onSync}
          className="bg-fuchsia-600 text-white"
        >
          Synced
        </Button>
      )
    }
    if (syncState === 'pending') {
      return (
        <Button
          size="sm"
          variant="secondary"
          loading={busy === 'sync'}
          disabled={busy !== null}
          onClick={onSync}
          className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900/50"
        >
          Pending
        </Button>
      )
    }
    if (syncState === 'request_received') {
      return (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            loading={busy === 'accept'}
            disabled={busy !== null}
            onClick={onAccept}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'reject'}
            disabled={busy !== null}
            onClick={onReject}
          >
            Reject
          </Button>
        </div>
      )
    }
    return (
      <Button
        size="sm"
        loading={busy === 'sync'}
        disabled={busy !== null}
        onClick={onSync}
      >
        Sync
      </Button>
    )
  }

  return (
    <Card
      padding="md"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={openOnKeyboard}
      className={`flex cursor-pointer flex-col gap-4 transition-colors ${
        isCurrentUser
          ? 'border-purple-300/80 bg-purple-50/50 dark:border-purple-700/70 dark:bg-purple-950/20'
          : 'hover:border-purple-200 dark:hover:border-purple-800/60'
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar name={profile.name} src={profile.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {profile.name}
            </h3>
            {isCurrentUser && (
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                You
              </Badge>
            )}
          </div>
          {syncState === 'request_received' && !isCurrentUser && (
            <p className="text-xs font-medium text-purple-600 dark:text-purple-300">
              Wants to Sync with you
            </p>
          )}
          <p className="truncate text-xs text-gray-400 dark:text-gray-600">{profile.email}</p>
          <div className="mt-1">
            <PresenceLabel lastActiveAt={profile.last_active_at} locale={locale} now={now} />
          </div>
          {profile.role && (
            <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
              {profile.role}
            </p>
          )}
        </div>
        <div
          className="shrink-0"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col items-stretch gap-1.5">
            {!isCurrentUser && (
              <Button
                size="sm"
                variant="secondary"
                loading={busy === 'follow'}
                disabled={busy !== null}
                onClick={onFollow}
                className={followClassName}
              >
                {followLabel}
              </Button>
            )}
            {renderSyncControl()}
          </div>
        </div>
      </div>

      {profile.tools_used && profile.tools_used.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Tools
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.tools_used.map((tool) => (
              <Badge
                key={tool}
                className={
                  TOOL_COLORS[tool] ??
                  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }
              >
                {tool}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Projects
          </p>
          <div className="flex flex-col gap-1">
            {projects.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />
                <span className="truncate text-xs text-gray-700 dark:text-gray-300">{p.name}</span>
              </div>
            ))}
            {projects.length > 3 && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                +{projects.length - 3} more projects
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-gray-50 pt-3 dark:border-gray-800">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Shared projects
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
            {projectsAvailable ? projects.length : '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Member since
          </p>
          <p data-no-translate className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
            {formatMemberSince(profile.created_at, locale)}
          </p>
        </div>
      </div>
    </Card>
  )
}

function ProfileModal({
  profile,
  open,
  onClose,
  projects,
  projectsAvailable,
  isCurrentUser,
  locale,
  now,
}: {
  profile: Profile | null
  open: boolean
  onClose: () => void
  projects: Project[]
  projectsAvailable: boolean
  isCurrentUser: boolean
  locale: Locale
  now: number
}) {
  if (!profile) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isCurrentUser ? 'Your profile' : profile.name}
      className="max-w-3xl"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-950/40 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={profile.name} src={profile.avatar_url} size="lg" className="h-14 w-14" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {profile.name}
                </h3>
                {isCurrentUser && (
                  <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                    You
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{profile.email}</p>
              <div className="mt-2">
                <PresenceLabel lastActiveAt={profile.last_active_at} locale={locale} now={now} />
              </div>
              {profile.role && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Focus: {profile.role}
                </p>
              )}
            </div>
          </div>
          <div className="min-w-[210px] rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Overview
            </p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Shared projects</p>
                <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                  {projectsAvailable ? projects.length : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Member since</p>
                <p data-no-translate className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatMemberSince(profile.created_at, locale)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {profile.tools_used && profile.tools_used.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Tools
            </p>
            <div className="flex flex-wrap gap-1.5">
              {profile.tools_used.map((tool) => (
                <Badge
                  key={tool}
                  className={
                    TOOL_COLORS[tool] ??
                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }
                >
                  {tool}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {projects.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Projects
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {project.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {project.status[0].toUpperCase() + project.status.slice(1)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}

function PresenceLabel({
  lastActiveAt,
  locale,
  now,
}: {
  lastActiveAt: string | null | undefined
  locale: Locale
  now: number
}) {
  const presence = getPresenceInfo(lastActiveAt, now)

  if (presence.state === 'active') {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
        <span>Active now</span>
      </p>
    )
  }

  if (presence.state === 'away') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
        <span>Last active</span>
        <span aria-hidden="true">·</span>
        <span data-no-translate>{formatLastActiveValue(presence.lastActiveAt, locale, now)}</span>
      </p>
    )
  }

  return (
    <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
      <span className="h-2 w-2 rounded-full bg-gray-200 dark:bg-gray-700" />
      <span>No recent activity</span>
    </p>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-fuchsia-100 dark:bg-fuchsia-900">
        <svg
          className="h-7 w-7 text-purple-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">No one here yet</h3>
      <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
        Invite teammates or wait for new builders to join the workspace. They&apos;ll show up here
        once they&apos;re onboarded.
      </p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
        <svg
          className="h-7 w-7 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Couldn&apos;t load people
      </h3>
      <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">{message}</p>
      <Button size="sm" variant="secondary" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

function buildFallbackCurrentProfile(userId: string): Profile {
  return {
    id: userId,
    email: 'you@sync.app',
    name: 'You',
    first_name: null,
    last_name: null,
    username: null,
    selected_avatar: null,
    avatar_url: null,
    role: 'Member',
    tools_used: ['Codex', 'ChatGPT', 'GitHub'],
    onboarding_completed: true,
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  }
}

function withMockPresence(profiles: Profile[]): Profile[] {
  const now = Date.now()
  const offsets = [0, 12 * 60_000, 2 * 60 * 60_000, 26 * 60 * 60_000]

  return profiles.map((profile, index) => ({
    ...profile,
    last_active_at:
      index < offsets.length ? new Date(now - offsets[index]).toISOString() : null,
  }))
}
