'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Hash, MessageSquare, GitCommitHorizontal } from 'lucide-react'
import FloatingCard from './FloatingCard'
import type { StepId } from './steps'

/* ────────────────────────────── shared primitives ───────────────────────── */

function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-red-400/80" />
      <span className="h-2 w-2 rounded-full bg-amber-400/80" />
      <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
    </div>
  )
}

function Line({ w, c }: { w: string; c?: string }) {
  return (
    <span
      className="block h-1.5 rounded-full bg-gray-300/70 dark:bg-white/15"
      style={{ width: w, ...(c ? { backgroundColor: c, opacity: 0.55 } : {}) }}
    />
  )
}

function Avatar({
  initials,
  from,
  to,
  ring,
}: {
  initials: string
  from: string
  to: string
  ring?: string
}) {
  return (
    <span
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-sm ring-2 ring-white dark:ring-[#0b0b0f]"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {initials}
      {ring && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-[#0b0b0f]"
          style={{ backgroundColor: ring }}
        />
      )}
    </span>
  )
}

/** Animated connector lines drawn in a 0–100 coordinate space. */
function Connectors({
  lines,
  accent,
}: {
  lines: [number, number, number, number][]
  accent: string
}) {
  const reduce = useReducedMotion()
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
    >
      {lines.map(([x1, y1, x2, y2], i) => (
        <motion.line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={accent}
          strokeOpacity={0.4}
          strokeWidth={0.35}
          strokeLinecap="round"
          strokeDasharray="1.4 2.4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5, strokeDashoffset: reduce ? 0 : [0, -8] }}
          transition={{
            opacity: { delay: 0.5 + i * 0.12, duration: 0.6 },
            strokeDashoffset: { duration: 1.4, repeat: Infinity, ease: 'linear' },
          }}
        />
      ))}
    </svg>
  )
}

/* ─────────────────────────────── scene: build ───────────────────────────── */

function WorkspaceScene({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0">
      <Connectors
        accent={accent}
        lines={[
          [50, 50, 22, 26],
          [50, 50, 80, 24],
          [50, 50, 24, 78],
          [50, 50, 82, 74],
        ]}
      />

      {/* Central hub */}
      <FloatingCard
        delay={0.05}
        amplitude={7}
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 px-5 py-4"
      >
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${accent}, #6366f1)` }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 8a4 4 0 0 1 4-4h4M20 16a4 4 0 0 1-4 4H8"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path d="M8 12h8" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </span>
        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-gray-900 dark:text-white">
            Sync
          </span>
          <Line w="64px" />
        </div>
      </FloatingCard>

      {/* Satellite: project */}
      <FloatingCard delay={0.35} amplitude={11} duration={7} className="absolute left-[6%] top-[10%] w-[34%] p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/15 text-blue-500">
            <Hash size={12} />
          </span>
          <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">Project</span>
        </div>
        <div className="space-y-1.5">
          <Line w="100%" />
          <Line w="70%" />
        </div>
      </FloatingCard>

      {/* Satellite: chat */}
      <FloatingCard delay={0.5} amplitude={9} duration={6.5} className="absolute right-[5%] top-[8%] w-[36%] p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-fuchsia-500/15 text-fuchsia-500">
            <MessageSquare size={12} />
          </span>
          <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">Chat</span>
        </div>
        <div className="rounded-lg bg-gray-100/70 px-2 py-1.5 dark:bg-white/[0.05]">
          <Line w="84%" />
        </div>
      </FloatingCard>

      {/* Satellite: people */}
      <FloatingCard delay={0.62} amplitude={10} duration={7.5} className="absolute left-[8%] bottom-[9%] flex w-[33%] items-center gap-2 p-3">
        <div className="flex -space-x-2">
          <Avatar initials="AK" from="#8b5cf6" to="#6366f1" />
          <Avatar initials="JD" from="#3b82f6" to="#06b6d4" />
        </div>
        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">Team</span>
      </FloatingCard>

      {/* Satellite: code chip */}
      <FloatingCard delay={0.75} amplitude={8} duration={6.8} className="absolute right-[7%] bottom-[11%] w-[34%] p-3 font-mono">
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-md text-white"
            style={{ background: accent }}
          >
            <span className="text-[9px]">{'<>'}</span>
          </span>
          <span className="text-[11px] text-emerald-500">main.ts</span>
        </div>
        <div className="mt-2 space-y-1.5">
          <Line w="90%" c={accent} />
          <Line w="60%" />
        </div>
      </FloatingCard>
    </div>
  )
}

