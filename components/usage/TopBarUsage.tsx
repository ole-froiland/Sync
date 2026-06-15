'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Meter {
  id: 'openai' | 'anthropic'
  name: string
  color: string
  usedPct: number
}

// Module-level cache so navigating between pages doesn't refetch every time.
let cache: { at: number; meters: Meter[] } | null = null
const TTL = 60_000

export default function TopBarUsage() {
  const [meters, setMeters] = useState<Meter[] | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (cache && Date.now() - cache.at < TTL) {
        if (!cancelled) setMeters(cache.meters)
        return
      }

      const openaiBudget = Number(window.localStorage.getItem('sync-usage-budget-openai')) || 1_000_000
      const anthropicBudget = Number(window.localStorage.getItem('sync-usage-budget-anthropic')) || 1_000_000

      const [openai, anthropic] = await Promise.all([
        fetch('/api/openai/usage', { cache: 'no-store' })
          .then((r) => (r.ok ? (r.json() as Promise<{ codex?: { totalTokens?: number } }>) : null))
          .catch(() => null),
        fetch('/api/anthropic/usage', { cache: 'no-store' })
          .then((r) => (r.ok ? (r.json() as Promise<{ totalTokens?: number }>) : null))
          .catch(() => null),
      ])

      const out: Meter[] = []
      if (openai?.codex && typeof openai.codex.totalTokens === 'number') {
        out.push({ id: 'openai', name: 'OpenAI', color: 'bg-emerald-500', usedPct: Math.min(1, openai.codex.totalTokens / openaiBudget) })
      }
      if (anthropic && typeof anthropic.totalTokens === 'number') {
        out.push({ id: 'anthropic', name: 'Claude', color: 'bg-violet-500', usedPct: Math.min(1, anthropic.totalTokens / anthropicBudget) })
      }

      cache = { at: Date.now(), meters: out }
      if (!cancelled) setMeters(out)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!meters || meters.length === 0) return null

  return (
    <Link
      href="/usage"
      aria-label="AI-forbruk"
      title={`AI-forbruk · ${meters.map((m) => `${m.name} ${Math.round(m.usedPct * 100)}%`).join(' · ')}`}
      className="hidden h-8 items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 sm:flex dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    >
      <Gauge size={15} />
      <span className="flex items-center gap-1">
        {meters.map((m) => (
          <span key={m.id} className="h-1.5 w-7 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <span className={cn('block h-full rounded-full', m.color)} style={{ width: `${Math.max(4, m.usedPct * 100)}%` }} />
          </span>
        ))}
      </span>
    </Link>
  )
}
