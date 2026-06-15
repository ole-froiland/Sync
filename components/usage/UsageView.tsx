'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Cpu,
  Pencil,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const DEFAULT_BUDGET = 1_000_000

type UsageStatus = 'normal' | 'heavy' | 'used_up'
type ProviderState = 'ok' | 'not_configured' | 'error'

interface DailyPoint {
  label: string
  dateLabel: string
  tokens: number
  status: UsageStatus
}

interface ProviderUsage {
  id: 'openai' | 'anthropic'
  name: string
  budgetKey: string
  envHint: string
  state: ProviderState
  errorMessage?: string
  totalTokens: number
  inputTokens: number
  outputTokens: number
  requests: number | null
  mostUsedModel: string
  daily: DailyPoint[]
}

interface OpenAiResponse {
  codex?: { requests?: number; totalTokens?: number; inputTokens?: number; outputTokens?: number; mostUsedModel?: string }
  dailyCodex?: DailyPoint[]
  error?: string
}

interface AnthropicResponse {
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
  mostUsedModel?: string
  daily?: DailyPoint[]
  error?: string
}

const EMPTY = { totalTokens: 0, inputTokens: 0, outputTokens: 0, requests: null, mostUsedModel: '—', daily: [] as DailyPoint[] }

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

async function fetchOpenAI(): Promise<ProviderUsage> {
  const base = { id: 'openai' as const, name: 'OpenAI', budgetKey: 'sync-usage-budget-openai', envHint: 'OPENAI_ADMIN_KEY' }
  try {
    const res = await fetch('/api/openai/usage', { cache: 'no-store' })
    const body = (await res.json().catch(() => ({}))) as OpenAiResponse
    if (res.status === 501) return { ...base, ...EMPTY, state: 'not_configured', errorMessage: body.error }
    if (!res.ok) return { ...base, ...EMPTY, state: 'error', errorMessage: body.error ?? 'Kunne ikke hente bruk.' }
    const c = body.codex ?? {}
    return {
      ...base,
      state: 'ok',
      totalTokens: c.totalTokens ?? 0,
      inputTokens: c.inputTokens ?? 0,
      outputTokens: c.outputTokens ?? 0,
      requests: c.requests ?? null,
      mostUsedModel: c.mostUsedModel ?? '—',
      daily: body.dailyCodex ?? [],
    }
  } catch {
    return { ...base, ...EMPTY, state: 'error', errorMessage: 'Nettverksfeil.' }
  }
}

async function fetchAnthropic(): Promise<ProviderUsage> {
  const base = { id: 'anthropic' as const, name: 'Claude', budgetKey: 'sync-usage-budget-anthropic', envHint: 'ANTHROPIC_ADMIN_KEY' }
  try {
    const res = await fetch('/api/anthropic/usage', { cache: 'no-store' })
    const body = (await res.json().catch(() => ({}))) as AnthropicResponse
    if (res.status === 501) return { ...base, ...EMPTY, state: 'not_configured', errorMessage: body.error }
    if (!res.ok) return { ...base, ...EMPTY, state: 'error', errorMessage: body.error ?? 'Kunne ikke hente bruk.' }
    return {
      ...base,
      state: 'ok',
      totalTokens: body.totalTokens ?? 0,
      inputTokens: body.inputTokens ?? 0,
      outputTokens: body.outputTokens ?? 0,
      requests: null,
      mostUsedModel: body.mostUsedModel ?? '—',
      daily: body.daily ?? [],
    }
  } catch {
    return { ...base, ...EMPTY, state: 'error', errorMessage: 'Nettverksfeil.' }
  }
}

export default function UsageView() {
  const [providers, setProviders] = useState<ProviderUsage[] | null>(null)
  const [budgets, setBudgets] = useState<Record<string, number>>({})
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const loadedBudgets: Record<string, number> = {
        'sync-usage-budget-openai': Number(window.localStorage.getItem('sync-usage-budget-openai')) || DEFAULT_BUDGET,
        'sync-usage-budget-anthropic': Number(window.localStorage.getItem('sync-usage-budget-anthropic')) || DEFAULT_BUDGET,
      }
      if (!cancelled) setBudgets(loadedBudgets)
      const result = await Promise.all([fetchOpenAI(), fetchAnthropic()])
      if (!cancelled) setProviders(result)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [nonce])

  function saveBudget(key: string, value: number) {
    const safe = Math.max(1, Math.round(value))
    setBudgets((prev) => ({ ...prev, [key]: safe }))
    window.localStorage.setItem(key, String(safe))
  }

  if (!providers) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center py-32 text-gray-500 dark:text-gray-400">
        <RefreshCw size={22} className="mb-3 animate-spin" />
        <p className="text-sm">Henter forbruk …</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">AI-forbruk</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Siste 7 dager · OpenAI &amp; Claude</p>
        </div>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <RefreshCw size={14} />
          Oppdater
        </button>
      </div>

      {providers.map((provider) => (
        <ProviderSection
          key={provider.id}
          provider={provider}
          budget={budgets[provider.budgetKey] ?? DEFAULT_BUDGET}
          onSaveBudget={(value) => saveBudget(provider.budgetKey, value)}
        />
      ))}
    </div>
  )
}

