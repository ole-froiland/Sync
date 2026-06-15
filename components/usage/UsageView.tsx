'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Cpu,
  Pencil,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const BUDGET_KEY = 'sync-usage-weekly-budget'
const DEFAULT_BUDGET = 1_000_000

type UsageStatus = 'normal' | 'heavy' | 'used_up'

interface UsageData {
  source: string
  codexLimits: { label: string; resetLabel: string; percentLeft: number | null }[]
  codex: {
    requests: number
    totalTokens: number
    inputTokens: number
    outputTokens: number
    remainingPercent: number | null
    resetLabel: string
    lastActiveLabel: string
    mostUsedModel: string
  }
  dailyCodex: {
    label: string
    dateLabel: string
    requests: number
    tokens: number
    inputTokens: number
    outputTokens: number
    limitTokens: number
    status: UsageStatus
  }[]
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`
  return n.toLocaleString('en-US')
}

function tone(usedPct: number) {
  if (usedPct >= 0.96) return { stroke: '#ef4444', text: 'text-rose-500', bg: 'bg-rose-500' }
  if (usedPct >= 0.72) return { stroke: '#f59e0b', text: 'text-amber-500', bg: 'bg-amber-500' }
  return { stroke: '#8b5cf6', text: 'text-violet-500', bg: 'bg-violet-500' }
}

export default function UsageView() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [budget, setBudget] = useState(DEFAULT_BUDGET)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(DEFAULT_BUDGET))
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const stored = Number(window.localStorage.getItem(BUDGET_KEY))
      if (!cancelled && stored > 0) {
        setBudget(stored)
        setDraft(String(stored))
      }
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/openai/usage', { cache: 'no-store' })
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError({ status: res.status, message: body?.error ?? 'Kunne ikke hente bruk.' })
          setData(null)
        } else {
          setData(body as UsageData)
        }
      } catch {
        if (!cancelled) setError({ status: 0, message: 'Kunne ikke hente bruk akkurat nå.' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [nonce])

  function saveBudget() {
    const value = Math.max(1, Math.round(Number(draft.replace(/[^\d]/g, '')) || DEFAULT_BUDGET))
    setBudget(value)
    window.localStorage.setItem(BUDGET_KEY, String(value))
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center py-32 text-gray-500 dark:text-gray-400">
        <RefreshCw size={22} className="mb-3 animate-spin" />
        <p className="text-sm">Henter forbruk …</p>
      </div>
    )
  }

  if (error) {
    const notConfigured = error.status === 501
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-800 dark:bg-gray-900/40">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <TriangleAlert size={26} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {notConfigured ? 'AI-bruk er ikke koblet til ennå' : 'Får ikke hentet forbruk'}
          </h2>
          <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            {notConfigured
              ? 'Sett miljøvariabelen OPENAI_ADMIN_KEY (eller OPENAI_API_KEY) for å vise OpenAI-forbruket ditt her.'
              : error.message}
          </p>
          <button
            onClick={() => setNonce((n) => n + 1)}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw size={15} />
            Prøv igjen
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { codex, codexLimits, dailyCodex } = data
  const used = codex.totalTokens
  const usedPct = budget > 0 ? used / budget : 0
  const remaining = Math.max(0, budget - used)
  const remainingPct = Math.max(0, 1 - usedPct)
  const t = tone(usedPct)
  const weeklyReset = codexLimits.find((l) => /week/i.test(l.label))?.resetLabel ?? codex.resetLabel
  const maxDaily = Math.max(1, ...dailyCodex.map((d) => d.tokens))

  // gauge geometry
  const R = 78
  const C = 2 * Math.PI * R
  const dash = Math.min(1, usedPct) * C

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">AI-forbruk</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Siste 7 dager · OpenAI API</p>
        </div>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <RefreshCw size={14} />
          Oppdater
        </button>
      </div>

      {/* hero: gauge + remaining */}
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="relative h-[188px] w-[188px]">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 188 188">
              <circle cx="94" cy="94" r={R} fill="none" strokeWidth="14" className="stroke-gray-100 dark:stroke-gray-800" />
              <circle
                cx="94"
                cy="94"
                r={R}
                fill="none"
                strokeWidth="14"
                strokeLinecap="round"
                stroke={t.stroke}
                strokeDasharray={`${dash} ${C}`}
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-3xl font-bold', t.text)}>{Math.round(remainingPct * 100)}%</span>
              <span className="mt-0.5 text-xs font-medium text-gray-400 dark:text-gray-500">igjen</span>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {fmt(remaining)} <span className="text-gray-400 dark:text-gray-500">av {fmt(budget)} tokens</span>
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{weeklyReset}</p>
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Ukentlig budsjett</span>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <Pencil size={13} />
                Rediger
              </button>
            )}
          </div>

          {editing ? (
            <div className="mt-3 flex items-center gap-2">
              <input
                autoFocus
                inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveBudget()
                  if (e.key === 'Escape') {
                    setDraft(String(budget))
                    setEditing(false)
                  }
                }}
                className="h-10 w-44 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-violet-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <span className="text-sm text-gray-400">tokens / uke</span>
              <button
                onClick={saveBudget}
                className="ml-auto h-10 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-700"
              >
                Lagre
              </button>
            </div>
          ) : (
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{fmt(budget)}</p>
          )}

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              <span>Brukt {fmt(used)}</span>
              <span>{Math.round(usedPct * 100)}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className={cn('h-full rounded-full transition-all duration-500', t.bg)}
                style={{ width: `${Math.min(100, usedPct * 100)}%` }}
              />
            </div>
            {usedPct >= 1 && (
              <p className="mt-2 text-xs font-medium text-rose-500">Du har passert budsjettet for denne uka.</p>
            )}
          </div>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Activity} label="Forespørsler" value={codex.requests.toLocaleString('en-US')} accent="text-violet-500" />
        <StatCard icon={ArrowDownToLine} label="Input-tokens" value={fmt(codex.inputTokens)} accent="text-sky-500" />
        <StatCard icon={ArrowUpFromLine} label="Output-tokens" value={fmt(codex.outputTokens)} accent="text-emerald-500" />
        <StatCard icon={Cpu} label="Mest brukte modell" value={codex.mostUsedModel} accent="text-amber-500" small />
      </div>

      {/* 7-day chart */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Forbruk per dag</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">tokens</span>
        </div>
        <div className="flex h-44 items-end gap-2 sm:gap-3">
          {dailyCodex.map((day, i) => {
            const h = Math.max(4, (day.tokens / maxDaily) * 100)
            const dt = tone(day.status === 'used_up' ? 1 : day.status === 'heavy' ? 0.8 : 0.3)
            return (
              <div key={`${day.dateLabel}-${i}`} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    title={`${day.dateLabel}: ${fmt(day.tokens)} tokens · ${day.requests} forespørsler`}
                    className={cn('w-full rounded-t-md transition-all duration-500', dt.bg, day.tokens === 0 && 'bg-gray-100 dark:bg-gray-800')}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{day.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* limit cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {codexLimits.map((limit) => (
          <div key={limit.label} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{limit.label}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{limit.resetLabel}</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-violet-500 transition-all"
                style={{ width: `${limit.percentLeft != null ? Math.round((1 - limit.percentLeft) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {limit.percentLeft != null ? `${Math.round(limit.percentLeft * 100)}% igjen` : 'Følger med på OpenAI-grensene dine'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  small,
}: {
  icon: React.ElementType
  label: string
  value: string
  accent: string
  small?: boolean
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={16} className={accent} />
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className={cn('font-bold text-gray-900 dark:text-gray-100', small ? 'truncate text-base' : 'text-2xl')} title={small ? value : undefined}>
        {value}
      </p>
    </div>
  )
}