/* ─────────────────────────────── scene: create ──────────────────────────── */

function KanbanColumn({
  label,
  count,
  children,
  delay,
}: {
  label: string
  count: number
  children: React.ReactNode
  delay: number
}) {
  return (
    <FloatingCard delay={delay} amplitude={6} duration={7.5} className="flex w-full flex-col gap-2 bg-white/60 p-2.5 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <span className="rounded-full bg-gray-200/80 px-1.5 text-[10px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
          {count}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </FloatingCard>
  )
}

function TaskCard({
  accent,
  highlight,
  tag,
  tagColor,
}: {
  accent: string
  highlight?: boolean
  tag: string
  tagColor: string
}) {
  return (
    <div
      className="rounded-xl border bg-white p-2.5 shadow-sm dark:bg-[#101015]"
      style={
        highlight
          ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}, 0 10px 30px -12px ${accent}` }
          : { borderColor: 'rgb(0 0 0 / 0.06)' }
      }
    >
      <span
        className="mb-2 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
        style={{ backgroundColor: `${tagColor}22`, color: tagColor }}
      >
        {tag}
      </span>
      <div className="space-y-1.5">
        <Line w="100%" />
        <Line w="65%" />
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex -space-x-1.5">
          <span className="h-5 w-5 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 ring-2 ring-white dark:ring-[#101015]" />
          <span className="h-5 w-5 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 ring-2 ring-white dark:ring-[#101015]" />
        </div>
        <span className="text-[9px] font-medium text-gray-400">SYNC-2{tag === 'In progress' ? 4 : 7}</span>
      </div>
    </div>
  )
}

function ProjectsScene({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-2">
      <div className="grid w-full grid-cols-3 gap-2.5 sm:gap-3">
        <KanbanColumn label="To do" count={2} delay={0.15}>
          <TaskCard accent={accent} tag="Design" tagColor="#8b5cf6" />
          <TaskCard accent={accent} tag="Research" tagColor="#06b6d4" />
        </KanbanColumn>

        <KanbanColumn label="In progress" count={1} delay={0.3}>
          <FloatingCard delay={0.55} amplitude={13} duration={5} className="border-0 bg-transparent p-0 shadow-none backdrop-blur-0 dark:bg-transparent dark:shadow-none">
            <TaskCard accent={accent} highlight tag="In progress" tagColor={accent} />
          </FloatingCard>
        </KanbanColumn>

        <KanbanColumn label="Done" count={2} delay={0.45}>
          <TaskCard accent={accent} tag="Shipped" tagColor="#10b981" />
          <TaskCard accent={accent} tag="Shipped" tagColor="#10b981" />
        </KanbanColumn>
      </div>
    </div>
  )
}

/* ──────────────────────────────── scene: code ───────────────────────────── */

const CODE_LINES: { indent: number; width: string; color: string }[] = [
  { indent: 0, width: '52%', color: '#c792ea' },
  { indent: 1, width: '74%', color: '#82aaff' },
  { indent: 1, width: '58%', color: '#a8b1c2' },
  { indent: 2, width: '66%', color: '#c3e88d' },
  { indent: 1, width: '40%', color: '#82aaff' },
  { indent: 0, width: '30%', color: '#c792ea' },
]

function GithubMark({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.87.12 3.17.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  )
}

function ToolChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/60 bg-white/80 px-2 py-1 text-[10px] font-medium text-gray-700 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-200">
      {children}
      {label}
    </span>
  )
}

function CodeScene({ accent }: { accent: string }) {
  const reduce = useReducedMotion()
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-3">
      <FloatingCard delay={0.1} amplitude={7} className="w-full max-w-[440px] overflow-hidden p-0">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-black/5 px-3.5 py-2.5 dark:border-white/10">
          <TrafficLights />
          <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">app/sync.ts</span>
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-500">
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              animate={reduce ? {} : { opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            live
          </span>
        </div>

        {/* Code body */}
        <div className="flex gap-3 px-3.5 py-3 font-mono">
          <div className="flex flex-col items-end gap-2 pt-0.5 text-[10px] leading-none text-gray-300 dark:text-gray-600">
            {CODE_LINES.map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <div className="flex-1 space-y-2">
            {CODE_LINES.map((l, i) => (
              <div key={i} className="flex items-center" style={{ paddingLeft: l.indent * 14 }}>
                <motion.span
                  className="block h-2 rounded-sm"
                  style={{ backgroundColor: l.color, opacity: 0.85 }}
                  initial={{ width: 0 }}
                  animate={{ width: l.width }}
                  transition={{
                    delay: reduce ? 0 : 0.4 + i * 0.16,
                    duration: reduce ? 0 : 0.5,
                    ease: 'easeOut',
                  }}
                />
                {i === CODE_LINES.length - 1 && (
                  <motion.span
                    className="ml-1 inline-block h-3.5 w-[2px]"
                    style={{ backgroundColor: accent }}
                    animate={reduce ? {} : { opacity: [1, 0, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 1.4 }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </FloatingCard>

      {/* Integration chips */}
      <FloatingCard delay={0.55} amplitude={9} duration={6.5} className="flex flex-wrap items-center justify-center gap-2 border-0 bg-transparent p-0 shadow-none backdrop-blur-0 dark:bg-transparent dark:shadow-none">
        <ToolChip label="GitHub">
          <GithubMark size={12} />
        </ToolChip>
        <ToolChip label="Cursor">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-200 dark:to-white" />
        </ToolChip>
        <ToolChip label="Codex">
          <span className="font-mono text-[9px]" style={{ color: accent }}>{'{ }'}</span>
        </ToolChip>
        <ToolChip label="VS Code">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-gradient-to-br from-sky-400 to-blue-600" />
        </ToolChip>
      </FloatingCard>
    </div>
  )
}

/* ──────────────────────────────── scene: sync ───────────────────────────── */

function TeamScene({ accent }: { accent: string }) {
  const reduce = useReducedMotion()
  return (
    <div className="absolute inset-0">
      <Connectors
        accent={accent}
        lines={[
          [50, 52, 20, 22],
          [50, 52, 80, 20],
          [50, 52, 76, 80],
        ]}
      />

      {/* Shared progress card */}
      <FloatingCard delay={0.1} amplitude={7} className="absolute left-1/2 top-1/2 w-[60%] max-w-[280px] -translate-x-1/2 -translate-y-1/2 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
              style={{ background: `linear-gradient(135deg, ${accent}, #6366f1)` }}
            >
              <Hash size={13} />
            </span>
            <span className="text-xs font-semibold text-gray-900 dark:text-white">
              Launch v1.0
            </span>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            3 online
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200/80 dark:bg-white/10">
          <motion.span
            className="block h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${accent}, #6366f1)` }}
            initial={{ width: '0%' }}
            animate={{ width: '72%' }}
            transition={{ delay: 0.4, duration: reduce ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
          <GitCommitHorizontal size={13} style={{ color: accent }} />
          <span>Ada pushed 3 commits</span>
        </div>
      </FloatingCard>

      {/* Avatar nodes */}
      <FloatingCard delay={0.4} amplitude={10} duration={6.4} className="absolute left-[8%] top-[10%] border-0 bg-transparent p-0 shadow-none backdrop-blur-0 dark:bg-transparent dark:shadow-none">
        <Avatar initials="AK" from="#8b5cf6" to="#6366f1" ring="#10b981" />
      </FloatingCard>
      <FloatingCard delay={0.55} amplitude={9} duration={7} className="absolute right-[10%] top-[8%] border-0 bg-transparent p-0 shadow-none backdrop-blur-0 dark:bg-transparent dark:shadow-none">
        <Avatar initials="JD" from="#3b82f6" to="#06b6d4" ring="#10b981" />
      </FloatingCard>
      <FloatingCard delay={0.7} amplitude={11} duration={6.8} className="absolute right-[16%] bottom-[12%] border-0 bg-transparent p-0 shadow-none backdrop-blur-0 dark:bg-transparent dark:shadow-none">
        <Avatar initials="MR" from="#10b981" to="#14b8a6" ring="#10b981" />
      </FloatingCard>
    </div>
  )
}

/* ──────────────────────────────── dispatcher ────────────────────────────── */

export default function Scene({ id, accent }: { id: StepId; accent: string }) {
  switch (id) {
    case 'build':
      return <WorkspaceScene accent={accent} />
    case 'create':
      return <ProjectsScene accent={accent} />
    case 'code':
      return <CodeScene accent={accent} />
    case 'sync':
      return <TeamScene accent={accent} />
  }
}