function ProviderSection({
  provider,
  budget,
  onSaveBudget,
}: {
  provider: ProviderUsage
  budget: number
  onSaveBudget: (value: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => String(budget))

  if (provider.state !== 'ok') {
    const notConfigured = provider.state === 'not_configured'
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <SectionHeader provider={provider} />
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {notConfigured ? (
              <>
                {provider.name}-forbruk er ikke koblet til ennå. Sett miljøvariabelen{' '}
                <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs dark:bg-gray-800">{provider.envHint}</code> for å vise
                forbruket her.
              </>
            ) : (
              provider.errorMessage ?? 'Kunne ikke hente forbruk akkurat nå.'
            )}
          </p>
        </div>
      </section>
    )
  }

  const used = provider.totalTokens
  const usedPct = budget > 0 ? used / budget : 0
  const remaining = Math.max(0, budget - used)
  const remainingPct = Math.max(0, 1 - usedPct)
  const t = tone(usedPct)
  const maxDaily = Math.max(1, ...provider.daily.map((d) => d.tokens))

  const R = 64
  const C = 2 * Math.PI * R
  const dash = Math.min(1, usedPct) * C

  function commit() {
    onSaveBudget(Number(draft.replace(/[^\d]/g, '')) || DEFAULT_BUDGET)
    setEditing(false)
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <SectionHeader provider={provider} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[230px_1fr]">
        {/* gauge */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50/60 p-5 dark:border-gray-800 dark:bg-gray-950/40">
          <div className="relative h-[156px] w-[156px]">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 156 156">
              <circle cx="78" cy="78" r={R} fill="none" strokeWidth="12" className="stroke-gray-200 dark:stroke-gray-800" />
              <circle
                cx="78"
                cy="78"
                r={R}
                fill="none"
                strokeWidth="12"
                strokeLinecap="round"
                stroke={t.stroke}
                strokeDasharray={`${dash} ${C}`}
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-2xl font-bold', t.text)}>{Math.round(remainingPct * 100)}%</span>
              <span className="mt-0.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">igjen</span>
            </div>
          </div>
          <p className="mt-3 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
            {fmt(remaining)} <span className="text-gray-400 dark:text-gray-500">av {fmt(budget)}</span>
          </p>
        </div>

        {/* budget + stats */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-950/40">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Ukentlig budsjett (tokens)</span>
              {!editing && (
                <button
                  onClick={() => {
                    setDraft(String(budget))
                    setEditing(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-200/60 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  <Pencil size={13} />
                  Rediger
                </button>
              )}
            </div>
            {editing ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  autoFocus
                  inputMode="numeric"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commit()
                    if (e.key === 'Escape') {
                      setDraft(String(budget))
                      setEditing(false)
                    }
                  }}
                  className="h-9 w-40 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-violet-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <button
                  onClick={commit}
                  className="h-9 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-700"
                >
                  Lagre
                </button>
              </div>
            ) : (
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(budget)}</p>
            )}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
              <div
                className={cn('h-full rounded-full transition-all duration-500', t.bg)}
                style={{ width: `${Math.min(100, usedPct * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Brukt {fmt(used)} ({Math.round(usedPct * 100)}%){usedPct >= 1 && <span className="text-rose-500"> · over budsjett</span>}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {provider.requests != null && (
              <Stat icon={Activity} label="Forespørsler" value={provider.requests.toLocaleString('en-US')} accent="text-violet-500" />
            )}
            <Stat icon={ArrowDownToLine} label="Input" value={fmt(provider.inputTokens)} accent="text-sky-500" />
            <Stat icon={ArrowUpFromLine} label="Output" value={fmt(provider.outputTokens)} accent="text-emerald-500" />
            <Stat icon={Cpu} label="Modell" value={provider.mostUsedModel} accent="text-amber-500" small />
          </div>
        </div>
      </div>

      {/* 7-day chart */}
      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Per dag</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">tokens</span>
        </div>
        <div className="flex h-28 items-end gap-2 sm:gap-3">
          {provider.daily.map((day, i) => {
            const h = Math.max(4, (day.tokens / maxDaily) * 100)
            const dt = tone(day.status === 'used_up' ? 1 : day.status === 'heavy' ? 0.8 : 0.3)
            return (
              <div key={`${day.dateLabel}-${i}`} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full flex-1 items-end">
                  <div
                    title={`${day.dateLabel}: ${fmt(day.tokens)} tokens`}
                    className={cn('w-full rounded-t-md transition-all duration-500', dt.bg, day.tokens === 0 && 'bg-gray-200 dark:bg-gray-800')}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{day.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function SectionHeader({ provider }: { provider: ProviderUsage }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
        <Sparkles size={16} />
      </div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{provider.name}</h2>
    </div>
  )
}

function Stat({
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
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon size={14} className={accent} />
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className={cn('font-bold text-gray-900 dark:text-gray-100', small ? 'truncate text-sm' : 'text-lg')} title={small ? value : undefined}>
        {value}
      </p>
    </div>
  )
}
