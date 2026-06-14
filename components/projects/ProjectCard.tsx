'use client'

import Link from 'next/link'
import { useState } from 'react'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import { GitBranch, Share2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'

const STATUS_BADGE: Record<Project['status'], string> = {
  idea: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  building: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  live: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
}

const STATUS_LABEL: Record<Project['status'], string> = {
  idea: 'Idea',
  building: 'Building',
  live: 'Live',
}

const PROGRESS: Record<Project['status'], { label: string; pct: number }> = {
  idea: { label: 'Early', pct: 15 },
  building: { label: 'Mid', pct: 55 },
  live: { label: 'Almost done', pct: 95 },
}

type ActivityTone = 'active' | 'idle' | 'live'

const TONE_DOT: Record<ActivityTone, string> = {
  active: 'bg-purple-500 shadow-[0_0_0_3px_rgba(168,85,247,0.2)]',
  idle: 'bg-gray-400 dark:bg-gray-600',
  live: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]',
}

const TONE_LABEL: Record<ActivityTone, string> = {
  active: 'Active',
  idle: 'Idle',
  live: 'Live',
}

function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

function formatDays(d: number): string {
  if (d === 0) return 'today'
  if (d === 1) return '1d'
  if (d < 7) return `${d}d`
  if (d < 30) return `${Math.floor(d / 7)}w`
  if (d < 365) return `${Math.floor(d / 30)}mo`
  return `${Math.floor(d / 365)}y`
}

function activity(project: Project): { tone: ActivityTone; line: string } {
  const d = daysAgo(project.created_at)
  if (project.status === 'live') {
    return { tone: 'live', line: `Shipped · ${formatDays(d)} ago` }
  }
  if (project.status === 'building') {
    if (d < 14) return { tone: 'active', line: `Updated ${formatDays(d)} ago` }
    return { tone: 'idle', line: `No activity · ${formatDays(d)}` }
  }
  if (d < 14) return { tone: 'active', line: `Created ${formatDays(d)} ago` }
  return { tone: 'idle', line: `No activity · ${formatDays(d)}` }
}

export default function ProjectCard({ project }: { project: Project }) {
  const [copied, setCopied] = useState(false)
  const status = project.status
  const progress = PROGRESS[status]
  const act = activity(project)
  const visibleMembers = (project.members ?? []).slice(0, 4)
  const extra = Math.max(0, (project.member_count ?? project.members?.length ?? 0) - visibleMembers.length)

  function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/projects/${project.id}`
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Link href={`/projects/${project.id}`} className="block h-full group">
      <Card
        padding="lg"
        className={cn(
          'flex flex-col gap-5 h-full transition-all duration-200 cursor-pointer',
          'hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-8px_rgba(168,85,247,0.25)]',
          'hover:border-purple-200/70 dark:hover:border-purple-900/40'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 truncate flex-1 min-w-0">
            {project.name}
          </h3>
          <span
            className={cn(
              'shrink-0 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full',
              STATUS_BADGE[status]
            )}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 -mt-3">
            {project.description}
          </p>
        )}

        {/* Progress */}
        <div className="flex items-center gap-3 -mt-1">
          <div className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                status === 'live'
                  ? 'bg-emerald-500'
                  : status === 'building'
                  ? 'bg-fuchsia-600'
                  : 'bg-gray-300 dark:bg-gray-700'
              )}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
            {progress.label}
          </span>
        </div>

        {/* People */}
        <div className="flex items-center gap-2">
          {visibleMembers.length > 0 ? (
            <div className="flex items-center -space-x-2">
              {visibleMembers.map((m) => (
                <div key={m.id} title={m.name} className="relative">
                  <Avatar
                    name={m.name}
                    src={m.avatar_url}
                    size="xs"
                    className="ring-2 ring-white dark:ring-gray-900"
                  />
                </div>
              ))}
              {extra > 0 && (
                <div className="relative w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  +{extra}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-600">No members yet</span>
          )}
        </div>

        {/* Activity + actions */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-gray-800/80">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', TONE_DOT[act.tone])} />
            <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
              <span className="text-gray-600 dark:text-gray-300 font-medium">
                {TONE_LABEL[act.tone]}
              </span>
              <span className="mx-1.5 text-gray-300 dark:text-gray-700">·</span>
              {act.line}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {project.github_url && (
              <a
                href={project.github_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Open repo"
                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <GitBranch size={13} />
              </a>
            )}
            <button
              type="button"
              onClick={handleShare}
              title={copied ? 'Link copied' : 'Copy link'}
              className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Share2 size={13} />}
            </button>
          </div>
        </div>
      </Card>
    </Link>
  )
}
